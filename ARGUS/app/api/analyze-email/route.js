// Next.js API Route: /api/analyze-email
// Uses Gemini to analyze email content for phishing, spam, and malicious content
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import connectDB from '@/lib/mongodb';
import SecurityAnalytics from '@/lib/models/SecurityAnalytics';
import { getCampaignClusters, attachEmailToCampaign } from '@/lib/graph-builder';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are a cybersecurity email analyst. Analyze the provided email and classify it as:
- MALICIOUS: definitively dangerous (phishing, malware, scam, credential theft)
- HIGH_RISK: very likely dangerous based on multiple strong signals
- SUSPICIOUS: several warning signs but not conclusive
- CLEAR: appears safe

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "verdict": "MALICIOUS|HIGH_RISK|SUSPICIOUS|CLEAR",
  "score": <integer 0-100, where 100 = definitely malicious>,
  "reason": "<one to two sentences explaining the specific signals>",
  "signals": ["<signal 1>", "<signal 2>", "<signal 3>"]
}

Analysis criteria:
- Sender email domain (spoofed, lookalike, suspicious)
- Subject line urgency/pressure tactics
- Grammar and spelling errors
- Suspicious links or attachments
- Requests for credentials, payment, or personal information
- Impersonation of known brands or individuals
- Mismatched sender/reply-to addresses
- Unusual formatting or encoding
- Sense of urgency or threats
- Too-good-to-be-true offers

Be conservative: emails from known legitimate domains should be CLEAR unless there are strong phishing signals.`;

// Helper functions
function computeSeverity(score) {
  if (score >= 70) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

function computeAction(verdict, severity) {
  if (verdict === 'MALICIOUS' || severity === 'CRITICAL') {
    return 'Delete this email immediately. Do not click any links or download attachments. Report as phishing.';
  }
  if (verdict === 'HIGH_RISK' || severity === 'HIGH') {
    return 'High risk detected. Do not interact with this email. Verify sender through alternate channels.';
  }
  if (verdict === 'SUSPICIOUS' || severity === 'MEDIUM') {
    return 'Proceed with extreme caution. Verify sender authenticity before taking any action.';
  }
  return 'Email appears safe. No action needed.';
}

function hashString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function extractDomains(links) {
  const domains = new Set();
  for (const link of links || []) {
    try {
      const url = new URL(link);
      if (url.hostname) domains.add(url.hostname);
    } catch {
      // ignore invalid URLs
    }
  }
  return Array.from(domains).slice(0, 20);
}

async function linkEmailToCampaignContext({ sender, subject, verdict, score, reason, signals, links }) {
  const linkDomains = extractDomains(links);
  if (!linkDomains.length) return null;
  if (verdict === 'CLEAR' && score < 30) return null;

  let campaigns = [];
  try {
    campaigns = await getCampaignClusters();
  } catch (error) {
    console.warn('[ARGUS Email] Campaign lookup failed:', error.message);
  }

  const trimmedCampaigns = campaigns.slice(0, 12).map(c => ({
    id: c.campaignId || c.id,
    domainCount: c.domainCount || c.domains?.length || 0,
    domains: (c.domains || []).slice(0, 10),
  }));

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = `You are a threat intelligence analyst. Decide if this email should attach to an existing campaign or create a new one.\n\nReturn ONLY JSON:\n{\n  \"action\": \"attach\"|\"new\"|\"ignore\",\n  \"campaignId\": \"<existing campaign id or empty>\",\n  \"confidence\": <number 0-1>,\n  \"rationale\": \"short reason\"\n}\n\nEmail context:\n- Sender: ${sender}\n- Subject: ${subject}\n- Verdict: ${verdict}\n- Score: ${score}\n- Reason: ${reason}\n- Signals: ${signals?.join('; ') || 'none'}\n- Link domains: ${linkDomains.join(', ')}\n\nExisting campaigns (id + top domains):\n${JSON.stringify(trimmedCampaigns)}\n\nRules:\n- Attach if there is clear overlap in domains or strong similarity in intent.\n- Create new if the sender appears to be the primary source of these domains and no overlap exists.\n- Ignore if confidence is low or evidence is weak.\n`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    const action = ['attach', 'new', 'ignore'].includes(parsed.action) ? parsed.action : 'ignore';
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
    const campaignId = typeof parsed.campaignId === 'string' ? parsed.campaignId : '';
    if (confidence < 0.7) return null;

    if (action === 'attach' && campaignId) {
      return { action, campaignId, linkDomains };
    }

    if (action === 'new') {
      const senderKey = hashString(String(sender).toLowerCase());
      const campaignKey = `email_campaign_${senderKey}`;
      return { action, campaignId: campaignKey, linkDomains };
    }

    return null;
  } catch (error) {
    console.warn('[ARGUS Email] Campaign linking failed:', error.message);
    return null;
  }
}

// Log email analysis to database
async function logEmailAnalysis(sender, subject, verdict, score, reason, signals) {
  try {
    console.log('[ARGUS Email Log] Starting log process...');
    console.log('[ARGUS Email Log] Input data:', { sender, subject, verdict, score, reason, signals });
    
    console.log('[ARGUS Email Log] Connecting to MongoDB...');
    await connectDB();
    console.log('[ARGUS Email Log] MongoDB connected successfully');
    
    const severity = computeSeverity(score);
    const action = computeAction(verdict, severity);
    
    const logData = {
      userId: null,
      detectionType: 'email',
      detectedAt: new Date(),
      verdict: String(verdict),
      score: Number(score),
      severity: String(severity),
      emailSender: String(sender).slice(0, 200),
      emailSubject: String(subject).slice(0, 300),
      reason: String(reason).slice(0, 300),
      signals: Array.isArray(signals) ? signals.map(s => String(s).slice(0, 100)) : [],
      action: String(action),
      sessionId: `email-${Date.now()}`
    };
    
    console.log('[ARGUS Email Log] Creating log entry with data:', JSON.stringify(logData, null, 2));
    const result = await SecurityAnalytics.create(logData);
    console.log('[ARGUS Email Log] Successfully created log entry with ID:', result._id.toString());
    return result;
  } catch (error) {
    console.error('[ARGUS Email Log] Error logging email analysis:', error.message);
    console.error('[ARGUS Email Log] Error stack:', error.stack);
    console.error('[ARGUS Email Log] Error name:', error.name);
    if (error.errors) {
      console.error('[ARGUS Email Log] Validation errors:', JSON.stringify(error.errors, null, 2));
    }
    throw error;
  }
}

export async function POST(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();
    const { sender, subject, body: emailBody, headers } = body;

    if (!sender || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields: sender, subject' },
        { status: 400, headers: corsHeaders }
      );
    }

    // If the caller (e.g. background service worker) already computed the
    // verdict/score/reason/signals locally, skip Gemini and just persist them.
    if (body.verdict && typeof body.score === 'number' && body.reason) {
      console.log('[ARGUS Email] Received pre-computed analysis from extension');
      console.log('[ARGUS Email] Data:', JSON.stringify(body, null, 2));
      
      const verdictOptions = ['MALICIOUS', 'HIGH_RISK', 'SUSPICIOUS', 'CLEAR'];
      const verdict  = verdictOptions.includes(body.verdict) ? body.verdict : 'CLEAR';
      const score    = Math.max(0, Math.min(100, Math.round(body.score)));
      const reason   = String(body.reason).slice(0, 300);
      const signals  = Array.isArray(body.signals) ? body.signals.slice(0, 5).map(s => String(s).slice(0, 100)) : [];
      const links    = Array.isArray(body.links) ? body.links.slice(0, 20).map(l => String(l)) : [];

      try {
        console.log('[ARGUS Email] Attempting to log to database...');
        const logResult = await logEmailAnalysis(sender, subject, verdict, score, reason, signals);
        console.log('[ARGUS Email] Successfully logged pre-computed email analysis, ID:', logResult._id.toString());
        
        linkEmailToCampaignContext({ sender, subject, verdict, score, reason, signals, links })
          .then(async (linkResult) => {
            if (!linkResult) return;
            const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000));
            const emailId = `email_${hashString(`${sender}|${subject}|${linkResult.linkDomains.join(',')}|${hourBucket}`)}`;
            await attachEmailToCampaign({
              campaignId: linkResult.campaignId,
              emailId,
              sender,
              subject,
              verdict,
              score,
              reason,
              linkDomains: linkResult.linkDomains,
            });
          })
          .catch(() => {});

        return NextResponse.json({ 
          success: true,
          logged: true,
          logId: logResult._id.toString(),
          verdict, 
          score, 
          reason, 
          signals, 
          sender, 
          subject 
        }, { headers: corsHeaders });
      } catch (err) {
        console.error('[ARGUS Email] Failed to log pre-computed email analysis:', err.message);
        console.error('[ARGUS Email] Stack trace:', err.stack);
        
        // Still return success to extension, but indicate logging failed
        return NextResponse.json({ 
          success: true,
          logged: false,
          error: err.message,
          verdict, 
          score, 
          reason, 
          signals, 
          sender, 
          subject 
        }, { headers: corsHeaders });
      }
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const emailContent = `
Sender: ${sender}
Subject: ${subject}
${emailBody ? `Body: ${emailBody.slice(0, 1000)}` : ''}
${headers ? `Headers: ${JSON.stringify(headers).slice(0, 500)}` : ''}
    `.trim();

    const prompt = `${SYSTEM_PROMPT}\n\nAnalyze this email:\n${emailContent}`;

    let result;
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API timeout')), 8000)
      );
      
      const geminiPromise = model.generateContent(prompt);
      result = await Promise.race([geminiPromise, timeoutPromise]);
    } catch (geminiError) {
      console.error('[ARGUS /api/analyze-email] Gemini error:', geminiError.message);
      
      // Fallback: basic heuristic analysis
      const suspiciousKeywords = ['urgent', 'verify', 'suspended', 'click here', 'confirm', 'password', 'account'];
      const foundKeywords = suspiciousKeywords.filter(k => 
        subject.toLowerCase().includes(k) || (emailBody && emailBody.toLowerCase().includes(k))
      );
      
      const score = Math.min(foundKeywords.length * 20, 80);
      const verdict = score >= 60 ? 'SUSPICIOUS' : 'CLEAR';
      
      return NextResponse.json({
        verdict,
        score,
        reason: foundKeywords.length > 0 
          ? `Contains suspicious keywords: ${foundKeywords.join(', ')}`
          : 'Basic analysis shows no obvious threats',
        signals: ['Heuristic analysis only (AI unavailable)'],
        sender,
        subject
      }, { headers: corsHeaders });
    }

    const text = result.response.text().trim();

    // Parse Gemini response
    let parsed;
    try {
      const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('[ARGUS /api/analyze-email] Failed to parse response:', text);
      return NextResponse.json({
        verdict: 'CLEAR',
        score: 0,
        reason: 'Analysis inconclusive',
        signals: [],
        sender,
        subject
      }, { headers: corsHeaders });
    }

    // Sanitize output
    const verdictOptions = ['MALICIOUS', 'HIGH_RISK', 'SUSPICIOUS', 'CLEAR'];
    const verdict = verdictOptions.includes(parsed.verdict) ? parsed.verdict : 'CLEAR';
    const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 0;
    const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 300) : '';
    const signals = Array.isArray(parsed.signals) ? parsed.signals.slice(0, 5).map(s => String(s).slice(0, 100)) : [];
    const links = Array.isArray(body.links) ? body.links.slice(0, 20).map(l => String(l)) : [];

    // Log to database
    logEmailAnalysis(sender, subject, verdict, score, reason, signals).catch(err =>
      console.error('[ARGUS] Failed to log email analysis:', err.message)
    );

    linkEmailToCampaignContext({ sender, subject, verdict, score, reason, signals, links })
      .then(async (linkResult) => {
        if (!linkResult) return;
        const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000));
        const emailId = `email_${hashString(`${sender}|${subject}|${linkResult.linkDomains.join(',')}|${hourBucket}`)}`;
        await attachEmailToCampaign({
          campaignId: linkResult.campaignId,
          emailId,
          sender,
          subject,
          verdict,
          score,
          reason,
          linkDomains: linkResult.linkDomains,
        });
      })
      .catch(() => {});

    return NextResponse.json({
      verdict,
      score,
      reason,
      signals,
      sender,
      subject
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[ARGUS /api/analyze-email] Unexpected error:', error.message);
    console.error('[ARGUS /api/analyze-email] Error stack:', error.stack);
    console.error('[ARGUS /api/analyze-email] Error name:', error.name);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      verdict: 'CLEAR',
      score: 0,
      reason: 'Analysis service error: ' + error.message,
      signals: [],
    }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
