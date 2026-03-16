// GET /api/campaign-clusters - Get detected attack campaigns
import { NextResponse } from 'next/server';
import { getCampaignClusters } from '@/lib/graph-builder';

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
    const campaigns = await getCampaignClusters();

    return NextResponse.json({
      campaigns: campaigns.map(c => ({
        id: String(neo4jInt(c.campaignId) ?? c.campaignId),
        domainCount: neo4jInt(c.domainCount) ?? 0,
        detectedAt: c.detectedAt,
        domains: Array.isArray(c.domains) ? c.domains : [],
      })),
      totalCampaigns: campaigns.length,
    });

  } catch (error) {
    console.error('[Campaign Clusters API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve campaigns' },
      { status: 500 }
    );
  }
}
