'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Network, 
  RefreshCw, 
  Trash2, 
  AlertTriangle, 
  Globe, 
  Shield,
  Activity,
  Eye,
  EyeOff,
  Sparkles,
  Brain,
  X,
  Loader2,
  Filter,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

const COLORS = {
  User: '#3b82f6',
  Domain: '#f97316',
  IP: '#a855f7',
  Organization: '#22c55e',
  Threat: '#ef4444',
  AttackCampaign: '#991b1b',
  Registrar: '#06b6d4',
  HostingProvider: '#8b5cf6',
  InteractionEvent: '#64748b',
};

export default function KnowledgeGraphPage() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [filteredGraphData, setFilteredGraphData] = useState({ nodes: [], links: [] });
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('2d');
  const [selectedNode, setSelectedNode] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [graphDimensions, setGraphDimensions] = useState({ width: 800, height: 600 });
  const graphRef = useRef();
  const graphContainerRef = useRef();

  const nodeTypes = Object.keys(COLORS);

  // Track theme changes
  useEffect(() => {
    const updateTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    updateTheme();
    
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  // Track graph container size to explicitly set graph dimensions
  useEffect(() => {
    const container = graphContainerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setGraphDimensions({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  const fetchGraphData = useCallback(async () => {
    try {
      const response = await fetch('/api/graph-data');
      const data = await response.json();
      setGraphData(data);
      
      // Apply filters
      if (selectedFilters.length === 0) {
        setFilteredGraphData(data);
      } else {
        filterGraphData(data, selectedFilters);
      }
    } catch (error) {
      console.error('Failed to fetch graph data:', error);
    }
  }, [selectedFilters]);

  const filterGraphData = (data, filters) => {
    if (filters.length === 0) {
      setFilteredGraphData(data);
      return;
    }

    const filteredNodes = data.nodes.filter(node => filters.includes(node.label));
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = data.links.filter(link => 
      filteredNodeIds.has(link.source) && filteredNodeIds.has(link.target)
    );

    setFilteredGraphData({ nodes: filteredNodes, links: filteredLinks });
  };

  const toggleFilter = (nodeType) => {
    const newFilters = selectedFilters.includes(nodeType)
      ? selectedFilters.filter(f => f !== nodeType)
      : [...selectedFilters, nodeType];
    
    setSelectedFilters(newFilters);
    filterGraphData(graphData, newFilters);
  };

  const clearFilters = () => {
    setSelectedFilters([]);
    setFilteredGraphData(graphData);
  };

  const fetchCampaigns = useCallback(async () => {
    try {
      const response = await fetch('/api/campaign-clusters');
      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    }
  }, []);

  const getAIExplanation = useCallback(async (node) => {
    setLoadingAI(true);
    try {
      const response = await fetch('/api/explain-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node }),
      });
      const data = await response.json();
      setAiExplanation(data.explanation);
    } catch (error) {
      console.error('Failed to get AI explanation:', error);
      setAiExplanation('Unable to generate explanation at this time.');
    } finally {
      setLoadingAI(false);
    }
  }, []);

  const resetGraph = async () => {
    if (!confirm('Reset the entire knowledge graph? This cannot be undone.')) return;
    try {
      await fetch('/api/reset-graph', { method: 'DELETE' });
      await fetchGraphData();
      await fetchCampaigns();
      setSelectedNode(null);
      setAiExplanation(null);
    } catch (error) {
      console.error('Failed to reset graph:', error);
    }
  };

  const refreshData = async () => {
    setLoading(true);
    await Promise.all([fetchGraphData(), fetchCampaigns()]);
    setLoading(false);
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(refreshData, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchGraphData, fetchCampaigns]);

  // Configure d3 forces for better node spacing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (graphRef.current) {
        try {
          const fg = graphRef.current;
          // Strong repulsion to push nodes apart
          fg.d3Force('charge')?.strength(-500).distanceMax(800);
          // Increase link distance
          fg.d3Force('link')?.distance(300);
          // Weak center force to keep graph visible
          fg.d3Force('center')?.strength(0.03);
          // Reheat the simulation to apply new forces
          fg.d3ReheatSimulation?.();
        } catch (error) {
          console.warn('Failed to configure d3 forces:', error);
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [filteredGraphData, viewMode]);

  const handleNodeClick = useCallback((node) => {
    // Clone the node to avoid mutation issues with force-graph internals
    const nodeData = { ...node };
    setSelectedNode(nodeData);
    setRightSidebarOpen(true);
    setAiExplanation(null);
    getAIExplanation(nodeData);
    
    if (graphRef.current && viewMode === '2d') {
      try {
        graphRef.current.centerAt(node.x, node.y, 1000);
        graphRef.current.zoom(2, 1000);
      } catch (error) {
        console.warn('Failed to center graph:', error);
      }
    }
  }, [viewMode, getAIExplanation]);

  const getNodeLabel = useCallback((node) => {
    if (node.label === 'Domain') return node.name;
    if (node.label === 'User') return node.id || 'User';
    if (node.label === 'IP') return node.address;
    if (node.label === 'Organization') return node.name;
    if (node.label === 'AttackCampaign') return `Campaign ${node.domainCount || ''}`;
    return node.name || node.label;
  }, []);

  // Properties to hide from the detail view (internal force-graph / three.js properties)
  const HIDDEN_PROPS = useMemo(() => new Set([
    'x', 'y', 'z', 'vx', 'vy', 'vz', 'fx', 'fy', 'fz',
    'index', '__threeObj', 'color', 'size', '__indexColor'
  ]), []);

  return (
    <div className="min-h-screen">
      <div className="h-screen flex flex-col">
        {/* Top Navigation Bar */}
        <div className="flex-none px-6 py-3 border-b border-border bg-card/80 backdrop-blur-md z-30">
          <div className="flex items-center justify-between gap-6">
            {/* Left Section - Logo + Title */}
            <div className="flex items-center gap-3">
              <Network className="w-6 h-6 text-emerald-500 flex-shrink-0" />
              <div>
                <h1 className="text-base font-bold text-foreground">
                  Threat Intelligence Knowledge Graph
                </h1>
                <p className="text-xs text-muted-foreground">
                  Real-time visualization of browsing activity and cyber threats
                </p>
              </div>
            </div>
            
            {/* Center Section - Graph Controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Tabs value={viewMode} onValueChange={setViewMode}>
                <TabsList className="bg-card/95 backdrop-blur-md border border-border h-9">
                  <TabsTrigger value="2d" className="text-xs px-3">2D</TabsTrigger>
                  <TabsTrigger value="3d" className="text-xs px-3">3D</TabsTrigger>
                </TabsList>
              </Tabs>
              
              <div className="h-6 w-px bg-border" />
              
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                size="sm"
                className="gap-1.5 h-9"
              >
                <Filter className="w-4 h-4" />
                <span className="text-xs">Filters</span>
                {selectedFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                    {selectedFilters.length}
                  </Badge>
                )}
              </Button>

              <Button
                onClick={() => setAutoRefresh(!autoRefresh)}
                variant={autoRefresh ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5 h-9"
              >
                {autoRefresh ? <Activity className="w-4 h-4" /> : <Activity className="w-4 h-4 opacity-50" />}
                <span className="text-xs">{autoRefresh ? 'Live' : 'Pause'}</span>
              </Button>
              
              <Button
                onClick={refreshData}
                disabled={loading}
                variant="outline"
                size="sm"
                className="gap-1.5 h-9"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="text-xs">Refresh</span>
              </Button>
              
              <Button
                onClick={resetGraph}
                variant="destructive"
                size="sm"
                className="gap-1.5 h-9"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-xs">Reset</span>
              </Button>
            </div>

            {/* Right Section - UI Controls */}
            <div className="flex items-center gap-2 flex-shrink-0 mr-20 md:mr-24">
              <Button
                onClick={() => setRightSidebarOpen(prev => !prev)}
                variant="outline"
                size="sm"
                className="gap-1.5 h-9"
              >
                {rightSidebarOpen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="text-xs">Sidebar</span>
              </Button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-card/80 backdrop-blur-md rounded-xl border border-border shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Filter by Node Type</h3>
                {selectedFilters.length > 0 && (
                  <Button onClick={clearFilters} variant="ghost" size="sm">
                    Clear All
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {nodeTypes.map((type) => (
                  <Button
                    key={type}
                    onClick={() => toggleFilter(type)}
                    variant={selectedFilters.includes(type) ? 'default' : 'outline'}
                    size="sm"
                    className="gap-2"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[type] }}
                    />
                    {type}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Sidebar - Statistics */}
          <div 
            className={`flex-shrink-0 border-r border-border bg-card/98 backdrop-blur-xl overflow-y-auto ${
              leftSidebarOpen ? 'w-60' : 'w-0'
            }`}
          >
            {leftSidebarOpen && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-foreground">Graph Statistics</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLeftSidebarOpen(false)}
                    className="h-7 w-7 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 shadow-lg">
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <Globe className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Nodes</p>
                        <p className="text-2xl font-bold text-foreground">
                          {filteredGraphData.nodes?.length || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20 shadow-lg">
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/10">
                        <Activity className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Links</p>
                        <p className="text-2xl font-bold text-foreground">
                          {filteredGraphData.links?.length || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20 shadow-lg">
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500/10">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Campaigns</p>
                        <p className="text-2xl font-bold text-foreground">
                          {campaigns.length}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Node Types Legend */}
                <Card className="bg-card border-border mt-4">
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Node Types</h3>
                    <div className="space-y-2">
                      {Object.entries(COLORS).map(([label, color]) => (
                        <div key={label} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-xs text-foreground">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>

          {/* Left Sidebar Toggle (when closed) */}
          {!leftSidebarOpen && (
            <button
              onClick={() => setLeftSidebarOpen(true)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-card/95 backdrop-blur-md border border-border border-l-0 rounded-r-lg p-2 shadow-lg hover:bg-accent transition-colors"
              title="Open statistics panel"
            >
              <ChevronRight className="w-4 h-4 text-foreground" />
            </button>
          )}

          {/* Graph Visualization - Center Canvas */}
          <div className="flex-1 relative" ref={graphContainerRef}>

            {/* Graph */}
            <div className="w-full h-full">
              {viewMode === '2d' ? (
                <ForceGraph2D
                  ref={graphRef}
                  graphData={filteredGraphData}
                  width={graphDimensions.width}
                  height={graphDimensions.height}
                  nodeLabel={getNodeLabel}
                  nodeColor={(node) => String(node.color || '#6b7280')}
                  nodeRelSize={8}
                  nodeVal={node => (node.size || 5) * 2}
                  linkDirectionalArrowLength={6}
                  linkDirectionalArrowRelPos={1}
                  linkCurvature={0.15}
                  linkWidth={2}
                  linkDirectionalParticles={1}
                  linkDirectionalParticleWidth={2}
                  onNodeClick={handleNodeClick}
                  backgroundColor="transparent"
                  linkColor={() => (isDarkMode ? '#475569' : '#94a3b8')}
                  d3VelocityDecay={0.15}
                  cooldownTime={5000}
                  d3AlphaDecay={0.01}
                  d3AlphaMin={0.001}
                  nodeCanvasObject={(node, ctx, globalScale) => {
                    const label = getNodeLabel(node);
                    const size = (node.size || 5) * 2.5;
                    const fontSize = Math.max(12 / globalScale, 3);
                    
                    // Draw glow for high-risk nodes
                    if (node.riskScore && node.riskScore >= 70) {
                      ctx.beginPath();
                      ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI);
                      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
                      ctx.fill();
                    }
                    
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
                    ctx.fillStyle = String(node.color || '#6b7280');
                    ctx.fill();
                    
                    if (selectedNode && selectedNode.id === node.id) {
                      ctx.strokeStyle = '#22c55e';
                      ctx.lineWidth = 4 / globalScale;
                      ctx.stroke();
                    }
                    
                    if (globalScale > 0.5) {
                      ctx.font = `${fontSize}px Sans-Serif`;
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      ctx.fillStyle = isDarkMode ? '#f8fafc' : '#0f172a';
                      ctx.fillText(label, node.x, node.y + size + fontSize + 2);
                    }
                  }}
                />
              ) : (
                <ForceGraph3D
                  ref={graphRef}
                  graphData={filteredGraphData}
                  width={graphDimensions.width}
                  height={graphDimensions.height}
                  nodeLabel={getNodeLabel}
                  nodeColor={(node) => String(node.color || '#6b7280')}
                  nodeRelSize={6}
                  nodeVal={node => (node.size || 5) * 2}
                  linkDirectionalArrowLength={6}
                  linkDirectionalArrowRelPos={1}
                  linkWidth={2}
                  onNodeClick={handleNodeClick}
                  backgroundColor={isDarkMode ? '#09090b' : '#fafafa'}
                  linkColor={() => (isDarkMode ? '#475569' : '#94a3b8')}
                  d3VelocityDecay={0.15}
                  cooldownTime={5000}
                  d3AlphaDecay={0.01}
                  d3AlphaMin={0.001}
                />
              )}
            </div>
          </div>

          {/* Right Sidebar - Details Panel */}
          <div 
            className={`absolute top-0 right-0 z-30 h-full w-96 border-l border-border bg-card overflow-y-auto shadow-2xl ${
              rightSidebarOpen ? 'block' : 'hidden'
            }`}
          >
            <>
                {/* Header inside sidebar */}
                <div className="sticky top-0 z-10 bg-card border-b border-border p-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Network className="w-4 h-4 text-emerald-500" />
                    Details Panel
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRightSidebarOpen(false)}
                    className="h-7 w-7 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

            <div className="p-4 space-y-4">
              {/* Selected Node Details */}
              {selectedNode ? (
                <Card className="bg-card border-border shadow-lg">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: selectedNode.color || '#6b7280' }}
                        />
                        <Badge variant="outline">{selectedNode.label}</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedNode(null);
                          setAiExplanation(null);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-foreground mb-3 break-words">
                      {getNodeLabel(selectedNode)}
                    </h3>

                    {selectedNode.riskScore !== undefined && (
                      <div className="mb-3">
                        <p className="text-sm text-muted-foreground mb-1">Risk Score</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                selectedNode.riskScore >= 70 ? 'bg-red-500'
                                : selectedNode.riskScore >= 40 ? 'bg-yellow-500'
                                : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(selectedNode.riskScore, 100)}%` }}
                            />
                          </div>
                          <span className="text-foreground font-semibold text-sm">
                            {selectedNode.riskScore}
                          </span>
                        </div>
                      </div>
                    )}

                    {selectedNode.domainAge !== undefined && (
                      <div className="mb-3">
                        <p className="text-sm text-muted-foreground">Domain Age</p>
                        <p className="text-foreground">{selectedNode.domainAge} days</p>
                      </div>
                    )}

                    {selectedNode.country && (
                      <div className="mb-3">
                        <p className="text-sm text-muted-foreground">Location</p>
                        <p className="text-foreground">{selectedNode.city}{selectedNode.city && selectedNode.country ? ', ' : ''}{selectedNode.country}</p>
                      </div>
                    )}

                    {/* All Node Properties */}
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-sm font-semibold text-foreground mb-2">Properties</p>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {Object.entries(selectedNode)
                          .filter(([key]) => !HIDDEN_PROPS.has(key))
                          .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
                          .map(([key, value]) => (
                            <div key={key} className="grid grid-cols-2 gap-2 text-xs py-0.5">
                              <span className="text-muted-foreground capitalize truncate">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </span>
                              <span 
                                className="text-foreground font-mono text-right truncate" 
                                title={String(value)}
                              >
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* AI Explanation */}
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="w-4 h-4 text-emerald-500" />
                        <p className="text-sm font-semibold text-foreground">AI Analysis</p>
                      </div>
                      
                      {loadingAI ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Analyzing...</span>
                        </div>
                      ) : aiExplanation ? (
                        <div className="text-sm text-foreground leading-relaxed bg-muted/50 rounded-lg p-3">
                          {aiExplanation}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="bg-card border-border p-6 text-center">
                  <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                    Click any node to view details and AI analysis
                  </p>
                </Card>
              )}

              {/* Attack Campaigns */}
              <Card className="bg-card border-border">
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-500" />
                    Attack Campaigns ({campaigns.length})
                  </h3>
                  
                  {campaigns.length === 0 ? (
                    <p className="text-muted-foreground text-xs">No campaigns detected</p>
                  ) : (
                    <div className="space-y-2">
                      {campaigns.slice(0, 5).map((campaign) => (
                        <div
                          key={campaign.id}
                          className="bg-muted/50 rounded-lg p-2 border border-border"
                        >
                          <Badge variant="destructive" className="text-xs mb-1">
                            {campaign.domainCount} domains
                          </Badge>
                          <div className="space-y-1">
                            {campaign.domains.slice(0, 2).map((domain) => (
                              <p key={domain} className="text-xs text-foreground font-mono truncate">
                                {domain}
                              </p>
                            ))}
                            {campaign.domains.length > 2 && (
                              <p className="text-xs text-muted-foreground">
                                +{campaign.domains.length - 2} more
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
            </>
          </div>

          {/* Right Sidebar Toggle (when closed) */}
          {!rightSidebarOpen && (
            <button
              onClick={() => setRightSidebarOpen(true)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-card/95 backdrop-blur-md border border-border border-r-0 rounded-l-lg p-2 shadow-lg hover:bg-accent transition-colors"
              title="Open details panel"
            >
              <ChevronRight className="w-4 h-4 text-foreground rotate-180" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
