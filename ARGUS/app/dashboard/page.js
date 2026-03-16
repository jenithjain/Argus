"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ComposedChart, Scatter
} from "recharts";
import {
  ArrowUpRight, ArrowDownRight, BookOpen, TrendingUp,
  Users, Activity, GitBranch, FileText, Sparkles, Brain,
  PenTool, Target, Network, Shield, Radio, Eye, Zap,
  AlertTriangle, CheckCircle, HelpCircle, XCircle, Clock, Cpu, Layers
} from "lucide-react";

// Threat Detection Data
const progressData = [
  { chapter: "S1", wordCount: 4500, targetCount: 5000, completion: 90 },
  { chapter: "S2", wordCount: 5200, targetCount: 5000, completion: 100 },
  { chapter: "S3", wordCount: 4800, targetCount: 5000, completion: 96 },
  { chapter: "S4", wordCount: 6100, targetCount: 5000, completion: 100 },
  { chapter: "S5", wordCount: 5500, targetCount: 5000, completion: 100 },
  { chapter: "S6", wordCount: 6700, targetCount: 5000, completion: 100 },
  { chapter: "S7", wordCount: 7200, targetCount: 5000, completion: 100 },
  { chapter: "S8", wordCount: 6900, targetCount: 5000, completion: 100 },
  { chapter: "S9", wordCount: 3200, targetCount: 5000, completion: 64 },
  { chapter: "S10", wordCount: 0, targetCount: 5000, completion: 0 },
  { chapter: "S11", wordCount: 0, targetCount: 5000, completion: 0 },
  { chapter: "S12", wordCount: 0, targetCount: 5000, completion: 0 },
];

const characterActivityData = [
  { name: "Phishing", appearances: 28, dialogueLines: 284, arcProgress: 85 },
  { name: "Malware", appearances: 22, dialogueLines: 223, arcProgress: 72 },
  { name: "Social Eng.", appearances: 18, dialogueLines: 182, arcProgress: 68 },
  { name: "Data Exfil.", appearances: 15, dialogueLines: 151, arcProgress: 55 },
];

const storyElementsData = [
  { id: 1, type: "Phishing", element: "Credential harvesting on login page", status: "Active", chapters: "Session 1-9" },
  { id: 2, type: "Malware", element: "Suspicious download redirect", status: "Active", chapters: "Session 1-9" },
  { id: 3, type: "Social Engineering", element: "Fake tech support popup", status: "Active", chapters: "Session 3-9" },
  { id: 4, type: "Phishing", element: "Spoofed banking domain", status: "Resolved", chapters: "Session 1-7" },
  { id: 5, type: "Data Exfiltration", element: "Unauthorized form submission", status: "Active", chapters: "Session 2-9" },
  { id: 6, type: "Malware", element: "Drive-by download attempt", status: "Active", chapters: "Session 5-9" },
  { id: 7, type: "Credential Theft", element: "Password field on HTTP page", status: "Active", chapters: "Session 2-9" },
  { id: 8, type: "Phishing", element: "Lookalike domain detected", status: "Active", chapters: "Session 1-9" },
];

const timelineData = [
  { chapter: "S1", events: 12, characters: 4 },
  { chapter: "S2", events: 13, characters: 5 },
  { chapter: "S3", events: 14, characters: 5 },
  { chapter: "S4", events: 14, characters: 6 },
  { chapter: "S5", events: 15, characters: 6 },
  { chapter: "S6", events: 14, characters: 7 },
  { chapter: "S7", events: 16, characters: 7 },
  { chapter: "S8", events: 17, characters: 8 },
  { chapter: "S9", events: 16, characters: 8 },
  { chapter: "S10", events: 0, characters: 0 },
];

const storyHealthData = [
  { metric: "Phishing Detection", value: 95, fullMark: 100 },
  { metric: "Malware Coverage", value: 88, fullMark: 100 },
  { metric: "Module Response Time", value: 92, fullMark: 100 },
  { metric: "False Positive Rate", value: 85, fullMark: 100 },
  { metric: "Context Accuracy", value: 78, fullMark: 100 },
  { metric: "Defense Score", value: 91, fullMark: 100 },
];

const chapterStatsData = [
  { chapter: "Q1", wordsWritten: 18000, targetWords: 20000, revisions: 6 },
  { chapter: "Q2", wordsWritten: 21000, targetWords: 20000, revisions: 7 },
  { chapter: "Q3", wordsWritten: 24500, targetWords: 20000, revisions: 9 },
  { chapter: "Q4", wordsWritten: 28000, targetWords: 20000, revisions: 11 },
];

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
        const response = await fetch('/api/security-analytics?days=30&limit=100');
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
    <div className="min-h-screen w-full">
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
            title="Threats Detected"
            value="1,247"
            change="+15.2%"
            icon={BookOpen}
            trend="up"
          />
          <StatCard
            title="Modules Active"
            value="5"
            change="+1"
            icon={Users}
            trend="up"
          />
          <StatCard
            title="Active Scans"
            value="18"
            change="+3"
            icon={GitBranch}
            trend="up"
          />
          <StatCard
            title="Defense Score"
            value="91%"
            change="+2.4%"
            icon={Shield}
            trend="up"
          />
        </div>

        {/* Main Charts */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-muted/50 backdrop-blur-sm">
            <TabsTrigger value="overview" className="ivy-font">Threat Overview</TabsTrigger>
            <TabsTrigger value="analytics" className="ivy-font">Module Activity</TabsTrigger>
            <TabsTrigger value="performance" className="ivy-font">Defense Health</TabsTrigger>
            <TabsTrigger value="cashflow" className="ivy-font">Scan Timeline</TabsTrigger>
            <TabsTrigger value="investments" className="ivy-font">Detection Stats</TabsTrigger>
            <TabsTrigger value="transactions" className="ivy-font">Threat Incidents</TabsTrigger>
            <TabsTrigger value="livedetection" className="ivy-font flex items-center gap-1.5">
              <Radio className="h-3 w-3 animate-pulse text-red-500" />
              Live Detection
            </TabsTrigger>
            <TabsTrigger value="securityanalytics" className="ivy-font flex items-center gap-1.5">
              <Shield className="h-3 w-3" />
              Security Analytics
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-7">
              <Card className="col-span-4 border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader>
                  <CardTitle className="ivy-font">Threat Detection Overview</CardTitle>
                  <CardDescription className="ivy-font">
                    Threats detected per scan session with target thresholds
                  </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={progressData}>
                      <defs>
                        <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColors.revenue} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={chartColors.revenue} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColors.profit} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={chartColors.profit} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                      <XAxis 
                        dataKey="chapter" 
                        stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                        style={{ fontSize: '12px' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                          border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                          borderRadius: '8px',
                          color: isDarkMode ? '#f1f5f9' : '#0f172a'
                        }}
                      />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="wordCount" 
                        stroke={chartColors.revenue} 
                        fillOpacity={1} 
                        fill="url(#colorActual)"
                        strokeWidth={2}
                        name="Threats Detected"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="targetCount" 
                        stroke={chartColors.profit} 
                        fillOpacity={1} 
                        fill="url(#colorForecast)"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        name="Target Threshold"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="col-span-3 border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader>
                  <CardTitle className="ivy-font">Module Activity</CardTitle>
                  <CardDescription className="ivy-font">
                    Distribution by defense module usage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={characterActivityData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="appearances"
                      >
                        {characterActivityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
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
                    {characterActivityData.map((character, idx) => (
                      <div key={character.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: PIE_COLORS[idx] }}
                          />
                          <span className="text-sm text-muted-foreground ivy-font">{character.name}</span>
                        </div>
                        <span className="text-sm font-medium ivy-font">{character.appearances} appearances</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader>
                  <CardTitle className="ivy-font">Detection Trends</CardTitle>
                  <CardDescription className="ivy-font">
                    Threat detections across scan sessions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={progressData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                      <XAxis 
                        dataKey="chapter" 
                        stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                        style={{ fontSize: '12px' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                          border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="wordCount" 
                        stroke={chartColors.profit} 
                        strokeWidth={3}
                        dot={{ fill: chartColors.profit, r: 5 }}
                        activeDot={{ r: 7 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader>
                  <CardTitle className="ivy-font">Scan Events</CardTitle>
                  <CardDescription className="ivy-font">
                    Scan events and modules triggered per session
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                      <XAxis 
                        dataKey="month" 
                        stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                        style={{ fontSize: '12px' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                          border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Bar dataKey="events" fill={chartColors.revenue} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="characters" fill={chartColors.profit} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <Card className="border-border/40 backdrop-blur-sm bg-card/50 hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="ivy-font">Defense Health Metrics</CardTitle>
                <CardDescription className="ivy-font">
                  Comprehensive view of security posture across key defense areas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={storyHealthData}>
                    <PolarGrid stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                    <PolarAngleAxis 
                      dataKey="metric" 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                      style={{ fontSize: '12px' }}
                    />
                    <PolarRadiusAxis 
                      angle={90} 
                      domain={[0, 100]}
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                      style={{ fontSize: '10px' }}
                    />
                    <Radar 
                      name="Quality" 
                      dataKey="value" 
                      stroke={chartColors.primary} 
                      fill={chartColors.primary} 
                      fillOpacity={0.6}
                      strokeWidth={2}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                        borderRadius: '8px'
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                  {storyHealthData.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all hover:scale-105 cursor-pointer">
                      <p className="text-sm text-muted-foreground ivy-font mb-1">{item.metric}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold ivy-font">{item.value}%</p>
                        <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cash Flow Tab */}
          <TabsContent value="cashflow" className="space-y-4">
            <Card className="border-border/40 backdrop-blur-sm bg-card/50 hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="ivy-font">Detection Activity by Quarter</CardTitle>
                <CardDescription className="ivy-font">
                  Track threats blocked, scans run, and incident response rounds
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={chapterStatsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                    <XAxis 
                      dataKey="chapter" 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="wordsWritten" fill={chartColors.revenue} radius={[8, 8, 0, 0]} name="Threats Blocked" />
                    <Bar dataKey="targetWords" fill={chartColors.expenses} radius={[8, 8, 0, 0]} name="Target Threshold" />
                    <Line 
                      type="monotone" 
                      dataKey="revisions" 
                      stroke={chartColors.profit} 
                      strokeWidth={3}
                      name="Incidents Resolved"
                      dot={{ fill: chartColors.profit, r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-all hover:scale-105 cursor-pointer">
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 ivy-font mb-1">Threats Blocked</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 ivy-font">915</p>
                  </div>
                  <div className="p-4 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-all hover:scale-105 cursor-pointer">
                    <p className="text-sm text-red-600 dark:text-red-400 ivy-font mb-1">Scans Run</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 ivy-font">580</p>
                  </div>
                  <div className="p-4 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-all hover:scale-105 cursor-pointer">
                    <p className="text-sm text-blue-600 dark:text-blue-400 ivy-font mb-1">Risk Score</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 ivy-font">Low</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Investments Tab */}
          <TabsContent value="investments" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium ivy-font">
                    Portfolio Value
                  </CardTitle>
                  
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold ivy-font">$182,000</div>
                  <p className="text-xs text-muted-foreground ivy-font">
                    +8.2% from last month
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium ivy-font">
                    Target Value
                  </CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold ivy-font">$175,000</div>
                  <p className="text-xs text-emerald-500 ivy-font">
                    Target achieved! 🎉
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium ivy-font">
                    ROI
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold ivy-font">+45.6%</div>
                  <p className="text-xs text-muted-foreground ivy-font">
                    Year to date
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/40 backdrop-blur-sm bg-card/50">
              <CardHeader>
                <CardTitle className="ivy-font">Detection Stats Over Time</CardTitle>
                <CardDescription className="ivy-font">
                  Cumulative threats detected vs target thresholds
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={progressData}>
                    <defs>
                      <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors.portfolio} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={chartColors.portfolio} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                    <XAxis 
                      dataKey="chapter" 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                      style={{ fontSize: '12px' }}
                    />
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
                      dataKey="wordCount" 
                      stroke={chartColors.portfolio} 
                      fillOpacity={1} 
                      fill="url(#colorPortfolio)"
                      strokeWidth={3}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="targetCount" 
                      stroke={chartColors.target} 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Suggested Offers Tab */}
          <TabsContent value="transactions" className="space-y-4">
            <Card className="border-border/40 backdrop-blur-sm bg-card/50">
              <CardHeader>
                <CardTitle className="ivy-font">Story Elements Tracker</CardTitle>
                <CardDescription className="ivy-font">
                  Active plot threads, characters, and story elements across chapters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {storyElementsData.map((element) => (
                    <div
                      key={element.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border/40 bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${
                          element.status === "Active" 
                            ? "bg-emerald-500/10 text-emerald-500" 
                            : element.status === "Resolved"
                            ? "bg-blue-500/10 text-blue-500"
                            : "bg-slate-500/10 text-slate-500"
                        }`}>
                          {element.status === "Active" ? (
                            <Activity className="h-4 w-4" />
                          ) : (
                            <Shield className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground ivy-font">
                            {element.element}
                          </p>
                          <p className="text-sm text-muted-foreground ivy-font">
                            {element.type} • Chapters {element.chapters}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-emerald-500 ivy-font">
                          {element.status}
                        </div>
                        <Badge variant="outline" className="mt-1">
                          {element.type}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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
                    <div className="max-h-64 overflow-y-auto space-y-1 font-mono text-xs">
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
                    <div className="space-y-2 max-h-96 overflow-y-auto">
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
                                  {detection.detectionType === 'url' && detection.url}
                                  {detection.detectionType === 'email' && `${detection.emailSender} - ${detection.emailSubject}`}
                                  {detection.detectionType === 'deepfake' && `Frame ${detection.frameCount} - ${detection.verdict}`}
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

        </Tabs>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/40 backdrop-blur-sm bg-card/50 hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg ivy-font">Check Continuity</CardTitle>
                  <CardDescription className="ivy-font">Run consistency check</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/40 backdrop-blur-sm bg-card/50 hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-purple-500/10 text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg ivy-font">Get Suggestions</CardTitle>
                  <CardDescription className="ivy-font">AI creative ideas</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/40 backdrop-blur-sm bg-card/50 hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <PenTool className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg ivy-font">Start Writing</CardTitle>
                  <CardDescription className="ivy-font">Continue your story</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
