// POST /api/interaction - Record user browsing interaction
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { initializeGraphSchema } from '@/lib/neo4j';
import dbConnect from '@/lib/mongodb';
import InteractionLog from '@/lib/models/InteractionLog';
import { 
  upsertUser, 
  createInteraction, 
  enrichAndInsertDomain,
  flagDomainAsThreat,
  detectCampaigns 
} from '@/lib/graph-builder';

// Initialize schema on first request
let schemaInitialized = false;

export async function POST(request) {
  try {
    // Initialize schema if needed
    if (!schemaInitialized) {
      await initializeGraphSchema();
      schemaInitialized = true;
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.email || 'anonymous_user';

    const body = await request.json();
    const { url, title, timestamp, links, hasLoginForm, suspiciousPatterns } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Extract domain from URL
    const domain = new URL(url).hostname;

    console.log(`[Interaction] User ${userId} visited ${domain}`);

    // Upsert user
    await upsertUser(userId, { email: session?.user?.email });

    // Create interaction event
    await createInteraction(userId, domain, {
      url,
      title,
      timestamp: timestamp || new Date().toISOString(),
      hasLoginForm: hasLoginForm || false,
      userEmail: session?.user?.email,
      links,
      suspiciousPatterns,
    });

    // Enrich domain (async - don't block response)
    enrichAndInsertDomain(domain)
      .then(async (result) => {
        console.log(`[Interaction] Domain ${domain} enriched with risk score: ${result.riskScore}`);
        
        // Update interaction log with enrichment data
        try {
          await dbConnect();
          await InteractionLog.findOneAndUpdate(
            { userId, domain, timestamp: { $gte: new Date(Date.now() - 10000) } },
            { 
              riskScore: result.riskScore,
              threatLevel: result.riskScore >= 70 ? 'high' 
                : result.riskScore >= 50 ? 'medium'
                : result.riskScore >= 30 ? 'low' : 'safe',
              enrichmentData: {
                domainAge: result.enrichmentData.whois?.domainAge,
                registrar: result.enrichmentData.whois?.registrar,
                ipAddress: result.enrichmentData.primaryIP,
                country: result.enrichmentData.geolocation?.country,
                city: result.enrichmentData.geolocation?.city,
                hostingProvider: result.enrichmentData.hostingProvider,
                brandImpersonation: result.enrichmentData.brandImpersonation,
              }
            },
            { sort: { timestamp: -1 } }
          );
        } catch (err) {
          console.error('[MongoDB] Failed to update interaction with enrichment:', err.message);
        }
        
        // Flag as threat if high risk
        if (result.riskScore >= 70) {
          await flagDomainAsThreat(
            domain,
            'phishing',
            'high',
            'High risk score from automated analysis',
            userId,
            session?.user?.email
          );
        }

        // Detect campaigns periodically
        await detectCampaigns();
      })
      .catch(err => console.error('[Interaction] Enrichment failed:', err));

    return NextResponse.json({
      success: true,
      message: 'Interaction recorded',
      domain,
      userId,
    });

  } catch (error) {
    console.error('[Interaction API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record interaction' },
      { status: 500 }
    );
  }
}
