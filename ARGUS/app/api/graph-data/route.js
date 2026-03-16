// GET /api/graph-data - Retrieve knowledge graph data for visualization
import { NextResponse } from 'next/server';
import { getGraphData } from '@/lib/graph-builder';

export async function GET(request) {
  try {
    const graphData = await getGraphData();

    // Transform for react-force-graph format
    const nodes = graphData.nodes.map(node => {
      const nodeId = typeof node.id === 'object' ? node.id.toString() : String(node.id);
      return {
        id: nodeId,
        label: node.label,
        name: node.properties.name || node.properties.id || node.label,
        ...node.properties,
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
        const sourceId = typeof link.source === 'object' ? link.source.toString() : String(link.source);
        const targetId = typeof link.target === 'object' ? link.target.toString() : String(link.target);
        return validNodeIds.has(sourceId) && validNodeIds.has(targetId);
      })
      .map(link => {
        const sourceId = typeof link.source === 'object' ? link.source.toString() : String(link.source);
        const targetId = typeof link.target === 'object' ? link.target.toString() : String(link.target);
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
