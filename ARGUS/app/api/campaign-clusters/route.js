// GET /api/campaign-clusters - Get detected attack campaigns
import { NextResponse } from 'next/server';
import { getCampaignClusters } from '@/lib/graph-builder';

export async function GET(request) {
  try {
    const campaigns = await getCampaignClusters();

    return NextResponse.json({
      campaigns: campaigns.map(c => ({
        id: c.campaignId,
        domainCount: c.domainCount,
        detectedAt: c.detectedAt,
        domains: c.domains,
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
