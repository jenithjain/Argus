"use client";

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from "recharts";
import {
  ArrowUpRight, ArrowDownRight, Activity, 
  Target, Shield, Radio, Eye, Brain, PenTool,
  AlertTriangle, CheckCircle, HelpCircle, XCircle, Clock, Cpu, Layers,
  GitBranch, Loader2
} from "lucide-react";

const MerkleTreeVisualization = lazy(() => import("@/components/MerkleTreeVisualization"));

const CHART_COLORS = {
  light: {
    primary: "#10b981",    // emerald-500
    secondary: "#3b82f6",  // blue-500
    tertiary: "#f59e0b",   // amber-500
    quaternary: "#8b5cf6", // violet-500
    profit: "#10b981",
    revenue: "#3b82f6",
    expenses: "#ef4444",
    portfolio: "#8b5cf6",
    target: "#94a3b8",
  },
  dark: {
    primary: "#34d399",    // emerald-400
    secondary: "#60a5fa",  // blue-400
    tertiary: "#fbbf24",   // amber-400
    quaternary: "#a78bfa", // violet-400
    profit: "#34d399",
    revenue: "#60a5fa",
    expenses: "#f87171",
    portfolio: "#a78bfa",
    target: "#64748b",
  }
};

export default function Dashboard() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [chartColors, setChartColors] = useState(CHART_COLORS.light);

  // ── Live Detection State ─────────────────────────────────────────
  const [liveConnected, setLiveConnected] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [liveResult, setLiveResult] = useState(null);
  const [liveLog, setLiveLog] = useState([]);
  const [probHistory, setProbHistory] = useState([]);
  const eventSourceRef = useRef(null);
  const logEndRef = useRef(null);

  // ── Security Analytics State ─────────────────────────────────────
  const [securityAnalytics, setSecurityAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
      setChartColors(isDark ? CHART_COLORS.dark : CHART_COLORS.light);
    };
    
    updateTheme();
    
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  // ── SSE connection to receive live detection results ──────────────
  useEffect(() => {
    const es = new EventSource('/api/ingest-result');
    eventSourceRef.current = es;

    es.onopen = () => setLiveConnected(true);
    es.onerror = () => setLiveConnected(false);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') {
          setLiveConnected(true);
          return;
        }
        if (data.type === 'detection') {
          setLiveResult(data);
          setLiveLog((prev) => {
            const next = [...prev, data].slice(-30); // keep last 30
            return next;
          });
          setProbHistory((prev) => {
            const next = [...prev, {
              frame: data.frame_count,
              fake: Math.round((data.fake_probability || 0) * 100),
              avg: Math.round((data.temporal_average || 0) * 100),
            }].slice(-50);
            return next;
          });
        }
      } catch {}
    };

    return () => es.close();
  }, []);

  // ── Poll Flask backend health ─────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch('http://localhost:5000/health', { signal: AbortSignal.timeout(3000) });
        setBackendOnline(r.ok);
      } catch { setBackendOnline(false); }
    };
    check();
    const intv = setInterval(check, 5000);
    return () => clearInterval(intv);
  }, []);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveLog]);

  // ── Fetch Security Analytics ─────────────────────────────────────
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setAnalyticsLoading(true);
        const tzOffset = new Date().getTimezoneOffset();
        const response = await fetch(`/api/security-analytics?days=30&limit=100&tzOffset=${tzOffset}`);
        const data = await response.json();
        if (data.success) {
          setSecurityAnalytics(data);
        }
      } catch (error) {
        console.error('[Dashboard] Failed to fetch security analytics:', error);
      } finally {
        setAnalyticsLoading(false);
      }
    };

    fetchAnalytics();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, []);

  const PIE_COLORS = [
    chartColors.primary,
    chartColors.secondary,
    chartColors.tertiary,
    chartColors.quaternary,
  ];

  const StatCard = ({ title, value, change, icon: Icon, trend }) => (
    <Card className="overflow-hidden border-border/40 backdrop-blur-sm bg-card/50 hover:bg-card/70 transition-all duration-300 hover:scale-105 hover:shadow-lg group cursor-pointer">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground ivy-font group-hover:text-foreground transition-colors">
          {title}
        </CardTitle>
        <div className="p-2 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500 transition-colors">
          <Icon className="h-4 w-4 text-emerald-500 group-hover:text-white transition-colors" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground ivy-font">{value}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          {trend === "up" ? (
            <ArrowUpRight className="h-3 w-3 text-emerald-500" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-red-500" />
          )}
          <span className={trend === "up" ? "text-emerald-500" : "text-red-500"}>
            {change}
          </span>
          <span>from last month</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen w-full overflow-x-hidden [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
      <div className="container mx-auto p-6 space-y-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground ivy-font mb-2">
              Security Operations Dashboard
            </h1>
            <p className="text-muted-foreground ivy-font">
              Monitor threat detections, active defense modules, and your overall security posture
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="px-3 py-1 ivy-font">
              Module 5 - Active
            </Badge>
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white ivy-font">
              <PenTool className="h-4 w-4 mr-2" />
              Open Extension
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Detections"
            value={analyticsLoading ? "..." : securityAnalytics?.summary?.total?.toLocaleString() ?? "0"}
            change="Active"
            icon={Activity}
            trend="up"
          />
          <StatCard
            title="Threats Blocked"
            value={analyticsLoading ? "..." : securityAnalytics?.summary?.recentThreats?.toLocaleString() ?? "0"}
            change={securityAnalytics?.summary?.total ? `${((securityAnalytics.summary.recentThreats / securityAnalytics.summary.total) * 100).toFixed(1)}%` : "0%"}
            icon={Shield}
            trend="up"
          />
          <StatCard
            title="Critical Alerts"
            value={analyticsLoading ? "..." : (securityAnalytics?.summary?.bySeverity?.CRITICAL || 0).toLocaleString()}
            change="Action Required"
            icon={AlertTriangle}
            trend={securityAnalytics?.summary?.bySeverity?.CRITICAL > 0 ? "down" : "up"}
          />
          <StatCard
            title="Avg Risk Score"
            value={analyticsLoading ? "..." : `${securityAnalytics?.summary?.avgScore ?? 0}`}
            change="Risk Average"
            icon={Target}
            trend={securityAnalytics?.summary?.avgScore > 50 ? "down" : "up"}
          />
        </div>

        {/* Main Charts */}
        <Tabs defaultValue="securityanalytics" className="space-y-4">
          <TabsList className="bg-muted/50 backdrop-blur-sm">
            <TabsTrigger value="securityanalytics" className="ivy-font flex items-center gap-1.5">
              <Shield className="h-3 w-3" />
              Security Analytics
            </TabsTrigger>
            <TabsTrigger value="livedetection" className="ivy-font flex items-center gap-1.5">
              <Radio className="h-3 w-3 animate-pulse text-red-500" />
              Live Detection
            </TabsTrigger>
            <TabsTrigger value="merkletree" className="ivy-font flex items-center gap-1.5">
              <GitBranch className="h-3 w-3 text-emerald-500" />
              Merkle Tree
            </TabsTrigger>
          </TabsList>

          {/* ══════════════════════════════════════════════════════════
              LIVE DETECTION TAB
              ═══════════════════════════════════════════════════════ */}
          <TabsContent value="livedetection" className="space-y-4">
            {/* Status Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className={`flex items-center gap-1.5 px-3 py-1 ${backendOnline ? 'border-emerald-500/50 text-emerald-500' : 'border-red-500/50 text-red-500'}`}>
                <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                Backend {backendOnline ? 'Online' : 'Offline'}
              </Badge>
              <Badge variant="outline" className={`flex items-center gap-1.5 px-3 py-1 ${liveConnected ? 'border-blue-500/50 text-blue-500' : 'border-yellow-500/50 text-yellow-500'}`}>
                <span className={`w-2 h-2 rounded-full ${liveConnected ? 'bg-blue-500 animate-pulse' : 'bg-yellow-500'}`} />
                SSE {liveConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              {liveResult && (
                <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1 border-slate-500/50 text-slate-400">
                  <Cpu className="h-3 w-3" />
                  {liveResult.processing_time_ms || 0}ms/frame
                </Badge>
              )}
              {liveResult && (
                <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1 border-slate-500/50 text-slate-400">
                  <Layers className="h-3 w-3" />
                  {liveResult.analysis_mode === 'face+frame' ? 'Face + Frame' : 'Frame Only'}
                </Badge>
              )}
            </div>

            {!liveResult ? (
              /* Empty state */
              <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Eye className="h-16 w-16 text-muted-foreground/30 mb-6" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">No Detection Data Yet</h3>
                  <p className="text-muted-foreground max-w-md">
                    Start the ARGUS browser extension on any tab with a video. Detection results will appear here in real-time as frames are analyzed.
                  </p>
                  <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                    <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    Backend: {backendOnline ? 'Ready' : 'Not running — start backend_server.py'}
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Live data UI */
              <div className="space-y-4">
                {/* Row 1: Verdict + Severity + Stats */}
                <div className="grid gap-4 md:grid-cols-4">
                  {/* Verdict */}
                  <Card className="border-border/40 backdrop-blur-sm bg-card/50 col-span-1">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Verdict</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        {liveResult.confidence_level === 'FAKE' && <XCircle className="h-8 w-8 text-red-500" />}
                        {liveResult.confidence_level === 'REAL' && <CheckCircle className="h-8 w-8 text-emerald-500" />}
                        {(liveResult.confidence_level === 'UNCERTAIN' || !liveResult.confidence_level) && <HelpCircle className="h-8 w-8 text-yellow-500" />}
                        <span className={`text-2xl font-bold ${
                          liveResult.confidence_level === 'FAKE' ? 'text-red-500' :
                          liveResult.confidence_level === 'REAL' ? 'text-emerald-500' : 'text-yellow-500'
                        }`}>
                          {liveResult.confidence_level || 'UNCERTAIN'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Severity */}
                  <Card className="border-border/40 backdrop-blur-sm bg-card/50 col-span-1">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Severity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <AlertTriangle className={`h-8 w-8 ${
                          liveResult.severity === 'CRITICAL' ? 'text-red-500' :
                          liveResult.severity === 'HIGH' ? 'text-orange-500' :
                          liveResult.severity === 'MEDIUM' ? 'text-yellow-500' : 'text-emerald-500'
                        }`} />
                        <span className={`text-2xl font-bold ${
                          liveResult.severity === 'CRITICAL' ? 'text-red-500' :
                          liveResult.severity === 'HIGH' ? 'text-orange-500' :
                          liveResult.severity === 'MEDIUM' ? 'text-yellow-500' : 'text-emerald-500'
                        }`}>
                          {liveResult.severity}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Fake Probability */}
                  <Card className="border-border/40 backdrop-blur-sm bg-card/50 col-span-1">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Fake Probability</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-foreground">
                        {((liveResult.fake_probability || 0) * 100).toFixed(1)}%
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            (liveResult.fake_probability || 0) > 0.55 ? 'bg-red-500' :
                            (liveResult.fake_probability || 0) > 0.3 ? 'bg-yellow-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${(liveResult.fake_probability || 0) * 100}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Frames & Stability */}
                  <Card className="border-border/40 backdrop-blur-sm bg-card/50 col-span-1">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Temporal Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Frames</span>
                        <span className="font-mono font-bold">{liveResult.frame_count || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Temporal Avg</span>
                        <span className="font-mono font-bold">{((liveResult.temporal_average || 0) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Stability</span>
                        <span className="font-mono font-bold">{((liveResult.stability_score || 0) * 100).toFixed(1)}%</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Row 2: Gemini Explanation + Recommended Action */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Brain className="h-5 w-5 text-purple-500" />
                        AI Explanation
                      </CardTitle>
                      <CardDescription>
                        Gemini 2.0 Flash — explains WHY this verdict was reached
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground leading-relaxed">
                        {liveResult.explanation || 'Waiting for first verdict change to generate explanation...'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className={`border-border/40 backdrop-blur-sm ${
                    liveResult.severity === 'CRITICAL' ? 'bg-red-500/5 border-red-500/20' :
                    liveResult.severity === 'HIGH' ? 'bg-orange-500/5 border-orange-500/20' :
                    liveResult.severity === 'MEDIUM' ? 'bg-yellow-500/5 border-yellow-500/20' :
                    'bg-emerald-500/5 border-emerald-500/20'
                  }`}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Shield className={`h-5 w-5 ${
                          liveResult.severity === 'CRITICAL' ? 'text-red-500' :
                          liveResult.severity === 'HIGH' ? 'text-orange-500' :
                          liveResult.severity === 'MEDIUM' ? 'text-yellow-500' : 'text-emerald-500'
                        }`} />
                        Recommended Action
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground font-medium">
                        {liveResult.action || 'No action needed.'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Row 3: Live probability chart */}
                {probHistory.length > 1 && (
                  <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-blue-500" />
                        Live Probability Timeline
                      </CardTitle>
                      <CardDescription>
                        Per-frame fake probability and rolling temporal average
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={probHistory}>
                          <defs>
                            <linearGradient id="colorLiveFake" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                          <XAxis dataKey="frame" stroke={isDarkMode ? '#94a3b8' : '#64748b'} style={{ fontSize: '11px' }} />
                          <YAxis domain={[0, 100]} stroke={isDarkMode ? '#94a3b8' : '#64748b'} style={{ fontSize: '11px' }} />
                          <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, borderRadius: '8px', color: isDarkMode ? '#f1f5f9' : '#0f172a' }} />
                          <Area type="monotone" dataKey="fake" stroke="#ef4444" fillOpacity={1} fill="url(#colorLiveFake)" strokeWidth={2} name="Fake %" />
                          <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Temporal Avg" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Row 4: Frame log */}
                <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-amber-500" />
                      Frame Analysis Log
                    </CardTitle>
                    <CardDescription>
                      Last {liveLog.length} frames analyzed in real-time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-64 overflow-y-auto space-y-1 font-mono text-xs pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
                      {liveLog.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">Waiting for frames...</p>
                      ) : (
                        liveLog.map((entry, i) => (
                          <div key={i} className={`flex items-center gap-3 px-3 py-1.5 rounded ${
                            entry.confidence_level === 'FAKE' ? 'bg-red-500/5' :
                            entry.confidence_level === 'REAL' ? 'bg-emerald-500/5' : 'bg-muted/30'
                          }`}>
                            <span className="text-muted-foreground w-12">#{entry.frame_count}</span>
                            <span className={`w-20 font-semibold ${
                              entry.confidence_level === 'FAKE' ? 'text-red-500' :
                              entry.confidence_level === 'REAL' ? 'text-emerald-500' : 'text-yellow-500'
                            }`}>
                              {entry.confidence_level || 'UNCERTAIN'}
                            </span>
                            <span className="text-muted-foreground">
                              {entry.analysis_mode === 'face+frame' ? 'Face+Frame' : 'Frame'}
                            </span>
                            <span className="text-foreground">
                              Fake: {((entry.fake_probability || 0) * 100).toFixed(0)}%
                            </span>
                            <span className="text-muted-foreground">
                              {entry.processing_time_ms || 0}ms
                            </span>
                          </div>
                        ))
                      )}
                      <div ref={logEndRef} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              SECURITY ANALYTICS TAB
              ═══════════════════════════════════════════════════════ */}
          <TabsContent value="securityanalytics" className="space-y-4">
            {analyticsLoading ? (
              <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                <CardContent className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <Cpu className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4 animate-pulse" />
                    <p className="text-muted-foreground">Loading security analytics...</p>
                  </div>
                </CardContent>
              </Card>
            ) : !securityAnalytics ? (
              <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                <CardContent className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">No security analytics available</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Total Detections</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-foreground">{securityAnalytics.summary.total}</div>
                      <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
                    </CardContent>
                  </Card>

                  <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Threats Blocked</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-red-500">{securityAnalytics.summary.recentThreats}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {((securityAnalytics.summary.recentThreats / securityAnalytics.summary.total) * 100).toFixed(1)}% threat rate
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Average Risk Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-yellow-500">{securityAnalytics.summary.avgScore}</div>
                      <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            securityAnalytics.summary.avgScore >= 70 ? 'bg-red-500' :
                            securityAnalytics.summary.avgScore >= 40 ? 'bg-yellow-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${securityAnalytics.summary.avgScore}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Critical Alerts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-orange-500">
                        {securityAnalytics.summary.bySeverity.CRITICAL || 0}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Require immediate action</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Detection Type Distribution */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                    <CardHeader>
                      <CardTitle className="ivy-font">Detection by Type</CardTitle>
                      <CardDescription className="ivy-font">
                        Distribution across URL, Email, and Deepfake modules
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'URL Analysis', value: securityAnalytics.summary.byType.url || 0 },
                              { name: 'Email Analysis', value: securityAnalytics.summary.byType.email || 0 },
                              { name: 'Deepfake Detection', value: securityAnalytics.summary.byType.deepfake || 0 }
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            <Cell fill={chartColors.primary} />
                            <Cell fill={chartColors.secondary} />
                            <Cell fill={chartColors.tertiary} />
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                              border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                              borderRadius: '8px'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: chartColors.primary }} />
                            <span className="text-sm text-muted-foreground ivy-font">URL Analysis</span>
                          </div>
                          <span className="text-sm font-medium ivy-font">{securityAnalytics.summary.byType.url || 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: chartColors.secondary }} />
                            <span className="text-sm text-muted-foreground ivy-font">Email Analysis</span>
                          </div>
                          <span className="text-sm font-medium ivy-font">{securityAnalytics.summary.byType.email || 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: chartColors.tertiary }} />
                            <span className="text-sm text-muted-foreground ivy-font">Deepfake Detection</span>
                          </div>
                          <span className="text-sm font-medium ivy-font">{securityAnalytics.summary.byType.deepfake || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                    <CardHeader>
                      <CardTitle className="ivy-font">Severity Distribution</CardTitle>
                      <CardDescription className="ivy-font">
                        Breakdown by threat severity level
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={[
                            { severity: 'Critical', count: securityAnalytics.summary.bySeverity.CRITICAL || 0 },
                            { severity: 'High', count: securityAnalytics.summary.bySeverity.HIGH || 0 },
                            { severity: 'Medium', count: securityAnalytics.summary.bySeverity.MEDIUM || 0 },
                            { severity: 'Low', count: securityAnalytics.summary.bySeverity.LOW || 0 }
                          ]}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                          <XAxis dataKey="severity" stroke={isDarkMode ? '#94a3b8' : '#64748b'} style={{ fontSize: '12px' }} />
                          <YAxis stroke={isDarkMode ? '#94a3b8' : '#64748b'} style={{ fontSize: '12px' }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                              border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                              borderRadius: '8px'
                            }}
                          />
                          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                            <Cell fill="#ef4444" />
                            <Cell fill="#f97316" />
                            <Cell fill="#eab308" />
                            <Cell fill="#22c55e" />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Time Series Chart */}
                {securityAnalytics.timeSeries && securityAnalytics.timeSeries.length > 0 && (
                  <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                    <CardHeader>
                      <CardTitle className="ivy-font">Detection Timeline</CardTitle>
                      <CardDescription className="ivy-font">
                        Daily detection activity and threat trends
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={securityAnalytics.timeSeries}>
                          <defs>
                            <linearGradient id="colorDetections" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={chartColors.secondary} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={chartColors.secondary} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorThreats" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                          <XAxis dataKey="date" stroke={isDarkMode ? '#94a3b8' : '#64748b'} style={{ fontSize: '11px' }} />
                          <YAxis stroke={isDarkMode ? '#94a3b8' : '#64748b'} style={{ fontSize: '11px' }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                              border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                              borderRadius: '8px'
                            }}
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="count"
                            stroke={chartColors.secondary}
                            fillOpacity={1}
                            fill="url(#colorDetections)"
                            strokeWidth={2}
                            name="Total Detections"
                          />
                          <Area
                            type="monotone"
                            dataKey="threats"
                            stroke="#ef4444"
                            fillOpacity={1}
                            fill="url(#colorThreats)"
                            strokeWidth={2}
                            name="Threats Blocked"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Detections Log */}
                <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                  <CardHeader>
                    <CardTitle className="ivy-font">Recent Detections</CardTitle>
                    <CardDescription className="ivy-font">
                      Latest security threats and analysis results
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2 overflow-x-hidden [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
                      {securityAnalytics.recentDetections && securityAnalytics.recentDetections.length > 0 ? (
                        securityAnalytics.recentDetections.map((detection, idx) => (
                          <div
                            key={idx}
                            className={`p-4 rounded-lg border ${
                              detection.severity === 'CRITICAL' ? 'border-red-500/30 bg-red-500/5' :
                              detection.severity === 'HIGH' ? 'border-orange-500/30 bg-orange-500/5' :
                              detection.severity === 'MEDIUM' ? 'border-yellow-500/30 bg-yellow-500/5' :
                              'border-emerald-500/30 bg-emerald-500/5'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="text-xs">
                                    {detection.detectionType.toUpperCase()}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${
                                      detection.severity === 'CRITICAL' ? 'border-red-500 text-red-500' :
                                      detection.severity === 'HIGH' ? 'border-orange-500 text-orange-500' :
                                      detection.severity === 'MEDIUM' ? 'border-yellow-500 text-yellow-500' :
                                      'border-emerald-500 text-emerald-500'
                                    }`}
                                  >
                                    {detection.severity}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(detection.detectedAt).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-foreground mb-1">
                                  {detection.detectionType === 'url' && (detection.url || 'Unknown URL')}
                                  {detection.detectionType === 'email' && `${detection.emailSender || 'Unknown Sender'} - ${detection.emailSubject || 'No Subject'}`}
                                  {detection.detectionType === 'deepfake' && `Frame ${detection.frameCount || 0} - ${detection.verdict || 'UNCERTAIN'}`}
                                </p>
                                <p className="text-xs text-muted-foreground">{detection.reason}</p>
                                {detection.signals && detection.signals.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {detection.signals.slice(0, 3).map((signal, i) => (
                                      <span key={i} className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                        {signal}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="text-right ml-4">
                                <div className={`text-2xl font-bold ${
                                  detection.verdict === 'MALICIOUS' || detection.verdict === 'FAKE' ? 'text-red-500' :
                                  detection.verdict === 'HIGH_RISK' ? 'text-orange-500' :
                                  detection.verdict === 'SUSPICIOUS' || detection.verdict === 'UNCERTAIN' ? 'text-yellow-500' :
                                  'text-emerald-500'
                                }`}>
                                  {detection.score}
                                </div>
                                <div className="text-xs text-muted-foreground">Risk Score</div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No recent detections</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              MERKLE TREE TAB
              ═══════════════════════════════════════════════════════ */}
          <TabsContent value="merkletree" className="space-y-4">
            <Suspense
              fallback={
                <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                  <CardContent className="flex items-center justify-center py-16">
                    <div className="text-center space-y-4">
                      <Loader2 className="h-12 w-12 text-emerald-500 animate-spin mx-auto" />
                      <p className="text-muted-foreground">Loading Merkle Tree visualization...</p>
                    </div>
                  </CardContent>
                </Card>
              }
            >
              <MerkleTreeVisualization isDarkMode={isDarkMode} />
            </Suspense>
          </TabsContent>

        </Tabs>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
