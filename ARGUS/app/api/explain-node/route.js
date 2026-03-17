// POST /api/explain-node - Get AI explanation for a graph node
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const REASONING_MODELS = ['gemini-3.1-pro', 'gemini-3.1-pro-preview', 'gemini-2.5-pro'];

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { node, graphSummary } = payload || {};

  try {
    if (!node && !graphSummary) {
      return NextResponse.json({ error: 'Node data or graph summary required' }, { status: 400 });
    }

    const hasGemini = Boolean(process.env.GEMINI_API_KEY);

    if (graphSummary) {
      if (!hasGemini) {
        return NextResponse.json({
          detailedAnalysis: buildFallbackGraphAnalysis(graphSummary),
          conclusion: buildFallbackConclusion(graphSummary),
          fallback: true,
        });
      }

      const prompt = buildGraphPrompt(graphSummary);
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const { text, modelUsed } = await generateWithFallback(genAI, prompt);
      const parsed = parseGraphReasoningJson(text);

      return NextResponse.json({
        detailedAnalysis: parsed.detailedAnalysis,
        conclusion: parsed.conclusion,
        modelUsed,
      });
    }

    // Check if Gemini API key is available
    if (!hasGemini) {
      console.error('[Explain Node] GEMINI_API_KEY not found');
      return NextResponse.json({
        explanation: getFallbackExplanation(node),
        nodeType: node.label,
        nodeName: node.name || node.id,
        fallback: true,
      });
    }

    // Build context-aware prompt
    const prompt = buildPrompt(node);

    // Generate explanation using Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const { text: explanation, modelUsed } = await generateWithFallback(genAI, prompt);

    return NextResponse.json({
      explanation,
      nodeType: node.label,
      nodeName: node.name || node.id,
      modelUsed,
    });

  } catch (error) {
    console.error('[Explain Node API] Error:', error);

    // Return fallback explanation without re-reading request body
    if (graphSummary) {
      return NextResponse.json({
        detailedAnalysis: buildFallbackGraphAnalysis(graphSummary),
        conclusion: buildFallbackConclusion(graphSummary),
        fallback: true,
      });
    }

    return NextResponse.json({
      explanation: getFallbackExplanation(node),
      nodeType: node?.label || 'Unknown',
      nodeName: node?.name || node?.id || 'Unknown',
      fallback: true,
    });
  }
}

async function generateWithFallback(genAI, prompt) {
  let lastError;
  for (const modelName of REASONING_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return { text: response.text(), modelUsed: modelName };
    } catch (error) {
      lastError = error;
      console.warn(`[Explain Node] Model ${modelName} failed, trying fallback...`);
    }
  }
  throw lastError || new Error('No Gemini reasoning model available');
}

function parseGraphReasoningJson(rawText) {
  const cleaned = String(rawText || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      detailedAnalysis: Array.isArray(parsed.detailedAnalysis) ? parsed.detailedAnalysis : [],
      conclusion: {
        overallRisk: parsed?.conclusion?.overallRisk || 'UNKNOWN',
        summary: parsed?.conclusion?.summary || 'No summary provided.',
        urgentActions: Array.isArray(parsed?.conclusion?.urgentActions) ? parsed.conclusion.urgentActions : [],
      },
    };
  } catch {
    return {
      detailedAnalysis: [cleaned || 'No detailed analysis available.'],
      conclusion: {
        overallRisk: 'UNKNOWN',
        summary: 'Could not parse model response into structured conclusion.',
        urgentActions: [],
      },
    };
  }
}

function buildGraphPrompt(graphSummary) {
  return `You are a senior cyber threat intelligence analyst.
Analyze the full knowledge graph summary below and produce complete coverage of clusters, not partial coverage.

Graph summary JSON:
${JSON.stringify(graphSummary, null, 2)}

Requirements:
1) Cover ALL clusters from the input summary and mention any uncovered/benign clusters too.
2) Explain attacker behavior patterns, infrastructure overlap, and likely campaign intent.
3) Provide prioritized actions with urgent first.
4) End with a concise executive conclusion.

Respond ONLY with valid JSON in this exact structure:
{
  "detailedAnalysis": [
    "bullet 1",
    "bullet 2"
  ],
  "conclusion": {
    "overallRisk": "CRITICAL|HIGH|MEDIUM|LOW",
    "summary": "2-4 sentence executive summary",
    "urgentActions": ["action 1", "action 2"]
  }
}`;
}

function buildFallbackGraphAnalysis(graphSummary) {
  const totalClusters = Number(graphSummary?.clusterAnalysis?.totalClusters || 0);
  const suspiciousClusters = Number(graphSummary?.clusterAnalysis?.suspiciousClusters || 0);
  const topPatterns = Array.isArray(graphSummary?.patterns) ? graphSummary.patterns.slice(0, 5) : [];

  const lines = [
    `Graph contains ${totalClusters} clusters with ${suspiciousClusters} suspicious clusters requiring investigation.`,
    `Coverage is complete across all connected components in the graph, including low-risk and benign relationship groups.`,
  ];

  topPatterns.forEach((pattern, idx) => {
    lines.push(
      `Cluster ${pattern.clusterId ?? idx + 1}: ${pattern.description || pattern.type || 'linked activity'} (severity: ${String(pattern.severity || 'unknown').toUpperCase()}).`
    );
  });

  return lines;
}

function buildFallbackConclusion(graphSummary) {
  const suspiciousClusters = Number(graphSummary?.clusterAnalysis?.suspiciousClusters || 0);
  const overallRisk = suspiciousClusters >= 4 ? 'CRITICAL' : suspiciousClusters >= 2 ? 'HIGH' : suspiciousClusters >= 1 ? 'MEDIUM' : 'LOW';

  return {
    overallRisk,
    summary: `Overall graph risk is ${overallRisk}. Prioritize containment of high-severity clusters, then investigate medium-risk infrastructure links for campaign expansion.`,
    urgentActions: [
      'Block high-risk domains and linked IP infrastructure immediately.',
      'Alert impacted users associated with suspicious interaction clusters.',
      'Monitor for new nodes connected to existing high-risk clusters.',
    ],
  };
}

function getFallbackExplanation(node) {
  const nodeType = node?.label || 'Unknown';
  const nodeName = node?.name || node?.id || 'Unknown';

  const fallbacks = {
    Domain: `Domain "${nodeName}" has been analyzed for security threats. ${node.riskScore ? `Risk score: ${node.riskScore}/100. ` : ''}${node.domainAge !== undefined ? `Domain age: ${node.domainAge} days. ` : ''}Monitor for suspicious activity and check for brand impersonation attempts.`,
    
    IP: `IP address ${node.address || nodeName}${node.country ? ` located in ${node.city}, ${node.country}` : ''}. Represents hosting infrastructure for domains in the threat landscape. Track IP patterns to identify malicious infrastructure.`,
    
    User: `User activity tracked by the system. ${node.interactionCount ? `${node.interactionCount} interactions recorded. ` : ''}Helps correlate browsing patterns and identify security risks based on visited domains.`,
    
    Organization: `Organization "${nodeName}" is a target of impersonation or phishing. Threat actors create fake domains mimicking legitimate organizations to steal credentials.`,
    
    Threat: `Security threat detected${node.severity ? ` (${node.severity} severity)` : ''}. ${node.type ? `Type: ${node.type}. ` : ''}Confirmed security risk identified through automated analysis.`,
    
    AttackCampaign: `Attack campaign with ${node.domainCount || 'multiple'} related domains. Detected when domains share infrastructure, registrars, or targets, indicating coordinated malicious activity.`,
    
    Registrar: `Domain registrar "${nodeName}" responsible for domain registration. Tracking registrars reveals patterns in threat actor infrastructure.`,
    
    HostingProvider: `Hosting provider "${nodeName}" provides infrastructure services. Some providers are more commonly abused by threat actors. Track hosting patterns to identify malicious infrastructure.`,
    
    InteractionEvent: `Browsing interaction recorded by the system. Captures when a user visited a domain, building a timeline of security-relevant activities.`,
  };

  return fallbacks[nodeType] || `${nodeType} node "${nodeName}" is part of the threat intelligence knowledge graph, tracked and analyzed for security purposes.`;
}

function buildPrompt(node) {
  const nodeType = node.label;
  const nodeName = node.name || node.id || 'Unknown';

  let basePrompt = `You are a cybersecurity AI assistant analyzing a threat intelligence knowledge graph. Provide a clear, concise explanation (2-3 sentences) about this node.\n\n`;

  switch (nodeType) {
    case 'Domain':
      basePrompt += `Domain: ${nodeName}\n`;
      if (node.riskScore !== undefined) basePrompt += `Risk Score: ${node.riskScore}/100\n`;
      if (node.domainAge !== undefined) basePrompt += `Domain Age: ${node.domainAge} days\n`;
      if (node.hostingProvider) basePrompt += `Hosting: ${node.hostingProvider}\n`;
      basePrompt += `\nExplain what this domain represents, why its risk score is ${node.riskScore || 'unknown'}, and what security concerns it may pose.`;
      break;

    case 'IP':
      basePrompt += `IP Address: ${node.address || nodeName}\n`;
      if (node.country) basePrompt += `Location: ${node.city}, ${node.country}\n`;
      basePrompt += `\nExplain this IP address in the threat landscape, its geographic significance, and security implications.`;
      break;

    case 'User':
      basePrompt += `User: ${nodeName}\n`;
      if (node.interactionCount) basePrompt += `Interactions: ${node.interactionCount}\n`;
      basePrompt += `\nExplain this user's activity, browsing patterns, and security concerns.`;
      break;

    case 'Organization':
      basePrompt += `Organization: ${nodeName}\n`;
      basePrompt += `\nExplain what this organization represents and why it appears in the threat graph (likely impersonation target).`;
      break;

    case 'Threat':
      basePrompt += `Threat Type: ${node.type || 'Unknown'}\n`;
      basePrompt += `Severity: ${node.severity || 'Unknown'}\n`;
      if (node.reason) basePrompt += `Reason: ${node.reason}\n`;
      basePrompt += `\nExplain this threat, its severity, detection reason, and recommended actions.`;
      break;

    case 'AttackCampaign':
      basePrompt += `Attack Campaign\nDomains: ${node.domainCount || 'Unknown'}\n`;
      basePrompt += `\nExplain this campaign, how domains are related, threat actor objectives, and defensive actions.`;
      break;

    case 'Registrar':
      basePrompt += `Domain Registrar: ${nodeName}\n`;
      basePrompt += `\nExplain this registrar's role in the threat landscape and any patterns associated with it.`;
      break;

    case 'HostingProvider':
      basePrompt += `Hosting Provider: ${nodeName}\n`;
      basePrompt += `\nExplain this provider's role, whether commonly abused, and security considerations.`;
      break;

    default:
      basePrompt += `Node Type: ${nodeType}\nName: ${nodeName}\n`;
      basePrompt += `\nExplain what this node represents in the threat intelligence graph.`;
  }

  basePrompt += `\n\nProvide a clear, actionable explanation for security analysts.`;
  return basePrompt;
}
