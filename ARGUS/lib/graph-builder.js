// Knowledge Graph Builder - Inserts nodes and relationships into Neo4j
import { runQuery } from './neo4j.js';
import { enrichDomain, calculateRiskScore } from './domain-enrichment.js';
import dbConnect from './mongodb.js';
import InteractionLog from './models/InteractionLog.js';
import ThreatLog from './models/ThreatLog.js';
import CampaignLog from './models/CampaignLog.js';
import EnrichmentLog from './models/EnrichmentLog.js';

// Insert or update user node
export async function upsertUser(userId, metadata = {}) {
  const query = `
    MERGE (u:User {id: $userId})
    ON CREATE SET 
      u.createdAt = datetime(),
      u.lastSeen = datetime(),
      u.interactionCount = 1
    ON MATCH SET 
      u.lastSeen = datetime(),
      u.interactionCount = u.interactionCount + 1
    SET u += $metadata
    RETURN u
  `;
  
  return await runQuery(query, { userId, metadata });
}

// Insert interaction event
export async function createInteraction(userId, domain, interactionData) {
  const timestamp = interactionData.timestamp || new Date().toISOString();
  const url = interactionData.url || '';
  const title = interactionData.title || '';
  const hasLoginForm = Boolean(interactionData.hasLoginForm);
  const bucket = Math.floor(new Date(timestamp).getTime() / 30000);
  const interactionKey = `${userId}|${domain}|${url}|${bucket}`;

  const query = `
    MATCH (u:User {id: $userId})
    MERGE (d:Domain {name: $domain})
    MERGE (i:InteractionEvent {key: $interactionKey})
    ON CREATE SET
      i.id = randomUUID(),
      i.timestamp = datetime($timestamp),
      i.url = $url,
      i.title = $title,
      i.hasLoginForm = $hasLoginForm,
      i.firstSeen = datetime(),
      i.lastSeen = datetime(),
      i.hitCount = 1
    ON MATCH SET
      i.lastSeen = datetime(),
      i.hitCount = coalesce(i.hitCount, 1) + 1
    MERGE (u)-[:VISITED]->(d)
    MERGE (u)-[:PERFORMED]->(i)
    MERGE (i)-[:ON_DOMAIN]->(d)
    RETURN i, d
  `;

  const result = await runQuery(query, {
    userId,
    domain,
    interactionKey,
    timestamp,
    url,
    title,
    hasLoginForm,
  });

  // Save to MongoDB
  try {
    await dbConnect();
    
    const threatLevel = interactionData.riskScore >= 70 ? 'high' 
      : interactionData.riskScore >= 50 ? 'medium'
      : interactionData.riskScore >= 30 ? 'low' : 'safe';

    await InteractionLog.create({
      userId,
      userEmail: interactionData.userEmail,
      url: interactionData.url,
      domain,
      title: interactionData.title,
      hasLoginForm: interactionData.hasLoginForm,
      suspiciousPatterns: interactionData.suspiciousPatterns || [],
      links: interactionData.links || [],
      riskScore: interactionData.riskScore || 0,
      threatLevel,
      timestamp: interactionData.timestamp || new Date(),
    });
  } catch (error) {
    console.error('[MongoDB] Failed to log interaction:', error.message);
  }

  return result;
}

// Enrich and insert domain with all related entities
export async function enrichAndInsertDomain(domain) {
  const startTime = Date.now();
  
  try {
    // Get enrichment data
    const enrichmentData = await enrichDomain(domain);
    const riskScore = calculateRiskScore(enrichmentData);
    const enrichmentDuration = Date.now() - startTime;

    // Insert domain node
    const domainQuery = `
      MERGE (d:Domain {name: $domain})
      SET d.domainAge = $domainAge,
          d.createdDate = $createdDate,
          d.expiresDate = $expiresDate,
          d.riskScore = $riskScore,
          d.enrichedAt = datetime($enrichedAt),
          d.hostingProvider = $hostingProvider
      RETURN d
    `;

    await runQuery(domainQuery, {
      domain: enrichmentData.domain,
      domainAge: enrichmentData.whois?.domainAge,
      createdDate: enrichmentData.whois?.createdDate,
      expiresDate: enrichmentData.whois?.expiresDate,
      riskScore,
      enrichedAt: enrichmentData.enrichedAt,
      hostingProvider: enrichmentData.hostingProvider,
    });

    // Insert registrar
    if (enrichmentData.whois?.registrar) {
      const registrarQuery = `
        MERGE (r:Registrar {name: $registrar})
        WITH r
        MATCH (d:Domain {name: $domain})
        MERGE (d)-[:REGISTERED_BY]->(r)
      `;
      await runQuery(registrarQuery, {
        domain: enrichmentData.domain,
        registrar: enrichmentData.whois.registrar,
      });
    }

    // Insert IP addresses and geolocation
    if (enrichmentData.primaryIP) {
      const ipQuery = `
        MERGE (ip:IP {address: $ipAddress})
        SET ip.country = $country,
            ip.region = $region,
            ip.city = $city,
            ip.latitude = $latitude,
            ip.longitude = $longitude
        WITH ip
        MATCH (d:Domain {name: $domain})
        MERGE (d)-[:RESOLVES_TO]->(ip)
      `;
      await runQuery(ipQuery, {
        domain: enrichmentData.domain,
        ipAddress: enrichmentData.primaryIP,
        country: enrichmentData.geolocation?.country,
        region: enrichmentData.geolocation?.region,
        city: enrichmentData.geolocation?.city,
        latitude: enrichmentData.geolocation?.latitude,
        longitude: enrichmentData.geolocation?.longitude,
      });

      // Insert hosting provider
      if (enrichmentData.hostingProvider) {
        const providerQuery = `
          MERGE (h:HostingProvider {name: $provider})
          WITH h
          MATCH (ip:IP {address: $ipAddress})
          MERGE (ip)-[:HOSTED_ON]->(h)
        `;
        await runQuery(providerQuery, {
          ipAddress: enrichmentData.primaryIP,
          provider: enrichmentData.hostingProvider,
        });
      }
    }

    // Insert brand impersonation target
    if (enrichmentData.brandImpersonation?.isImpersonating) {
      const orgQuery = `
        MERGE (o:Organization {name: $targetBrand})
        WITH o
        MATCH (d:Domain {name: $domain})
        MERGE (d)-[:TARGETS]->(o)
      `;
      await runQuery(orgQuery, {
        domain: enrichmentData.domain,
        targetBrand: enrichmentData.brandImpersonation.targetBrand,
      });
    }

    // Save enrichment to MongoDB
    try {
      await dbConnect();
      
      const riskFactors = [];
      if (enrichmentData.whois?.domainAge < 30) {
        riskFactors.push({ factor: 'new_domain', points: 30, description: 'Domain less than 30 days old' });
      }
      if (enrichmentData.brandImpersonation?.isImpersonating) {
        riskFactors.push({ factor: 'brand_impersonation', points: 40, description: `Impersonating ${enrichmentData.brandImpersonation.targetBrand}` });
      }

      await EnrichmentLog.create({
        domain: enrichmentData.domain,
        whois: {
          domainAge: enrichmentData.whois?.domainAge,
          registrar: enrichmentData.whois?.registrar,
          createdDate: enrichmentData.whois?.createdDate,
          expiresDate: enrichmentData.whois?.expiresDate,
          registrantOrg: enrichmentData.whois?.registrantOrg,
        },
        dns: {
          ipAddresses: enrichmentData.ipAddresses,
          primaryIP: enrichmentData.primaryIP,
        },
        geolocation: enrichmentData.geolocation,
        hostingProvider: enrichmentData.hostingProvider,
        brandImpersonation: enrichmentData.brandImpersonation,
        riskScore,
        riskFactors,
        enrichmentDuration,
        enrichmentStatus: 'success',
        enrichedAt: new Date(),
      });
    } catch (error) {
      console.error('[MongoDB] Failed to log enrichment:', error.message);
    }

    return { success: true, enrichmentData, riskScore };
  } catch (error) {
    console.error('[Graph Builder] Domain enrichment failed:', error);
    
    // Log failed enrichment
    try {
      await dbConnect();
      await EnrichmentLog.create({
        domain,
        riskScore: 0,
        enrichmentDuration: Date.now() - startTime,
        enrichmentStatus: 'failed',
        enrichedAt: new Date(),
      });
    } catch (logError) {
      console.error('[MongoDB] Failed to log enrichment error:', logError.message);
    }
    
    throw error;
  }
}

// Attach email context to a campaign and referenced domains
export async function attachEmailToCampaign({ campaignId, emailId, sender, subject, verdict, score, reason, linkDomains }) {
  if (!campaignId || !emailId) return null;
  const domains = Array.isArray(linkDomains) ? linkDomains.filter(Boolean).slice(0, 20) : [];

  const query = `
    MERGE (c:AttackCampaign {id: $campaignId})
    ON CREATE SET
      c.status = 'active',
      c.detectedAt = datetime(),
      c.source = 'email'
    ON MATCH SET
      c.lastUpdated = datetime()
    MERGE (e:Email {id: $emailId})
    ON CREATE SET
      e.sender = $sender,
      e.subject = $subject,
      e.verdict = $verdict,
      e.score = $score,
      e.reason = $reason,
      e.createdAt = datetime()
    MERGE (e)-[:PART_OF]->(c)
    WITH c, e
    UNWIND $domains as domainName
    MERGE (d:Domain {name: domainName})
    MERGE (e)-[:MENTIONS]->(d)
    MERGE (d)-[:PART_OF]->(c)
    WITH c
    MATCH (c)<-[:PART_OF]-(d:Domain)
    WITH c, count(DISTINCT d) as domainCount
    SET c.domainCount = domainCount
    RETURN c
  `;

  return await runQuery(query, {
    campaignId,
    emailId,
    sender: String(sender || 'Unknown').slice(0, 200),
    subject: String(subject || 'No Subject').slice(0, 300),
    verdict: String(verdict || 'CLEAR'),
    score: Number(score) || 0,
    reason: String(reason || '').slice(0, 300),
    domains,
  });
}

// Flag domain as threat
export async function flagDomainAsThreat(domain, threatType, severity, reason, userId = null, userEmail = null) {
  const query = `
    MERGE (d:Domain {name: $domain})
    MERGE (t:Threat {
      type: $threatType,
      severity: $severity,
      reason: $reason,
      detectedAt: datetime()
    })
    MERGE (d)-[:FLAGGED_AS]->(t)
    RETURN d, t
  `;

  const result = await runQuery(query, { domain, threatType, severity, reason });

  // Save to MongoDB
  try {
    await dbConnect();
    
    // Get domain risk score
    const domainQuery = `MATCH (d:Domain {name: $domain}) RETURN d.riskScore as riskScore`;
    const domainResult = await runQuery(domainQuery, { domain });
    const riskScore = domainResult[0]?.riskScore || 0;

    await ThreatLog.create({
      userId: userId || 'system',
      userEmail: userEmail || 'system',
      domain,
      threatType,
      severity,
      detectionSource: 'enrichment',
      reason,
      riskScore,
      actionTaken: 'logged',
      detectedAt: new Date(),
    });
  } catch (error) {
    console.error('[MongoDB] Failed to log threat:', error.message);
  }

  return result;
}

// Detect and create attack campaigns
export async function detectCampaigns() {
  // Find domains sharing infrastructure
  const sharedIPQuery = `
    MATCH (d1:Domain)-[:RESOLVES_TO]->(ip:IP)<-[:RESOLVES_TO]-(d2:Domain)
    WHERE d1.name < d2.name
    RETURN d1.name as domain1, d2.name as domain2, ip.address as sharedIP
  `;

  const sharedIPs = await runQuery(sharedIPQuery);

  // Find domains with same registrar registered within 30 days
  const sharedRegistrarQuery = `
    MATCH (d1:Domain)-[:REGISTERED_BY]->(r:Registrar)<-[:REGISTERED_BY]-(d2:Domain)
    WHERE d1.name < d2.name 
      AND d1.createdDate IS NOT NULL 
      AND d2.createdDate IS NOT NULL
      AND duration.between(datetime(d1.createdDate), datetime(d2.createdDate)).days <= 30
    RETURN d1.name as domain1, d2.name as domain2, r.name as registrar
  `;

  const sharedRegistrars = await runQuery(sharedRegistrarQuery);

  // Find domains targeting same organization
  const sharedTargetQuery = `
    MATCH (d1:Domain)-[:TARGETS]->(o:Organization)<-[:TARGETS]-(d2:Domain)
    WHERE d1.name < d2.name
    RETURN d1.name as domain1, d2.name as domain2, o.name as targetOrg
  `;

  const sharedTargets = await runQuery(sharedTargetQuery);

  // Cluster domains into campaigns
  const clusters = new Map();
  
  const addToCluster = (domain1, domain2, reason) => {
    let clusterId = null;
    
    // Find existing cluster
    for (const [id, domains] of clusters.entries()) {
      if (domains.has(domain1) || domains.has(domain2)) {
        clusterId = id;
        break;
      }
    }

    if (!clusterId) {
      clusterId = `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      clusters.set(clusterId, new Set());
    }

    clusters.get(clusterId).add(domain1);
    clusters.get(clusterId).add(domain2);
  };

  sharedIPs.forEach(row => addToCluster(row.domain1, row.domain2, 'shared_ip'));
  sharedRegistrars.forEach(row => addToCluster(row.domain1, row.domain2, 'shared_registrar'));
  sharedTargets.forEach(row => addToCluster(row.domain1, row.domain2, 'shared_target'));

  // Create campaign nodes for clusters with 3+ domains
  const campaigns = [];
  for (const [clusterId, domains] of clusters.entries()) {
    if (domains.size >= 3) {
      const domainList = Array.from(domains);
      
      const campaignQuery = `
        MERGE (c:AttackCampaign {id: $campaignId})
        SET c.domainCount = $domainCount,
            c.detectedAt = datetime(),
            c.status = 'active'
        WITH c
        UNWIND $domains as domainName
        MATCH (d:Domain {name: domainName})
        MERGE (d)-[:PART_OF]->(c)
        RETURN c
      `;

      await runQuery(campaignQuery, {
        campaignId: clusterId,
        domainCount: domains.size,
        domains: domainList,
      });

      campaigns.push({ id: clusterId, domains: domainList });

      // Save campaign to MongoDB
      try {
        await dbConnect();
        
        // Get domain risk scores
        const domainScores = await Promise.all(
          domainList.map(async (domain) => {
            const scoreQuery = `MATCH (d:Domain {name: $domain}) RETURN d.riskScore as riskScore`;
            const result = await runQuery(scoreQuery, { domain });
            return { domain, riskScore: result[0]?.riskScore || 0 };
          })
        );

        const avgRiskScore = domainScores.length
          ? domainScores.reduce((sum, d) => sum + d.riskScore, 0) / domainScores.length
          : 0;
        const overallSeverity = avgRiskScore >= 70 ? 'critical' 
          : avgRiskScore >= 50 ? 'high'
          : avgRiskScore >= 30 ? 'medium' : 'low';

        // Determine clustering reasons
        const clusteringReasons = [];
        if (sharedIPs.some(r => domainList.includes(r.domain1) || domainList.includes(r.domain2))) {
          clusteringReasons.push('shared_ip');
        }
        if (sharedRegistrars.some(r => domainList.includes(r.domain1) || domainList.includes(r.domain2))) {
          clusteringReasons.push('shared_registrar');
        }
        if (sharedTargets.some(r => domainList.includes(r.domain1) || domainList.includes(r.domain2))) {
          clusteringReasons.push('shared_target');
        }

        // Get target brands
        const targetBrands = [...new Set(
          sharedTargets
            .filter(r => domainList.includes(r.domain1) || domainList.includes(r.domain2))
            .map(r => r.targetOrg)
        )];

        await CampaignLog.findOneAndUpdate(
          { campaignId: clusterId },
          {
            campaignId: clusterId,
            name: `Campaign ${String(clusterId).slice(-8)}`,
            status: 'active',
            domains: domainScores.map(d => ({
              domain: d.domain,
              addedAt: new Date(),
              riskScore: d.riskScore
            })),
            domainCount: domains.size,
            clusteringReasons,
            targetBrands,
            overallSeverity,
            averageRiskScore: avgRiskScore,
            detectedAt: new Date(),
            lastUpdated: new Date(),
          },
          { upsert: true, new: true }
        );
      } catch (error) {
        console.error('[MongoDB] Failed to log campaign:', error.message);
      }
    }
  }

  return campaigns;
}

// Get graph data for visualization
export async function getGraphData() {
  const query = `
    MATCH (n)
    OPTIONAL MATCH (n)-[r]->(m)
    RETURN 
      collect(DISTINCT {
        id: id(n),
        label: labels(n)[0],
        properties: properties(n)
      }) as nodes,
      collect(DISTINCT {
        source: id(n),
        target: id(m),
        type: type(r)
      }) as links
  `;

  const result = await runQuery(query);
  if (result.length === 0) {
    return { nodes: [], links: [] };
  }

  const data = result[0];
  
  // Filter out null links (from nodes without relationships)
  const validLinks = data.links.filter(link => link.target !== null);

  return {
    nodes: data.nodes,
    links: validLinks,
  };
}

// Get campaign clusters
export async function getCampaignClusters() {
  const query = `
    MATCH (c:AttackCampaign)<-[:PART_OF]-(d:Domain)
    RETURN c.id as campaignId, 
           c.domainCount as domainCount,
           c.detectedAt as detectedAt,
           collect(d.name) as domains
    ORDER BY c.detectedAt DESC
  `;

  return await runQuery(query);
}

// Reset graph (delete all nodes and relationships)
export async function resetGraph() {
  const query = `MATCH (n) DETACH DELETE n`;
  await runQuery(query);
  return { success: true, message: 'Graph reset successfully' };
}

// Get domains visited by user
export async function getUserDomains(userId) {
  const query = `
    MATCH (u:User {id: $userId})-[:VISITED]->(d:Domain)
    RETURN d.name as domain, 
           d.riskScore as riskScore,
           d.domainAge as domainAge
    ORDER BY d.riskScore DESC
  `;

  return await runQuery(query, { userId });
}

// Get related domains (sharing infrastructure)
export async function getRelatedDomains(domain) {
  const query = `
    MATCH (d:Domain {name: $domain})-[:RESOLVES_TO]->(ip:IP)<-[:RESOLVES_TO]-(related:Domain)
    WHERE d.name <> related.name
    RETURN related.name as domain,
           related.riskScore as riskScore,
           ip.address as sharedIP
  `;

  return await runQuery(query, { domain });
}
