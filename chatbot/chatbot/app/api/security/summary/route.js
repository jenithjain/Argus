import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import PromptInjectionEvent from '@/lib/models/PromptInjectionEvent';

function buildDailyTrend(events) {
  const days = new Map();

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    days.set(key, { date: key, total: 0, blocked: 0, warned: 0 });
  }

  for (const event of events) {
    const key = new Date(event.createdAt).toISOString().slice(0, 10);
    const entry = days.get(key);
    if (!entry) continue;
    entry.total += 1;
    if (event.action === 'block') entry.blocked += 1;
    if (event.action === 'warn') entry.warned += 1;
  }

  return [...days.values()];
}

function topCounts(events, selector) {
  const counts = new Map();
  for (const event of events) {
    const values = selector(event);
    for (const value of values) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));
}

function sanitizeIp(value) {
  return (value || 'unknown').trim() || 'unknown';
}

function parseAdminEmails() {
  const primaryAdmin = (process.env.PRIMARY_ADMIN_EMAIL || 'devaanshshah2k23@gmail.com')
    .trim()
    .toLowerCase();

  const configured = (process.env.ADMIN_EMAILS || primaryAdmin)
    .split(/[;,]/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set([primaryAdmin, ...configured])];
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const currentUser = await User.findOne({ email: session.user.email });
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const adminEmails = parseAdminEmails();
    const isAdmin = adminEmails.includes(session.user.email.toLowerCase());

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const filter = {};
    const recentEvents = await PromptInjectionEvent.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const userIds = [...new Set(recentEvents.map((event) => event.userId.toString()))];
    const users = await User.find({ _id: { $in: userIds } }).select('email name').lean();
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));

    const totals = {
      total: recentEvents.length,
      blocked: recentEvents.filter((event) => event.action === 'block').length,
      warned: recentEvents.filter((event) => event.action === 'warn').length,
      clean: recentEvents.filter((event) => event.action === 'allow').length,
      critical: recentEvents.filter((event) => event.severity === 'critical').length,
    };

    return NextResponse.json({
      success: true,
      scope: 'global',
      totals,
      dailyTrend: buildDailyTrend(recentEvents),
      topSignals: topCounts(recentEvents, (event) => event.matchedSignals || []),
      topCategories: topCounts(recentEvents, (event) => [event.category]),
      topIps: topCounts(
        recentEvents.filter((event) => event.action !== 'allow'),
        (event) => [sanitizeIp(event.clientIp)]
      ),
      recentEvents: recentEvents.slice(0, 12).map((event) => {
        const owner = userMap.get(event.userId.toString());
        return {
          id: event._id.toString(),
          createdAt: event.createdAt,
          messageText: event.messageText,
          riskScore: event.riskScore,
          severity: event.severity,
          action: event.action,
          category: event.category,
          matchedSignals: event.matchedSignals,
          detectorReasons: event.detectorReasons,
          source: event.source,
          clientIp: sanitizeIp(event.clientIp),
          forwardedFor: event.forwardedFor || '',
          userAgent: event.userAgent || '',
          ownerName: owner?.name || 'Unknown User',
          ownerEmail: owner?.email || 'unknown@example.com',
        };
      }),
    });
  } catch (error) {
    console.error('Security summary error:', error);
    return NextResponse.json({ error: 'Failed to load security summary' }, { status: 500 });
  }
}