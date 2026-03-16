// POST /api/explain-node - Get AI explanation for a graph node
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request) {
  try {
    const { node } = await request.json();

    if (!node) {
      return NextResponse.json({ error: 'Node data required' }, { status: 400 });
    }

    // Check if Gemini API key is available
    if (!process.env.GEMINI_API_KEY) {
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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const explanation = response.text();

    return NextResponse.json({
      explanation,
      nodeType: node.label,
      nodeName: node.name || node.id,
    });

  } catch (error) {
    console.error('[Explain Node API] Error:', error);
    
    // Return fallback explanation
    try {
      const { node } = await request.json();
      return NextResponse.json({
        explanation: getFallbackExplanation(node),
        nodeType: node?.label || 'Unknown',
        nodeName: node?.name || node?.id || 'Unknown',
        fallback: true,
      });
    } catch {
      return NextResponse.json({
        explanation: 'This node is part of the threat intelligence knowledge graph.',
        fallback: true,
      });
    }
  }
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
