import crypto from 'crypto';

/**
 * Merkle Tree Implementation for ARGUS Threat Logs
 * 
 * Pipeline:
 *   Chrome Extension → Backend API → Threat Detection → Threat Log Entry → Merkle Tree Builder → Merkle Root Stored
 * 
 * Each leaf node is a SHA-256 hash of a serialized threat log entry.
 * Internal nodes are SHA-256(left_child || right_child).
 * If odd number of leaves, the last leaf is duplicated.
 */

/**
 * Hash a string using SHA-256
 */
export function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Create a leaf hash from a threat log entry
 */
export function hashThreatLog(log) {
  const serialized = JSON.stringify({
    id: log._id?.toString() || log.id,
    detectionType: log.detectionType,
    detectedAt: log.detectedAt,
    verdict: log.verdict,
    score: log.score,
    severity: log.severity,
    reason: log.reason,
  });
  return sha256(serialized);
}

/**
 * Build a Merkle Tree from an array of threat log hashes
 * Returns the full tree structure for visualization
 * 
 * @param {Array} logs - Array of SecurityAnalytics documents
 * @returns {{ root: string, levels: Array<Array<{hash: string, left?: string, right?: string}>>, leaves: Array<{hash: string, log: object}> }}
 */
export function buildMerkleTree(logs) {
  if (!logs || logs.length === 0) {
    return { root: null, levels: [], leaves: [], nodes: [], edges: [] };
  }

  // Step 1: Create leaf hashes
  const leaves = logs.map(log => ({
    hash: hashThreatLog(log),
    log: {
      id: log._id?.toString() || log.id,
      detectionType: log.detectionType,
      detectedAt: log.detectedAt,
      verdict: log.verdict,
      score: log.score,
      severity: log.severity,
      reason: log.reason,
      url: log.url,
      emailSender: log.emailSender,
      emailSubject: log.emailSubject,
    }
  }));

  // Step 2: Build tree levels bottom-up
  const levels = [leaves.map(l => ({ hash: l.hash }))];
  let currentLevel = leaves.map(l => l.hash);

  while (currentLevel.length > 1) {
    const nextLevel = [];
    const levelNodes = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = (i + 1 < currentLevel.length) ? currentLevel[i + 1] : currentLevel[i]; // duplicate if odd
      const parentHash = sha256(left + right);
      nextLevel.push(parentHash);
      levelNodes.push({
        hash: parentHash,
        left,
        right,
        isDuplicate: i + 1 >= currentLevel.length,
      });
    }

    levels.push(levelNodes);
    currentLevel = nextLevel;
  }

  const root = currentLevel[0];

  // Step 3: Build React Flow nodes and edges for visualization
  const { nodes, edges } = buildReactFlowData(leaves, levels);

  return {
    root,
    levels,
    leaves,
    totalLogs: logs.length,
    treeDepth: levels.length,
    nodes,
    edges,
  };
}

/**
 * Build React Flow compatible nodes and edges from the Merkle tree
 */
function buildReactFlowData(leaves, levels) {
  const nodes = [];
  const edges = [];
  const totalLevels = levels.length;

  // We build from the root (top) down to the leaves (bottom)
  // levels[0] = leaves, levels[last] = root
  // For React Flow, we want root at top

  // Calculate positions
  const HORIZONTAL_SPACING = 220;
  const VERTICAL_SPACING = 140;

  for (let levelIdx = levels.length - 1; levelIdx >= 0; levelIdx--) {
    const level = levels[levelIdx];
    const row = totalLevels - 1 - levelIdx; // root = row 0
    const levelWidth = level.length * HORIZONTAL_SPACING;
    const startX = -levelWidth / 2 + HORIZONTAL_SPACING / 2;

    for (let nodeIdx = 0; nodeIdx < level.length; nodeIdx++) {
      const item = level[nodeIdx];
      const nodeId = `${levelIdx}-${nodeIdx}`;
      const isLeaf = levelIdx === 0;
      const isRoot = levelIdx === levels.length - 1;

      // Determine node type and styling
      let nodeType = 'internal';
      let severity = null;
      let detectionType = null;
      let logData = null;

      if (isLeaf && leaves[nodeIdx]) {
        nodeType = 'leaf';
        logData = leaves[nodeIdx].log;
        severity = logData?.severity;
        detectionType = logData?.detectionType;
      } else if (isRoot) {
        nodeType = 'root';
      }

      nodes.push({
        id: nodeId,
        type: 'merkleNode',
        position: {
          x: startX + nodeIdx * HORIZONTAL_SPACING,
          y: row * VERTICAL_SPACING,
        },
        data: {
          hash: item.hash,
          shortHash: item.hash.substring(0, 8) + '...' + item.hash.substring(56),
          nodeType,
          severity,
          detectionType,
          logData,
          isDuplicate: item.isDuplicate || false,
          level: levelIdx,
        },
      });

      // Create edges to children
      if (levelIdx > 0 && item.left) {
        const leftChildIdx = nodeIdx * 2;
        const rightChildIdx = nodeIdx * 2 + 1;

        // Edge to left child
        if (leftChildIdx < levels[levelIdx - 1].length) {
          edges.push({
            id: `e-${nodeId}-${levelIdx - 1}-${leftChildIdx}`,
            source: nodeId,
            target: `${levelIdx - 1}-${leftChildIdx}`,
            type: 'smoothstep',
            animated: false,
            style: { stroke: '#22c55e', strokeWidth: 2 },
          });
        }

        // Edge to right child
        if (rightChildIdx < levels[levelIdx - 1].length) {
          edges.push({
            id: `e-${nodeId}-${levelIdx - 1}-${rightChildIdx}`,
            source: nodeId,
            target: `${levelIdx - 1}-${rightChildIdx}`,
            type: 'smoothstep',
            animated: false,
            style: {
              stroke: item.isDuplicate ? '#64748b' : '#3b82f6',
              strokeWidth: 2,
              strokeDasharray: item.isDuplicate ? '5 5' : undefined,
            },
          });
        } else if (item.isDuplicate) {
          // Connect to the same left child (duplicate)
          edges.push({
            id: `e-${nodeId}-dup-${levelIdx - 1}-${leftChildIdx}`,
            source: nodeId,
            target: `${levelIdx - 1}-${leftChildIdx}`,
            type: 'smoothstep',
            animated: false,
            style: { stroke: '#64748b', strokeWidth: 2, strokeDasharray: '5 5' },
          });
        }
      }
    }
  }

  return { nodes, edges };
}

/**
 * Verify a leaf's inclusion in the tree by computing a Merkle proof
 */
export function getMerkleProof(leaves, leafIndex) {
  if (leafIndex < 0 || leafIndex >= leaves.length) return null;

  const proof = [];
  let currentLevel = leaves.map(l => l.hash || hashThreatLog(l));
  let idx = leafIndex;

  while (currentLevel.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = (i + 1 < currentLevel.length) ? currentLevel[i + 1] : currentLevel[i];

      if (i === idx || i + 1 === idx) {
        proof.push({
          hash: i === idx ? right : left,
          position: i === idx ? 'right' : 'left',
        });
      }

      nextLevel.push(sha256(left + right));
    }

    idx = Math.floor(idx / 2);
    currentLevel = nextLevel;
  }

  return {
    leaf: leaves[leafIndex].hash || hashThreatLog(leaves[leafIndex]),
    root: currentLevel[0],
    proof,
  };
}
