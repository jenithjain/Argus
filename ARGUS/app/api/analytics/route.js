// GET /api/analytics - User analytics dashboard
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import dbConnect from '@/lib/mongodb';
import InteractionLog from '@/lib/models/InteractionLog';
import ThreatLog from '@/lib/models/ThreatLog';
import CampaignLog from '@/lib/models/CampaignLog';
import EnrichmentLog from '@/lib/models/EnrichmentLog';

export async function GET(request) {
  try {
    await dbConnect();
    
    const session = await getServerSession(authOptions);
    const userId = session?.user?.email || 'anonymous_user';
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('range') || '7d'; // 7d, 30d, 90d, all

    // Calculate date range
    const now = new Date();
    let startDate = new Date(0); // Beginning of time
    
    if (timeRange === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (timeRange === '90d') {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    // Get user interactions
    const interactions = await InteractionLog.find({
      userId,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: -1 });

    // Get threats for user
    const threats = await ThreatLog.find({
      userId,
      detectedAt: { $gte: startDate }
    }).sort({ detectedAt: -1 });

    // Get all active campaigns
    const campaigns = await CampaignLog.find({
      status: 'active',
      detectedAt: { $gte: startDate }
    }).sort({ detectedAt: -1 });

    // Calculate statistics
    const stats = {
      totalInteractions: interactions.length,
      uniqueDomains: [...new Set(interactions.map(i => i.domain))].length,
      threatsDetected: threats.length,
      activeCampaigns: campaigns.length,
      
      // Risk distribution
      riskDistribution: {
        safe: interactions.filter(i => i.threatLevel === 'safe').length,
        low: interactions.filter(i => i.threatLevel === 'low').length,
        medium: interactions.filter(i => i.threatLevel === 'medium').length,
        high: interactions.filter(i => i.threatLevel === 'high').length,
        critical: interactions.filter(i => i.threatLevel === 'critical').length,
      },
      
      // Threat types
      threatTypes: threats.reduce((acc, t) => {
        acc[t.threatType] = (acc[t.threatType] || 0) + 1;
        return acc;
      }, {}),
      
      // Severity distribution
      severityDistribution: threats.reduce((acc, t) => {
        acc[t.severity] = (acc[t.severity] || 0) + 1;
        return acc;
      }, {}),
      
      // Login form encounters
      loginFormEncounters: interactions.filter(i => i.hasLoginForm).length,
      
      // Suspicious patterns
      suspiciousPatterns: interactions.reduce((acc, i) => {
        i.suspiciousPatterns?.forEach(p => {
          acc[p] = (acc[p] || 0) + 1;
        });
        return acc;
      }, {}),
      
      // Average risk score
      averageRiskScore: interactions.length > 0
        ? interactions.reduce((sum, i) => sum + (i.riskScore || 0), 0) / interactions.length
        : 0,
    };

    // Timeline data (daily aggregation)
    const timeline = {};
    interactions.forEach(i => {
      const date = new Date(i.timestamp).toISOString().split('T')[0];
      if (!timeline[date]) {
        timeline[date] = { date, interactions: 0, threats: 0, avgRisk: 0, riskSum: 0 };
      }
      timeline[date].interactions++;
      timeline[date].riskSum += i.riskScore || 0;
    });

    threats.forEach(t => {
      const date = new Date(t.detectedAt).toISOString().split('T')[0];
      if (timeline[date]) {
        timeline[date].threats++;
      }
    });

    // Calculate average risk per day
    Object.values(timeline).forEach(day => {
      day.avgRisk = day.interactions > 0 ? day.riskSum / day.interactions : 0;
      delete day.riskSum;
    });

    const timelineArray = Object.values(timeline).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    // Top risky domains
    const domainRisks = {};
    interactions.forEach(i => {
      if (!domainRisks[i.domain]) {
        domainRisks[i.domain] = { domain: i.domain, count: 0, maxRisk: 0, totalRisk: 0 };
      }
      domainRisks[i.domain].count++;
      domainRisks[i.domain].maxRisk = Math.max(domainRisks[i.domain].maxRisk, i.riskScore || 0);
      domainRisks[i.domain].totalRisk += i.riskScore || 0;
    });

    const topRiskyDomains = Object.values(domainRisks)
      .map(d => ({ ...d, avgRisk: d.totalRisk / d.count }))
      .sort((a, b) => b.maxRisk - a.maxRisk)
      .slice(0, 10);

    // Recent threats
    const recentThreats = threats.slice(0, 10).map(t => ({
      id: t._id,
      domain: t.domain,
      threatType: t.threatType,
      severity: t.severity,
      reason: t.reason,
      riskScore: t.riskScore,
      detectedAt: t.detectedAt,
      actionTaken: t.actionTaken,
    }));

    // Campaign summary
    const campaignSummary = campaigns.map(c => ({
      id: c.campaignId,
      name: c.name,
      domainCount: c.domainCount,
      severity: c.overallSeverity,
      targetBrands: c.targetBrands,
      detectedAt: c.detectedAt,
    }));

    // Brand impersonation attempts
    const enrichments = await EnrichmentLog.find({
      'brandImpersonation.isImpersonating': true,
      enrichedAt: { $gte: startDate }
    }).sort({ enrichedAt: -1 }).limit(20);

    const brandImpersonations = enrichments.map(e => ({
      domain: e.domain,
      targetBrand: e.brandImpersonation.targetBrand,
      riskScore: e.riskScore,
      enrichedAt: e.enrichedAt,
    }));

    return NextResponse.json({
      userId,
      timeRange,
      stats,
      timeline: timelineArray,
      topRiskyDomains,
      recentThreats,
      campaigns: campaignSummary,
      brandImpersonations,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Analytics API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate analytics' },
      { status: 500 }
    );
  }
}
