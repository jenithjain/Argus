// Next.js API Route: /api/analyze-url
// Uses Gemini to classify whether a URL is malicious, phishing, or safe.
// Called by the ARGUS Chrome extension background service worker.
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
      return NextResponse.json({
        verdict: 'CLEAR',
        score: 0,
        reason: 'Trusted domain on allowlist',
        signals: [],
      }, { headers: corsHeaders });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `${SYSTEM_PROMPT}\n\nAnalyze this URL:\n${url}`;

    const result = await model.generateContent(prompt);
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
      return NextResponse.json({
        verdict: 'CLEAR',
        score: 0,
        reason: 'Analysis inconclusive',
        signals: [],
        url,
      }, { headers: corsHeaders });
    }

    // Sanitize output fields
    const verdictOptions = ['MALICIOUS', 'HIGH_RISK', 'SUSPICIOUS', 'CLEAR'];
    const verdict = verdictOptions.includes(parsed.verdict) ? parsed.verdict : 'CLEAR';
    const score   = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 0;
    const reason  = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 300) : '';
    const signals = Array.isArray(parsed.signals) ? parsed.signals.slice(0, 5).map(s => String(s).slice(0, 100)) : [];

    return NextResponse.json({ verdict, score, reason, signals, url }, { headers: corsHeaders });

  } catch (error) {
    console.error('[ARGUS /api/analyze-url] Error:', error);
    // On error, fail open (CLEAR) to avoid blocking legitimate sites
    return NextResponse.json({
      verdict: 'CLEAR',
      score:   0,
      reason:  'Analysis service unavailable',
      signals: [],
    }, { status: 200, headers: corsHeaders });
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
