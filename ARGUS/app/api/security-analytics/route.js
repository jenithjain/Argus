import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import SecurityAnalytics from '@/lib/models/SecurityAnalytics';

/**
 * GET /api/security-analytics
 * Fetch security analytics data for the dashboard
 * Query params:
 *   - type: 'url' | 'email' | 'deepfake' | 'all' (default: 'all')
 *   - days: number of days to look back (default: 30)
 *   - limit: max records to return (default: 100)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const days = parseInt(searchParams.get('days') || '30');
    const limit = parseInt(searchParams.get('limit') || '100');
    const tzOffset = parseInt(searchParams.get('tzOffset') || '0');

    await connectDB();

    // Build query
    const query = {};
    
    // Filter by detection type
    if (type !== 'all') {
      query.detectionType = type;
    }
    
    // Filter by date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    query.detectedAt = { $gte: startDate };

    // Fetch analytics
    const analytics = await SecurityAnalytics
      .find(query)
      .sort({ detectedAt: -1 })
      .limit(limit)
      .lean();

    // Compute summary statistics
    const summary = {
      total: analytics.length,
      byType: {},
      byVerdict: {},
      bySeverity: {},
      recentThreats: analytics.filter(a => 
        ['MALICIOUS', 'HIGH_RISK', 'FAKE'].includes(a.verdict)
      ).length,
      avgScore: analytics.length > 0 
        ? Math.round(analytics.reduce((sum, a) => sum + a.score, 0) / analytics.length)
        : 0
    };

    // Count by type
    ['url', 'email', 'deepfake'].forEach(t => {
      summary.byType[t] = analytics.filter(a => a.detectionType === t).length;
    });

    // Count by verdict
    analytics.forEach(a => {
      summary.byVerdict[a.verdict] = (summary.byVerdict[a.verdict] || 0) + 1;
    });

    // Count by severity
    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].forEach(s => {
      summary.bySeverity[s] = analytics.filter(a => a.severity === s).length;
    });

    // Time series data (group by day)
    const timeSeriesMap = {};
    analytics.forEach(a => {
      const detectedAt = new Date(a.detectedAt);
      const localTime = new Date(detectedAt.getTime() - tzOffset * 60000);
      const day = localTime.toISOString().split('T')[0];
      if (!timeSeriesMap[day]) {
        timeSeriesMap[day] = { date: day, count: 0, threats: 0 };
      }
      timeSeriesMap[day].count++;
      if (['MALICIOUS', 'HIGH_RISK', 'FAKE'].includes(a.verdict)) {
        timeSeriesMap[day].threats++;
      }
    });
    const timeSeries = Object.values(timeSeriesMap).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    return NextResponse.json({
      success: true,
      summary,
      timeSeries,
      recentDetections: analytics.slice(0, 20),
      totalRecords: analytics.length
    });

  } catch (error) {
    console.error('[ARGUS /api/security-analytics] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/security-analytics
 * Manually log a security detection (for testing or manual entries)
 */
export async function POST(request) {
  try {
    const body = await request.json();
    
    await connectDB();
    
    const analytics = await SecurityAnalytics.create({
      userId: body.userId || null,
      detectionType: body.detectionType,
      detectedAt: body.detectedAt || new Date(),
      verdict: body.verdict,
      score: body.score,
      severity: body.severity,
      url: body.url,
      urlDomain: body.urlDomain,
      emailSender: body.emailSender,
      emailSubject: body.emailSubject,
      fakeProbability: body.fakeProbability,
      frameCount: body.frameCount,
      analysisMode: body.analysisMode,
      reason: body.reason,
      signals: body.signals || [],
      explanation: body.explanation,
      action: body.action,
      processingTimeMs: body.processingTimeMs,
      sessionId: body.sessionId
    });

    return NextResponse.json({
      success: true,
      id: analytics._id
    });

  } catch (error) {
    console.error('[ARGUS /api/security-analytics] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
