"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GitBranch, RefreshCw, Loader2, Shield, AlertTriangle,
  Lock, Hash, Layers, ChevronDown, Eye, Copy, Check,
  Globe, Mail, Video, TreePine, Fingerprint
} from "lucide-react";

// ── Custom Merkle Node Component ────────────────────────────────────────
function MerkleNodeComponent({ data, selected }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const copyHash = useCallback(() => {
    navigator.clipboard.writeText(data.hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [data.hash]);

  // Determine colors based on node type and severity
  const getNodeStyle = () => {
    if (data.nodeType === "root") {
      return {
        bg: "from-emerald-500/20 via-emerald-500/10 to-cyan-500/10",
        border: "border-emerald-500/50",
        glow: "shadow-emerald-500/20",
        iconColor: "text-emerald-400",
        hashColor: "text-emerald-300",
        label: "MERKLE ROOT",
        labelBg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      };
    }

    if (data.nodeType === "leaf") {
      const sevMap = {
        CRITICAL: {
          bg: "from-red-500/20 via-red-500/10 to-rose-500/10",
          border: "border-red-500/50",
          glow: "shadow-red-500/20",
          iconColor: "text-red-400",
          hashColor: "text-red-300",
        },
        HIGH: {
          bg: "from-orange-500/20 via-orange-500/10 to-amber-500/10",
          border: "border-orange-500/50",
          glow: "shadow-orange-500/20",
          iconColor: "text-orange-400",
          hashColor: "text-orange-300",
        },
        MEDIUM: {
          bg: "from-yellow-500/20 via-yellow-500/10 to-amber-500/10",
          border: "border-yellow-500/50",
          glow: "shadow-yellow-500/20",
          iconColor: "text-yellow-400",
          hashColor: "text-yellow-300",
        },
        LOW: {
          bg: "from-emerald-500/15 via-emerald-500/5 to-teal-500/10",
          border: "border-emerald-500/40",
          glow: "shadow-emerald-500/15",
          iconColor: "text-emerald-400",
          hashColor: "text-emerald-300",
        },
      };

      const s = sevMap[data.severity] || sevMap.LOW;
      return {
        ...s,
        label: data.detectionType?.toUpperCase() || "THREAT",
        labelBg: `${
          data.severity === "CRITICAL" ? "bg-red-500/20 text-red-400 border-red-500/30" :
          data.severity === "HIGH" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
          data.severity === "MEDIUM" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
          "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
        }`,
      };
    }

    // Internal node
    return {
      bg: "from-blue-500/15 via-indigo-500/10 to-violet-500/10",
      border: "border-blue-500/30",
      glow: "shadow-blue-500/10",
      iconColor: "text-blue-400",
      hashColor: "text-blue-300",
      label: "HASH",
      labelBg: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    };
  };

  const style = getNodeStyle();

  const DetectionIcon = data.detectionType === "url" ? Globe :
    data.detectionType === "email" ? Mail :
    data.detectionType === "deepfake" ? Video :
    data.nodeType === "root" ? Fingerprint : Hash;

  return (
    <div
      className={`
        relative group transition-all duration-300
        ${selected ? "scale-110 z-50" : "hover:scale-105"}
      `}
    >
      {/* Glow effect */}
      <div className={`absolute inset-0 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${style.glow} bg-current`} />

      {/* Main node */}
      <div
        className={`
          relative rounded-xl border backdrop-blur-xl
          bg-gradient-to-br ${style.bg} ${style.border}
          shadow-lg ${style.glow}
          transition-all duration-300
          ${data.nodeType === "root" ? "min-w-[200px]" : data.nodeType === "leaf" ? "min-w-[180px]" : "min-w-[160px]"}
        `}
      >
        {/* Input handle (from parent) */}
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-emerald-300/50 !rounded-full"
        />

        {/* Output handle (to children) */}
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-blue-500 !border-2 !border-blue-300/50 !rounded-full"
        />

        <div className="p-3 space-y-2">
          {/* Header: Label + Icon */}
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border ${style.labelBg}`}>
              {style.label}
            </span>
            <DetectionIcon className={`h-4 w-4 ${style.iconColor}`} />
          </div>

          {/* Hash */}
          <div className="flex items-center gap-1.5">
            <code className={`text-[11px] font-mono ${style.hashColor} truncate flex-1`}>
              {data.shortHash}
            </code>
            <button
              onClick={copyHash}
              className="p-0.5 rounded hover:bg-white/10 transition-colors"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground" />
              )}
            </button>
          </div>

          {/* Leaf node details */}
          {data.nodeType === "leaf" && data.logData && (
            <div className="space-y-1.5 pt-1 border-t border-white/5">
              {/* Severity badge */}
              <div className="flex items-center gap-1.5">
                <AlertTriangle className={`h-3 w-3 ${style.iconColor}`} />
                <span className="text-[10px] text-muted-foreground">
                  {data.logData.severity} · Score: {data.logData.score}
                </span>
              </div>

              {/* Verdict */}
              <div className="flex items-center gap-1.5">
                <Shield className={`h-3 w-3 ${style.iconColor}`} />
                <span className={`text-[10px] font-semibold ${
                  data.logData.verdict === "MALICIOUS" || data.logData.verdict === "FAKE" ? "text-red-400" :
                  data.logData.verdict === "HIGH_RISK" ? "text-orange-400" :
                  data.logData.verdict === "SUSPICIOUS" || data.logData.verdict === "UNCERTAIN" ? "text-yellow-400" :
                  "text-emerald-400"
                }`}>
                  {data.logData.verdict}
                </span>
              </div>

              {/* Detection detail */}
              {expanded && (
                <div className="text-[10px] text-muted-foreground/70 space-y-0.5 animate-fade-in">
                  {data.logData.url && (
                    <p className="truncate">🌐 {data.logData.url.slice(0, 40)}</p>
                  )}
                  {data.logData.emailSender && (
                    <p className="truncate">📧 {data.logData.emailSender}</p>
                  )}
                  {data.logData.reason && (
                    <p className="truncate">💡 {data.logData.reason.slice(0, 50)}</p>
                  )}
                  {data.logData.detectedAt && (
                    <p>🕐 {new Date(data.logData.detectedAt).toLocaleString()}</p>
                  )}
                </div>
              )}

              {/* Expand toggle */}
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-[9px] text-muted-foreground/50 hover:text-muted-foreground transition-colors w-full justify-center pt-0.5"
              >
                <Eye className="h-2.5 w-2.5" />
                {expanded ? "Less" : "Details"}
                <ChevronDown className={`h-2.5 w-2.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
            </div>
          )}

          {/* Root node extra info */}
          {data.nodeType === "root" && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-emerald-500/20">
              <Lock className="h-3 w-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-300/70 font-medium">
                Tamper-Proof Root
              </span>
            </div>
          )}

          {/* Internal node label */}
          {data.nodeType === "internal" && (
            <div className="flex items-center gap-1.5">
              <Layers className="h-3 w-3 text-blue-400/50" />
              <span className="text-[9px] text-muted-foreground/40">
                Level {data.level}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Node types registry ─────────────────────────────────────────────────
const nodeTypes = {
  merkleNode: MerkleNodeComponent,
};

// ── Main Component ──────────────────────────────────────────────────────
export default function MerkleTreeVisualization({ isDarkMode }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [treeData, setTreeData] = useState(null);
  const [logLimit, setLogLimit] = useState(16);
  const [filterType, setFilterType] = useState("all");
  const [rootCopied, setRootCopied] = useState(false);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/merkle-tree?limit=${logLimit}&days=30&type=${filterType}`
      );
      const data = await res.json();

      if (data.success && data.tree.nodes?.length > 0) {
        setTreeData(data);
        setNodes(data.tree.nodes);
        setEdges(data.tree.edges);
      } else {
        setTreeData(null);
        setNodes([]);
        setEdges([]);
      }
    } catch (err) {
      console.error("[MerkleTree] Fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [logLimit, filterType, setNodes, setEdges]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const copyMerkleRoot = useCallback(() => {
    if (treeData?.merkleRoot) {
      navigator.clipboard.writeText(treeData.merkleRoot);
      setRootCopied(true);
      setTimeout(() => setRootCopied(false), 2000);
    }
  }, [treeData]);

  // Custom edge styles for dark mode
  const edgeStyleOverrides = useMemo(() => {
    return edges.map(edge => ({
      ...edge,
      style: {
        ...edge.style,
        stroke: edge.style?.strokeDasharray
          ? (isDarkMode ? '#475569' : '#94a3b8')
          : edge.style?.stroke,
      },
    }));
  }, [edges, isDarkMode]);

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={fetchTree}
          disabled={loading}
          className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm h-8 px-3"
          size="sm"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          )}
          Rebuild Tree
        </Button>

        {/* Limit selector */}
        <div className="flex items-center gap-1.5">
          <TreePine className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={logLimit}
            onChange={(e) => setLogLimit(Number(e.target.value))}
            className="text-xs bg-muted/50 border border-border/40 rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          >
            <option value={8}>8 Logs</option>
            <option value={16}>16 Logs</option>
            <option value={32}>32 Logs</option>
            <option value={64}>64 Logs</option>
          </select>
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs bg-muted/50 border border-border/40 rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          >
            <option value="all">All Types</option>
            <option value="url">URL Only</option>
            <option value="email">Email Only</option>
            <option value="deepfake">Deepfake Only</option>
          </select>
        </div>

        {/* Merkle Root Display */}
        {treeData?.merkleRoot && (
          <div className="flex items-center gap-2 ml-auto">
            <Badge
              variant="outline"
              className="flex items-center gap-1.5 px-3 py-1.5 border-emerald-500/30 bg-emerald-500/5 font-mono text-xs cursor-pointer hover:bg-emerald-500/10 transition-colors"
              onClick={copyMerkleRoot}
            >
              <Fingerprint className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-500 hidden sm:inline">Root:</span>
              <span className="text-emerald-400">
                {treeData.merkleRoot.substring(0, 12)}...{treeData.merkleRoot.substring(52)}
              </span>
              {rootCopied ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3 text-emerald-500/50" />
              )}
            </Badge>
          </div>
        )}
      </div>

      {/* Tree info badges */}
      {treeData && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs border-border/40">
            <Layers className="h-3 w-3 mr-1" />
            Depth: {treeData.tree.treeDepth}
          </Badge>
          <Badge variant="outline" className="text-xs border-border/40">
            <Hash className="h-3 w-3 mr-1" />
            Leaves: {treeData.totalLogs}
          </Badge>
          <Badge variant="outline" className="text-xs border-border/40">
            <GitBranch className="h-3 w-3 mr-1" />
            Nodes: {treeData.tree.nodes?.length || 0}
          </Badge>
        </div>
      )}

      {/* Main Visualization */}
      <Card className="border-border/40 backdrop-blur-sm bg-card/50 overflow-hidden">
        <div className="h-[600px] w-full relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-2 border-emerald-500/20 animate-ping absolute inset-0 mx-auto" />
                  <Loader2 className="h-16 w-16 text-emerald-500 animate-spin mx-auto relative" />
                </div>
                <p className="text-muted-foreground text-sm">Building Merkle tree from threat logs...</p>
              </div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-3">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
                <p className="text-red-400 text-sm">{error}</p>
                <Button onClick={fetchTree} variant="outline" size="sm">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Retry
                </Button>
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="relative mx-auto w-20 h-20">
                  <TreePine className="h-20 w-20 text-muted-foreground/20 mx-auto" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No Threat Logs Yet</h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  The Merkle tree will be built from your threat detection logs.
                  Use the ARGUS extension to scan URLs, emails, or videos to generate threat data.
                </p>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edgeStyleOverrides}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.1}
              maxZoom={2}
              attributionPosition="bottom-left"
              proOptions={{ hideAttribution: true }}
              className="merkle-tree-flow"
            >
              <Background
                variant="dots"
                gap={20}
                size={1}
                color={isDarkMode ? "#1e293b" : "#e2e8f0"}
              />
              <Controls
                className="!bg-card/80 !border-border/40 !backdrop-blur-sm !rounded-lg !shadow-lg [&>button]:!bg-card/80 [&>button]:!border-border/30 [&>button]:!text-foreground [&>button:hover]:!bg-muted"
              />
              <MiniMap
                nodeColor={(node) => {
                  if (node.data?.nodeType === "root") return "#22c55e";
                  if (node.data?.nodeType === "leaf") {
                    const sev = node.data?.severity;
                    if (sev === "CRITICAL") return "#ef4444";
                    if (sev === "HIGH") return "#f97316";
                    if (sev === "MEDIUM") return "#eab308";
                    return "#22c55e";
                  }
                  return "#3b82f6";
                }}
                maskColor={isDarkMode ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)"}
                className="!bg-card/60 !border-border/40 !backdrop-blur-sm !rounded-lg"
              />

              {/* Floating legend panel */}
              <Panel position="top-right" className="!m-3">
                <div className="bg-card/80 backdrop-blur-xl border border-border/40 rounded-xl p-3 space-y-2 shadow-lg min-w-[140px]">
                  <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Legend</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-muted-foreground">Merkle Root</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span className="text-[10px] text-muted-foreground">Internal Hash</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span className="text-[10px] text-muted-foreground">Critical Threat</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                      <span className="text-[10px] text-muted-foreground">High Severity</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                      <span className="text-[10px] text-muted-foreground">Medium Severity</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] text-muted-foreground">Low Severity</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-border/20">
                      <div className="w-5 h-0 border-t-2 border-dashed border-slate-500" />
                      <span className="text-[10px] text-muted-foreground">Duplicate Leaf</span>
                    </div>
                  </div>
                </div>
              </Panel>
            </ReactFlow>
          )}
        </div>
      </Card>

      {/* Pipeline explanation */}
      <Card className="border-border/40 backdrop-blur-sm bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-emerald-500" />
            Integrity Pipeline
          </CardTitle>
          <CardDescription className="text-xs">
            How threat logs are cryptographically secured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[
              { icon: Globe, label: "Chrome Extension", color: "text-blue-400" },
              { icon: Shield, label: "Backend API", color: "text-indigo-400" },
              { icon: AlertTriangle, label: "Threat Detection", color: "text-yellow-400" },
              { icon: Hash, label: "Threat Log Entry", color: "text-orange-400" },
              { icon: TreePine, label: "Merkle Tree Builder", color: "text-emerald-400" },
              { icon: Fingerprint, label: "Merkle Root Stored", color: "text-cyan-400" },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {i > 0 && (
                  <span className="text-muted-foreground/30 mx-1">→</span>
                )}
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/30 border border-border/20 ${step.color}`}>
                  <step.icon className="h-3 w-3" />
                  <span className="text-foreground/80 font-medium">{step.label}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
