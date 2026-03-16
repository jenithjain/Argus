// GET /api/user-domains - Get domains visited by current user
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getUserDomains } from '@/lib/graph-builder';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.email || 'anonymous_user';

    const domains = await getUserDomains(userId);

    return NextResponse.json({
      userId,
      domains,
      totalDomains: domains.length,
    });

  } catch (error) {
    console.error('[User Domains API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve user domains' },
      { status: 500 }
    );
  }
}
