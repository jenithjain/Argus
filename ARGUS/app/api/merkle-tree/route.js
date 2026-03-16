import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import SecurityAnalytics from '@/lib/models/SecurityAnalytics';
import { buildMerkleTree, getMerkleProof } from '@/lib/merkle-tree';

/**
 * GET /api/merkle-tree
 * 
 * Pipeline:
 *   Chrome Extension → Backend API → Threat Detection → Threat Log Entry → Merkle Tree Builder → Merkle Root Stored
 * 
 * Fetches threat logs from SecurityAnalytics, builds a Merkle tree,
 * and returns the tree structure (nodes + edges) for React Flow visualization.
 * 
 * Query params:
 *   - limit: max number of logs to include in tree (default: 16, max: 64)
 *   - days: look-back period in days (default: 30)
 *   - type: filter by 'url', 'email', 'deepfake', or 'all' (default: 'all')
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '16'), 64);
    const days = parseInt(searchParams.get('days') || '30');
    const type = searchParams.get('type') || 'all';

    await connectDB();

    // Build query
    const query = {};
    if (type !== 'all') {
      query.detectionType = type;
    }
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    query.detectedAt = { $gte: startDate };

    // Fetch logs ordered by most recent
    const logs = await SecurityAnalytics
      .find(query)
      .sort({ detectedAt: -1 })
      .limit(limit)
      .lean();

    if (logs.length === 0) {
      return NextResponse.json({
        success: true,
        tree: { root: null, levels: [], leaves: [], nodes: [], edges: [] },
        totalLogs: 0,
        message: 'No threat logs found for the selected period.',
      });
    }

    // Build Merkle tree
    const tree = buildMerkleTree(logs);

    return NextResponse.json({
      success: true,
      tree: {
        root: tree.root,
        treeDepth: tree.treeDepth,
        totalLogs: tree.totalLogs,
        nodes: tree.nodes,
        edges: tree.edges,
        leaves: tree.leaves,
      },
      merkleRoot: tree.root,
      totalLogs: logs.length,
    });

  } catch (error) {
    console.error('[ARGUS /api/merkle-tree] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/merkle-tree
 * 
 * Verify a specific leaf's inclusion in the Merkle tree.
 * Body: { leafIndex: number, limit?: number, days?: number }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { leafIndex, limit: bodyLimit, days: bodyDays } = body;
    const limit = Math.min(bodyLimit || 16, 64);
    const days = bodyDays || 30;

    await connectDB();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await SecurityAnalytics
      .find({ detectedAt: { $gte: startDate } })
      .sort({ detectedAt: -1 })
      .limit(limit)
      .lean();

    if (logs.length === 0 || leafIndex < 0 || leafIndex >= logs.length) {
      return NextResponse.json({
        success: false,
        error: 'Invalid leaf index or no logs found.'
      }, { status: 400 });
    }

    const tree = buildMerkleTree(logs);
    const proof = getMerkleProof(tree.leaves, leafIndex);

    return NextResponse.json({
      success: true,
      proof,
      merkleRoot: tree.root,
      log: tree.leaves[leafIndex]?.log,
    });

  } catch (error) {
    console.error('[ARGUS /api/merkle-tree] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
