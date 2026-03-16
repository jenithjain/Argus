import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import connectDB from "@/lib/mongodb";
import SecurityAnalytics from "@/lib/models/SecurityAnalytics";

// ── In-memory event queue (single-user hackathon demo) ──────────────
// Listeners are SSE connections from the dashboard
const listeners = new Set();
let lastVerdict = null;
let lastExplanation = "";
let lastSeverity = "LOW";
let lastAction = "";

// ── Severity logic ──────────────────────────────────────────────────
function computeSeverity(fakeProbability) {
  if (fakeProbability >= 0.75) return "CRITICAL";
  if (fakeProbability >= 0.55) return "HIGH";
  if (fakeProbability >= 0.30) return "MEDIUM";
  return "LOW";
}

function computeAction(severity) {
  switch (severity) {
    case "CRITICAL":
      return "Almost certainly a deepfake. Immediately stop interaction and report.";
    case "HIGH":
      return "High likelihood of manipulation. Do not share or act on this content.";
    case "MEDIUM":
      return "Some anomalies detected. Verify the source of this video before trusting it.";
    default:
      return "Content appears authentic. No action needed.";
  }
}

// ── Gemini explanation (called only on verdict change) ───────────────
async function generateExplanation(data) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) return "Explanation unavailable — no Gemini API key configured.";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are a cybersecurity AI analyst for the ARGUS threat detection platform. A deepfake detection system just analyzed a live video stream in real-time.

Detection data:
- Fake probability: ${(data.fake_probability * 100).toFixed(1)}%
- Analysis mode: ${data.analysis_mode || "unknown"} (face+frame means a face was detected and both face model and frame forensics were used; frame_only means no face was found so only frame-level forensic signals were used)
- Temporal average: ${((data.temporal_average || 0) * 100).toFixed(1)}% (rolling average across last 60 frames)
- Stability score: ${((data.stability_score || 0) * 100).toFixed(1)}% (how consistent predictions are — higher means more stable/reliable)
- Verdict: ${data.confidence_level || "UNCERTAIN"} (voted across last 10 frames using majority voting)
- Frames analyzed: ${data.frame_count || 0}
- Processing time: ${data.processing_time_ms || 0}ms per frame

${data.face_probability !== undefined ? `- Face model probability: ${(data.face_probability * 100).toFixed(1)}%` : ""}
${data.frame_forensic_probability !== undefined ? `- Frame forensic probability: ${(data.frame_forensic_probability * 100).toFixed(1)}%` : ""}

Instructions:
1. Explain in 2-3 concise sentences WHY the system reached this verdict. Reference specific signals (face model score, forensic score, temporal voting, stability).
2. Be specific and technical but understandable by a non-expert.
3. Do NOT hallucinate — only use the data provided above.
4. Do NOT repeat the raw numbers — interpret them.
5. If the verdict is UNCERTAIN, explain that the system needs more frames to reach a reliable conclusion.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return text.trim();
  } catch (err) {
    console.error("Gemini explanation error:", err.message);
    return "Explanation generation failed. The detection result is still valid based on the ML model output.";
  }
}

// ── Broadcast to all SSE listeners ──────────────────────────────────
export function broadcastEvent(eventData) {
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  for (const controller of listeners) {
    try {
      controller.enqueue(new TextEncoder().encode(payload));
    } catch {
      listeners.delete(controller);
    }
  }
}

// ── GET: SSE stream for dashboard ───────────────────────────────────
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      listeners.add(controller);
      console.log(`[ARGUS SSE] New listener connected. Total: ${listeners.size}`);
      // Send initial connection message
      const init = `data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`;
      controller.enqueue(new TextEncoder().encode(init));
    },
    cancel(controller) {
      listeners.delete(controller);
      console.log(`[ARGUS SSE] Listener disconnected. Total: ${listeners.size}`);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// ── OPTIONS: CORS preflight ─────────────────────────────────────────
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// ── Log deepfake detection to database ──────────────────────────────
async function logDeepfakeDetection(data, severity, action, explanation) {
  try {
    await connectDB();
    
    const verdict = data.confidence_level || 'UNCERTAIN';
    const score = Math.round((data.fake_probability || 0) * 100);
    
    await SecurityAnalytics.create({
      userId: null, // Will be set when user auth is available
      detectionType: 'deepfake',
      detectedAt: new Date(),
      verdict,
      score,
      severity,
      fakeProbability: data.fake_probability,
      frameCount: data.frame_count,
      analysisMode: data.analysis_mode,
      reason: `Frame analysis: ${data.analysis_mode || 'unknown'}`,
      signals: [
        `Temporal average: ${((data.temporal_average || 0) * 100).toFixed(1)}%`,
        `Stability: ${((data.stability_score || 0) * 100).toFixed(1)}%`,
        `Processing: ${data.processing_time_ms || 0}ms`
      ],
      explanation,
      action,
      processingTimeMs: data.processing_time_ms,
      sessionId: `deepfake-${Date.now()}`
    });
  } catch (error) {
    console.error('[ARGUS] Error logging deepfake detection:', error);
    throw error;
  }
}

// ── POST: receive detection result from extension ───────────────────
export async function POST(request) {
  try {
    const data = await request.json();
    console.log(`[ARGUS INGEST] Received frame #${data.frame_count} | fake_prob=${data.fake_probability} | verdict=${data.confidence_level}`);

    // Skip error results (extension sends {error: "..."} on failure)
    if (data.error) {
      console.log('[ARGUS INGEST] Skipping error result');
      return NextResponse.json({ received: false, reason: "error result" }, {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    // Must have fake_probability to be a valid detection result
    if (data.fake_probability === undefined) {
      console.log('[ARGUS INGEST] Skipping: no fake_probability');
      return NextResponse.json({ received: false, reason: "no fake_probability" }, {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    const severity = computeSeverity(data.fake_probability || 0);
    const action = computeAction(severity);
    const currentVerdict = data.confidence_level || "UNCERTAIN";

    // Generate Gemini explanation only when verdict changes
    let explanation = lastExplanation;
    if (currentVerdict !== lastVerdict) {
      console.log(`[ARGUS INGEST] Verdict changed: ${lastVerdict} → ${currentVerdict}, calling Gemini...`);
      explanation = await generateExplanation(data);
      lastVerdict = currentVerdict;
      lastExplanation = explanation;
    }

    lastSeverity = severity;
    lastAction = action;

    const enrichedResult = {
      type: "detection",
      timestamp: Date.now(),
      ...data,
      severity,
      action,
      explanation,
    };

    // Broadcast to any connected dashboard SSE clients
    console.log(`[ARGUS INGEST] Broadcasting to ${listeners.size} SSE clients`);
    broadcastEvent(enrichedResult);

    // Log to database (async, don't block response)
    logDeepfakeDetection(data, severity, action, explanation).catch(err =>
      console.error('[ARGUS INGEST] Failed to log to database:', err.message)
    );

    return NextResponse.json({ received: true }, {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  } catch (err) {
    console.error("[ARGUS INGEST] Error:", err.message);
    return NextResponse.json({ error: err.message }, {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
}
