// API Route to fetch recent email detection logs
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import SecurityAnalytics from '@/lib/models/SecurityAnalytics';

export async function GET(request) {
  try {
    // ── RBAC: scope to logged-in user ──────────────────────────
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: true, count: 0, logs: [] });
    }
    const userId = session.user.id;

    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const logs = await SecurityAnalytics
      .find({ detectionType: 'email', userId })
      .sort({ detectedAt: -1 })
      .limit(limit)
      .select('emailSender emailSubject verdict score severity detectedAt reason signals')
      .lean();
    
    const count = await SecurityAnalytics.countDocuments({ detectionType: 'email', userId });
    
    return NextResponse.json({
      success: true,
      count,
      logs: logs.map(log => ({
        id: log._id.toString(),
        sender: log.emailSender,
        subject: log.emailSubject,
        verdict: log.verdict,
        score: log.score,
        severity: log.severity,
        detectedAt: log.detectedAt,
        reason: log.reason,
        signals: log.signals
      }))
    });
  } catch (error) {
    console.error('[Email Logs API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
