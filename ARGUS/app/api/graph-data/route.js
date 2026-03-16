// GET /api/graph-data - Retrieve knowledge graph data for visualization
import { NextResponse } from 'next/server';
import { getGraphData } from '@/lib/graph-builder';

// ── Neo4j helpers ──────────────────────────────────────────────────────────
// Neo4j integers arrive as objects with { low, high } keys.
// We must convert them to plain JS numbers/strings before sending to React.

function neo4jToJs(val) {
  if (val === null || val === undefined) return val;
  // Neo4j Integer object: { low: number, high: number }
  if (typeof val === 'object' && 'low' in val && 'high' in val) {
    // For values that fit in a safe JS number use low directly
    if (val.high === 0 || val.high === -1) return val.low;
    // Large integers: convert via BigInt-style math
    return Number(BigInt(val.high) * BigInt(2 ** 32) + BigInt(val.low >>> 0));
  }
  return val;
}

function sanitizeNeo4jProps(props) {
  if (!props || typeof props !== 'object') return props;
  const clean = {};
  for (const [key, val] of Object.entries(props)) {
    if (val === null || val === undefined) {
      clean[key] = val;
    } else if (Array.isArray(val)) {
      clean[key] = val.map(v => (typeof v === 'object' && v !== null && 'low' in v && 'high' in v) ? neo4jToJs(v) : v);
    } else if (typeof val === 'object' && 'low' in val && 'high' in val) {
      clean[key] = neo4jToJs(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

function safeId(raw) {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'object' && 'low' in raw && 'high' in raw) return String(neo4jToJs(raw));
  return String(raw);
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function GET(request) {
  try {
    const graphData = await getGraphData();

    // Transform for react-force-graph format
    const nodes = graphData.nodes.map(node => {
      const nodeId = safeId(node.id);
      const cleanProps = sanitizeNeo4jProps(node.properties || {});
      return {
        id: nodeId,
        label: node.label,
        name: cleanProps.name || cleanProps.id || node.label,
        ...cleanProps,
        // Color coding by node type
        color: getNodeColor(node.label),
        size: getNodeSize(node.label),
      };
    });

    // Create a Set of valid node IDs for quick lookup
    const validNodeIds = new Set(nodes.map(n => n.id));

    // Filter and transform links to ensure valid source and target
    const links = graphData.links
      .filter(link => {
        if (!link.source || !link.target) return false;
        const sourceId = safeId(link.source);
        const targetId = safeId(link.target);
        return validNodeIds.has(sourceId) && validNodeIds.has(targetId);
      })
      .map(link => {
        const sourceId = safeId(link.source);
        const targetId = safeId(link.target);
        return {
          source: sourceId,
          target: targetId,
          type: link.type,
          label: link.type,
        };
      });

    console.log(`[Graph Data] Returning ${nodes.length} nodes and ${links.length} links`);

    return NextResponse.json({
      nodes,
      links,
      stats: {
        nodeCount: nodes.length,
        linkCount: links.length,
        nodeTypes: [...new Set(nodes.map(n => n.label))],
      },
    });

  } catch (error) {
    console.error('[Graph Data API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve graph data' },
      { status: 500 }
    );
  }
}

function getNodeColor(label) {
  const colors = {
    User: '#3b82f6',           // blue
    Domain: '#f97316',         // orange
    IP: '#a855f7',             // purple
    Organization: '#22c55e',   // green
    Threat: '#ef4444',         // red
    AttackCampaign: '#991b1b', // dark red
    Registrar: '#06b6d4',      // cyan
    HostingProvider: '#8b5cf6', // violet
    InteractionEvent: '#64748b', // slate
  };
  return colors[label] || '#6b7280';
}

function getNodeSize(label) {
  const sizes = {
    User: 8,
    Domain: 6,
    IP: 5,
    Organization: 7,
    Threat: 6,
    AttackCampaign: 10,
    Registrar: 5,
    HostingProvider: 6,
    InteractionEvent: 3,
  };
  return sizes[label] || 5;
}
