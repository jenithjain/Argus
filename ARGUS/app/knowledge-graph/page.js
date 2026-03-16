'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ThemeToggle from '@/components/ThemeToggle';
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
  Filter
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const graphRef = useRef();

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

  const getAIExplanation = async (node) => {
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
  };

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

  const handleNodeClick = useCallback((node) => {
    console.log('Node clicked:', node);
    console.log('Setting selectedNode and opening sidebar');
    setSelectedNode(node);
    setSidebarOpen(true);
    setAiExplanation(null);
    getAIExplanation(node);
    
    if (graphRef.current && viewMode === '2d') {
      try {
        graphRef.current.centerAt(node.x, node.y, 1000);
        graphRef.current.zoom(2, 1000);
      } catch (error) {
        console.warn('Failed to center graph:', error);
      }
    }
  }, [viewMode]);

  const getNodeLabel = (node) => {
    if (node.label === 'Domain') return node.name;
    if (node.label === 'User') return node.id || 'User';
    if (node.label === 'IP') return node.address;
    if (node.label === 'Organization') return node.name;
    if (node.label === 'AttackCampaign') return `Campaign ${node.domainCount || ''}`;
    return node.name || node.label;
  };

  return (
    <div className="min-h-screen">
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="flex-none px-6 py-4 border-b border-border bg-card/80 backdrop-blur-md">
          <div className="max-w-[1800px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Network className="w-7 h-7 text-emerald-500" />
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Threat Intelligence Knowledge Graph
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Real-time visualization of browsing activity and cyber threats
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <ThemeToggle />
              
              <Button
                onClick={() => {
                  console.log('Sidebar toggle clicked, current state:', sidebarOpen);
                  setSidebarOpen(!sidebarOpen);
                }}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {sidebarOpen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {sidebarOpen ? 'Hide' : 'Show'} Sidebar
              </Button>
              
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Filter className="w-4 h-4" />
                Filters
                {selectedFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {selectedFilters.length}
                  </Badge>
                )}
              </Button>

              <Button
                onClick={() => setAutoRefresh(!autoRefresh)}
                variant={autoRefresh ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
              >
                {autoRefresh ? <Activity className="w-4 h-4" /> : <Activity className="w-4 h-4 opacity-50" />}
                {autoRefresh ? 'Live' : 'Paused'}
              </Button>
              
              <Button
                onClick={refreshData}
                disabled={loading}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Button
                onClick={resetGraph}
                variant="destructive"
                size="sm"
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Reset
              </Button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="max-w-[1800px] mx-auto mt-4 p-4 bg-card/80 backdrop-blur-md rounded-lg border border-border shadow-lg">
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
        <div className="flex-1 flex overflow-hidden">
          {/* Graph Visualization */}
          <div className={`relative ${sidebarOpen ? 'flex-1' : 'w-full'}`}>
            {/* Stats Overlay */}
            <div className="absolute top-4 left-4 z-10 flex gap-3">
              <Card className="bg-card/95 border-border backdrop-blur-md p-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Nodes</p>
                    <p className="text-lg font-bold text-foreground">
                      {filteredGraphData.nodes?.length || 0}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="bg-card/95 border-border backdrop-blur-md p-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Links</p>
                    <p className="text-lg font-bold text-foreground">
                      {filteredGraphData.links?.length || 0}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="bg-card/95 border-border backdrop-blur-md p-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Campaigns</p>
                    <p className="text-lg font-bold text-foreground">{campaigns.length}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* View Mode Toggle */}
            <div className="absolute top-4 right-4 z-10">
              <Tabs value={viewMode} onValueChange={setViewMode}>
                <TabsList className="bg-card/95 backdrop-blur-md border border-border shadow-lg">
                  <TabsTrigger value="2d">2D View</TabsTrigger>
                  <TabsTrigger value="3d">3D View</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Graph */}
            <div className="w-full h-full">
              {viewMode === '2d' ? (
                <ForceGraph2D
                  ref={graphRef}
                  graphData={filteredGraphData}
                  nodeLabel={getNodeLabel}
                  nodeColor={(node) => String(node.color || '#6b7280')}
                  nodeRelSize={12}
                  nodeVal={node => (node.size || 5) * 3}
                  linkDirectionalArrowLength={8}
                  linkDirectionalArrowRelPos={1}
                  linkCurvature={0.2}
                  linkWidth={3}
                  linkDirectionalParticles={2}
                  linkDirectionalParticleWidth={2}
                  linkDistance={150}
                  onNodeClick={handleNodeClick}
                  backgroundColor="transparent"
                  linkColor={() => (isDarkMode ? '#94a3b8' : '#64748b')}
                  d3VelocityDecay={0.3}
                  cooldownTime={3000}
                  d3AlphaDecay={0.02}
                  d3AlphaMin={0.001}
                  nodeCanvasObject={(node, ctx, globalScale) => {
                    const label = getNodeLabel(node);
                    const size = (node.size || 5) * 3;
                    const fontSize = 14 / globalScale;
                    
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
                    ctx.fillStyle = String(node.color || '#6b7280');
                    ctx.fill();
                    
                    if (selectedNode && selectedNode.id === node.id) {
                      ctx.strokeStyle = '#22c55e';
                      ctx.lineWidth = 4 / globalScale;
                      ctx.stroke();
                    }
                    
                    ctx.font = `${fontSize}px Sans-Serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = isDarkMode ? '#f8fafc' : '#0f172a';
                    ctx.fillText(label, node.x, node.y + size + fontSize);
                  }}
                />
              ) : (
                <ForceGraph3D
                  ref={graphRef}
                  graphData={filteredGraphData}
                  nodeLabel={getNodeLabel}
                  nodeColor={(node) => String(node.color || '#6b7280')}
                  nodeRelSize={12}
                  nodeVal={node => (node.size || 5) * 3}
                  linkDirectionalArrowLength={8}
                  linkDirectionalArrowRelPos={1}
                  linkWidth={3}
                  linkDistance={150}
                  onNodeClick={handleNodeClick}
                  backgroundColor="transparent"
                  linkColor={() => (isDarkMode ? '#94a3b8' : '#64748b')}
                />
              )}
            </div>
          </div>

          {/* Right Sidebar - Toggleable */}
          {sidebarOpen && (
            <div className="w-96 min-w-[384px] flex-shrink-0 border-l border-border bg-card/95 backdrop-blur-md overflow-y-auto shadow-2xl">
              <div className="p-4 space-y-4">
              {console.log('Sidebar rendering, selectedNode:', selectedNode, 'sidebarOpen:', sidebarOpen)}
              {/* Selected Node Details */}
              {selectedNode ? (
                <Card className="bg-card border-border shadow-lg">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: selectedNode.color }}
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
                              style={{ width: `${selectedNode.riskScore}%` }}
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
                        <p className="text-foreground">{selectedNode.city}, {selectedNode.country}</p>
                      </div>
                    )}

                    {/* AI Explanation */}
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="w-4 h-4 text-emerald-500" />
                        <p className="text-sm font-semibold text-foreground">AI Analysis</p>
                      </div>
                      
                      {loadingAI ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Analyzing with Gemini AI...</span>
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

              {/* Legend */}
              <Card className="bg-card border-border">
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Node Types</h3>
                  <div className="space-y-2">
                    {Object.entries(COLORS).map(([label, color]) => (
                      <div key={label} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs text-foreground">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
