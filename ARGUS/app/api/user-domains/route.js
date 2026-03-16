// GET /api/user-domains - Get domains visited by current user
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getUserDomains } from '@/lib/graph-builder';

// Neo4j integer → plain JS number
function neo4jInt(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object' && 'low' in val && 'high' in val) {
    return val.high === 0 || val.high === -1 ? val.low : Number(val.low);
  }
  return val;
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.email || 'anonymous_user';

    const domains = await getUserDomains(userId);

    // Sanitize Neo4j integers before sending to client
    const cleanDomains = domains.map(d => ({
      domain: d.domain,
      riskScore: neo4jInt(d.riskScore) ?? 0,
      domainAge: neo4jInt(d.domainAge),
    }));

    return NextResponse.json({
      userId,
      domains: cleanDomains,
      totalDomains: cleanDomains.length,
    });

  } catch (error) {
    console.error('[User Domains API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve user domains' },
      { status: 500 }
    );
  }
}
