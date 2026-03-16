'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  TrendingUp,
  Globe,
  Eye,
  Clock,
  Target,
  RefreshCw
} from 'lucide-react';

const COLORS = {
  safe: '#22c55e',
  low: '#3b82f6',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#991b1b',
};

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  const fetchAnalytics = async (range = timeRange) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics?range=${range}`);
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
    fetchAnalytics(range);
  };

  if (loading || !analytics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const { stats, timeline, topRiskyDomains, recentThreats, campaigns, brandImpersonations } = analytics;

  // Prepare chart data
  const riskDistributionData = Object.entries(stats.riskDistribution).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value,
    color: COLORS[key],
  }));

  const threatTypeData = Object.entries(stats.threatTypes).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Activity className="w-8 h-8 text-cyan-400" />
              Security Analytics Dashboard
            </h1>
            <p className="text-slate-400 mt-1">
              Comprehensive threat intelligence and browsing analytics
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Tabs value={timeRange} onValueChange={handleTimeRangeChange}>
              <TabsList className="bg-slate-800">
                <TabsTrigger value="7d">7 Days</TabsTrigger>
                <TabsTrigger value="30d">30 Days</TabsTrigger>
                <TabsTrigger value="90d">90 Days</TabsTrigger>
                <TabsTrigger value="all">All Time</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Button
              onClick={() => fetchAnalytics()}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900/50 border-slate-800 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Globe className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Interactions</p>
                <p className="text-3xl font-bold text-white">{stats.totalInteractions}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Eye className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Unique Domains</p>
                <p className="text-3xl font-bold text-white">{stats.uniqueDomains}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Threats Detected</p>
                <p className="text-3xl font-bold text-white">{stats.threatsDetected}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <Target className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Active Campaigns</p>
                <p className="text-3xl font-bold text-white">{stats.activeCampaigns}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Timeline Chart */}
          <Card className="bg-slate-900/50 border-slate-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Activity Timeline</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Legend />
                <Line type="monotone" dataKey="interactions" stroke="#3b82f6" name="Interactions" />
                <Line type="monotone" dataKey="threats" stroke="#ef4444" name="Threats" />
                <Line type="monotone" dataKey="avgRisk" stroke="#f59e0b" name="Avg Risk" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Risk Distribution */}
          <Card className="bg-slate-900/50 border-slate-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Risk Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {riskDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Threat Types Chart */}
        {threatTypeData.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Threat Types</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={threatTypeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Bar dataKey="value" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Tables Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Risky Domains */}
          <Card className="bg-slate-900/50 border-slate-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Top Risky Domains</h3>
            <div className="space-y-3">
              {topRiskyDomains.slice(0, 5).map((domain, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-white font-mono text-sm">{domain.domain}</p>
                    <p className="text-xs text-slate-400">{domain.count} visits</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{domain.maxRisk}</p>
                      <p className="text-xs text-slate-400">risk score</p>
                    </div>
                    <div 
                      className="w-2 h-12 rounded"
                      style={{ 
                        backgroundColor: domain.maxRisk >= 70 ? COLORS.high 
                          : domain.maxRisk >= 50 ? COLORS.medium 
                          : domain.maxRisk >= 30 ? COLORS.low : COLORS.safe
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent Threats */}
          <Card className="bg-slate-900/50 border-slate-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Recent Threats</h3>
            <div className="space-y-3">
              {recentThreats.slice(0, 5).map((threat, i) => (
                <div key={i} className="p-3 bg-slate-800/50 rounded-lg border-l-4" style={{ borderColor: COLORS[threat.severity] || COLORS.medium }}>
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-white font-mono text-sm">{threat.domain}</p>
                    <Badge variant="destructive" className="text-xs">
                      {threat.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 mb-1">{threat.reason}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    {new Date(threat.detectedAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Attack Campaigns */}
        {campaigns.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-red-400" />
              Active Attack Campaigns
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map((campaign, i) => (
                <div key={i} className="p-4 bg-slate-800/50 rounded-lg border border-red-900/20">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="destructive">{campaign.severity}</Badge>
                    <span className="text-sm text-slate-400">{campaign.domainCount} domains</span>
                  </div>
                  <p className="text-white font-semibold mb-2">{campaign.name}</p>
                  {campaign.targetBrands.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {campaign.targetBrands.map((brand, j) => (
                        <Badge key={j} variant="outline" className="text-xs">
                          {brand}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-500">
                    Detected {new Date(campaign.detectedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Brand Impersonations */}
        {brandImpersonations.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-400" />
              Brand Impersonation Attempts
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {brandImpersonations.map((imp, i) => (
                <div key={i} className="p-3 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs">{imp.targetBrand}</Badge>
                    <span className="text-sm font-semibold text-red-400">{imp.riskScore}</span>
                  </div>
                  <p className="text-white font-mono text-sm">{imp.domain}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900/50 border-slate-800 p-6">
            <h4 className="text-sm font-semibold text-slate-400 mb-2">Average Risk Score</h4>
            <p className="text-3xl font-bold text-white">{stats.averageRiskScore.toFixed(1)}</p>
            <div className="mt-2 bg-slate-800 rounded-full h-2">
              <div 
                className="h-2 rounded-full"
                style={{ 
                  width: `${stats.averageRiskScore}%`,
                  backgroundColor: stats.averageRiskScore >= 70 ? COLORS.high 
                    : stats.averageRiskScore >= 50 ? COLORS.medium 
                    : stats.averageRiskScore >= 30 ? COLORS.low : COLORS.safe
                }}
              />
            </div>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 p-6">
            <h4 className="text-sm font-semibold text-slate-400 mb-2">Login Form Encounters</h4>
            <p className="text-3xl font-bold text-white">{stats.loginFormEncounters}</p>
            <p className="text-sm text-slate-500 mt-2">
              {((stats.loginFormEncounters / stats.totalInteractions) * 100).toFixed(1)}% of interactions
            </p>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 p-6">
            <h4 className="text-sm font-semibold text-slate-400 mb-2">Threat Detection Rate</h4>
            <p className="text-3xl font-bold text-white">
              {((stats.threatsDetected / stats.totalInteractions) * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-slate-500 mt-2">
              {stats.threatsDetected} of {stats.totalInteractions} interactions
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
