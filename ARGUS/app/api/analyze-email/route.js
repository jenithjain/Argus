// Next.js API Route: /api/analyze-email
// Uses Gemini to analyze email content for phishing, spam, and malicious content
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import connectDB from '@/lib/mongodb';
import SecurityAnalytics from '@/lib/models/SecurityAnalytics';

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

// Log email analysis to database
async function logEmailAnalysis(sender, subject, verdict, score, reason, signals) {
  try {
    await connectDB();
    
    const severity = computeSeverity(score);
    const action = computeAction(verdict, severity);
    
    await SecurityAnalytics.create({
      userId: null,
      detectionType: 'email',
      detectedAt: new Date(),
      verdict,
      score,
      severity,
      emailSender: sender,
      emailSubject: subject,
      reason,
      signals,
      action,
      sessionId: `email-${Date.now()}`
    });
  } catch (error) {
    console.error('[ARGUS] Error logging email analysis:', error);
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

    // Log to database
    logEmailAnalysis(sender, subject, verdict, score, reason, signals).catch(err =>
      console.error('[ARGUS] Failed to log email analysis:', err.message)
    );

    return NextResponse.json({
      verdict,
      score,
      reason,
      signals,
      sender,
      subject
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[ARGUS /api/analyze-email] Error:', error);
    return NextResponse.json({
      verdict: 'CLEAR',
      score: 0,
      reason: 'Analysis service unavailable',
      signals: [],
    }, { status: 200, headers: corsHeaders });
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
