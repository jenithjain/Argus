// Next.js API Route: /api/analyze-url
// Uses Gemini to classify whether a URL is malicious, phishing, or safe.
// Called by the ARGUS Chrome extension background service worker.
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import SecurityAnalytics from '@/lib/models/SecurityAnalytics';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Lexical analysis helpers (fallback when Gemini is unavailable)
const SUSPICIOUS_KEYWORDS = [
  'login','signin','verify','secure','account','update','confirm','paypal',
  'amazon','google','apple','microsoft','netflix','bank','password','credential',
  'suspend','urgent','alert','limited','unusual','activity','suspended','validate'
];
const MALICIOUS_TLDS = ['.tk','.ml','.ga','.cf','.gq','.xyz','.top','.click','.download','.link'];

function sanitizeSignals(signals) {
  const seen = new Set();
  return (Array.isArray(signals) ? signals : [])
    .map(s => String(s || '').trim())
    .filter(Boolean)
    .filter(s => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6)
    .map(s => s.slice(0, 120));
}

function scoreToConfidence(score, verdict) {
  const normalized = Math.max(0, Math.min(100, Number(score || 0))) / 100;
  if (['MALICIOUS', 'HIGH_RISK'].includes(verdict)) return Number(normalized.toFixed(2));
  if (verdict === 'CLEAR') return Number((1 - normalized).toFixed(2));
  const distanceFromCenter = Math.abs(normalized - 0.5) * 2;
  return Number(Math.max(0.5, distanceFromCenter).toFixed(2));
}

function buildExplainability(urlStr, verdict, score, reason, modelSignals = [], fallbackLabel = null) {
  const lexicalReason = getLexicalReason(urlStr, score);
  const lexicalSignals = lexicalReason
    .split('.')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => s.toLowerCase() !== 'url appears safe')
    .map(s => `Lexical: ${s}`);

  const signals = sanitizeSignals([
    ...modelSignals,
    ...lexicalSignals,
    fallbackLabel ? `Source: ${fallbackLabel}` : null,
  ]);

  const safeReason = String(reason || '').trim();
  const explanation = safeReason
    ? `${safeReason} Evidence: ${signals.slice(0, 3).join('; ') || 'No high-risk indicators.'}`
    : `Automated URL analysis found ${signals.length ? 'the following indicators: ' + signals.slice(0, 3).join('; ') : 'no strong malicious indicators'}.`;

  const severity = computeSeverity(score);
  const action = computeAction(verdict, severity);
  const confidence = scoreToConfidence(score, verdict);

  return {
    verdict,
    score,
    reason: safeReason || lexicalReason,
    signals,
    explanation: explanation.slice(0, 420),
    severity,
    action,
    confidence,
  };
}

function calculateLexicalScore(urlStr) {
  try {
    const u = new URL(urlStr);
    let score = 0;
    const host = u.hostname.toLowerCase();
    const full = urlStr.toLowerCase();

    // IP address instead of domain
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) score += 40;
    // Excessive subdomains
    if (host.split('.').length > 4) score += 20;
    // Suspicious TLD
    if (MALICIOUS_TLDS.some(t => host.endsWith(t))) score += 25;
    // Suspicious keywords in host
    const kwHits = SUSPICIOUS_KEYWORDS.filter(k => host.includes(k)).length;
    score += kwHits * 12;
    // @ in URL (classic trick)
    if (full.includes('@')) score += 30;
    // Excessive hyphens
    const hyphens = (host.match(/-/g) || []).length;
    if (hyphens > 3) score += 15;
    // Very long URL
    if (urlStr.length > 100) score += 10;
    if (urlStr.length > 200) score += 15;
    // Double slashes
    if (full.includes('//') && full.indexOf('//') !== full.lastIndexOf('//')) score += 20;
    // Punycode / xn-- (homograph attack)
    if (host.includes('xn--')) score += 35;
    // Port in URL (unusual for regular sites)
    if (u.port && !['80','443',''].includes(u.port)) score += 15;

    return Math.min(score, 100);
  } catch {
    return 0;
  }
}

function getLexicalReason(urlStr, score) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    const reasons = [];

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) reasons.push('Uses raw IP address');
    if (host.includes('xn--')) reasons.push('Contains punycode (homograph attack)');
    if (MALICIOUS_TLDS.some(t => host.endsWith(t))) reasons.push('High-risk TLD');
    if (urlStr.includes('@')) reasons.push('URL obfuscation pattern detected');
    if (host.split('.').length > 4) reasons.push('Excessive subdomains');

    const kwHits = SUSPICIOUS_KEYWORDS.filter(k => host.includes(k));
    if (kwHits.length > 0) reasons.push(`Suspicious keywords: ${kwHits.slice(0, 3).join(', ')}`);

    if (reasons.length === 0) {
      return score >= 40 ? 'Multiple risk indicators detected' : 'URL appears safe';
    }

    return reasons.join('. ');
  } catch {
    return 'Unable to analyze URL structure';
  }
}

const SYSTEM_PROMPT = `You are a cybersecurity URL analyst. Given a URL, analyze it and classify it as one of:
- MALICIOUS: definitively dangerous (phishing, malware, scam, credential harvesting)
- HIGH_RISK: very likely dangerous based on multiple strong signals
- SUSPICIOUS: several warning signs but not conclusive
- CLEAR: appears safe

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "verdict": "MALICIOUS|HIGH_RISK|SUSPICIOUS|CLEAR",
  "score": <integer 0-100, where 100 = definitely malicious>,
  "reason": "<one to two sentences explaining the specific signals that led to this verdict>",
  "signals": ["<signal 1>", "<signal 2>", "<signal 3>"]
}

Analysis criteria to consider:
- Domain age and reputation (newly registered = high risk)
- Brand impersonation / lookalike domains (paypa1.com, rn-micosoft.com)
- Punycode / homograph attacks (xn-- prefixes)
- IP address in URL instead of domain name
- Excessive subdomains, suspicious path keywords
- Known bad TLDs (.tk, .ml, .ga, .cf, .gq)
- @ symbols in URL (forces browser to ignore everything before)
- URL entropy (random character strings)
- Suspicious keywords: login, verify, secure, account, suspend, confirm
- SSL mismatch or missing
- Redirect chains / URL shorteners to unknown domains

Be conservative: well-known domains like google.com, github.com, microsoft.com, etc. should always be CLEAR.`;

// Helper function to compute severity from score
function computeSeverity(score) {
  if (score >= 70) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

// Helper function to compute recommended action
function computeAction(verdict, severity) {
  if (verdict === 'MALICIOUS' || severity === 'CRITICAL') {
    return 'Block this URL immediately. Do not enter any credentials or personal information.';
  }
  if (verdict === 'HIGH_RISK' || severity === 'HIGH') {
    return 'High risk detected. Avoid visiting this site and verify the source.';
  }
  if (verdict === 'SUSPICIOUS' || severity === 'MEDIUM') {
    return 'Proceed with caution. Verify the URL authenticity before interacting.';
  }
  return 'URL appears safe. No action needed.';
}

// Log URL analysis to database
async function logUrlAnalysis(url, verdict, score, reason, signals, explanation, action, severity, confidence) {
  try {
    await connectDB();
    
    // Extract domain from URL
    let domain = '';
    try {
      domain = new URL(url).hostname;
    } catch {}
    
    await SecurityAnalytics.create({
      userId: null, // Will be set when user auth is available
      detectionType: 'url',
      detectedAt: new Date(),
      verdict,
      score,
      severity,
      url,
      urlDomain: domain,
      reason,
      signals,
      explanation,
      action,
      confidence,
      sessionId: `url-${Date.now()}`
    });
  } catch (error) {
    console.error('[ARGUS] Error logging URL analysis:', error);
    throw error;
  }
}

export async function POST(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    // Input validation
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { url } = body;
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid url field' }, { status: 400, headers: corsHeaders });
    }

    // Validate URL format — reject non-HTTP(S) schemes
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ verdict: 'CLEAR', score: 0, reason: 'Not a valid URL', signals: [] }, { headers: corsHeaders });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ verdict: 'CLEAR', score: 0, reason: 'Non-HTTP URL', signals: [] }, { headers: corsHeaders });
    }

    // Skip obviously safe internal/extension URLs
    const hostname = parsedUrl.hostname.toLowerCase();
    const ALWAYS_SAFE = [
      'google.com', 'googleapis.com', 'gstatic.com',
      'microsoft.com', 'windows.com', 'office.com', 'azure.com',
      'github.com', 'githubusercontent.com',
      'cloudflare.com', 'amazon.com', 'amazonaws.com',
      'apple.com', 'icloud.com',
      'mozilla.org', 'firefox.com',
      'localhost', '127.0.0.1',
    ];
    if (ALWAYS_SAFE.some(safe => hostname === safe || hostname.endsWith('.' + safe))) {
      const explainable = buildExplainability(
        url,
        'CLEAR',
        0,
        'Trusted domain on allowlist',
        ['Allowlist match on trusted domain'],
        'allowlist'
      );
      return NextResponse.json({ ...explainable, url }, { headers: corsHeaders });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `${SYSTEM_PROMPT}\n\nAnalyze this URL:\n${url}`;

    let result;
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Gemini API timeout')), 8000)
      );
      
      const geminiPromise = model.generateContent(prompt);
      
      result = await Promise.race([geminiPromise, timeoutPromise]);
    } catch (geminiError) {
      console.error('[ARGUS /api/analyze-url] Gemini API error:', geminiError.message);
      // Fallback to lexical analysis only
      const lexScore = calculateLexicalScore(url);
      const lexVerdict = lexScore >= 70 ? 'HIGH_RISK' : lexScore >= 40 ? 'SUSPICIOUS' : 'CLEAR';
      const lexReason = getLexicalReason(url, lexScore);
      const explainable = buildExplainability(
        url,
        lexVerdict,
        lexScore,
        lexReason,
        ['Gemini unavailable, used deterministic lexical analysis'],
        'lexical-fallback'
      );

      return NextResponse.json({ ...explainable, url }, { headers: corsHeaders });
    }

    const text   = result.response.text().trim();

    // Parse Gemini JSON response
    let parsed;
    try {
      // Handle potential markdown code blocks from model
      const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('[ARGUS /api/analyze-url] Failed to parse Gemini response:', text);
      // Fallback: return CLEAR to avoid false blocks
      const safeScore = calculateLexicalScore(url);
      const safeVerdict = safeScore >= 70 ? 'HIGH_RISK' : safeScore >= 40 ? 'SUSPICIOUS' : 'CLEAR';
      const explainable = buildExplainability(
        url,
        safeVerdict,
        safeScore,
        'Model response was invalid; fallback analysis used.',
        ['Gemini JSON parse failed'],
        'parse-fallback'
      );
      return NextResponse.json({ ...explainable, url }, { headers: corsHeaders });
    }

    // Sanitize output fields
    const verdictOptions = ['MALICIOUS', 'HIGH_RISK', 'SUSPICIOUS', 'CLEAR'];
    const verdict = verdictOptions.includes(parsed.verdict) ? parsed.verdict : 'CLEAR';
    const score   = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 0;
    const reason  = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 300) : '';
    const signals = Array.isArray(parsed.signals) ? parsed.signals : [];
    const explainable = buildExplainability(url, verdict, score, reason, signals, 'gemini+lexical');

    // Log to database (async, don't block response)
    logUrlAnalysis(
      url,
      explainable.verdict,
      explainable.score,
      explainable.reason,
      explainable.signals,
      explainable.explanation,
      explainable.action,
      explainable.severity,
      explainable.confidence
    ).catch(err => 
      console.error('[ARGUS] Failed to log URL analysis:', err.message)
    );

    return NextResponse.json({ ...explainable, url }, { headers: corsHeaders });

  } catch (error) {
    console.error('[ARGUS /api/analyze-url] Error:', error);
    // On error, fail open (CLEAR) to avoid blocking legitimate sites
    const explainable = buildExplainability(
      'http://unknown.local',
      'CLEAR',
      0,
      'Analysis service unavailable',
      ['System fallback activated'],
      'error-fallback'
    );
    return NextResponse.json({ ...explainable }, { status: 200, headers: corsHeaders });
  }
}

// CORS: allow the Chrome extension to call this endpoint
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
