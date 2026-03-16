import mongoose from 'mongoose';

const EnrichmentLogSchema = new mongoose.Schema({
  domain: {
    type: String,
    required: true,
    index: true
  },
  
  // WHOIS data
  whois: {
    domainAge: Number,
    registrar: String,
    createdDate: Date,
    expiresDate: Date,
    registrantOrg: String
  },
  
  // DNS data
  dns: {
    ipAddresses: [String],
    primaryIP: String,
    nameservers: [String]
  },
  
  // Geolocation
  geolocation: {
    country: String,
    region: String,
    city: String,
    latitude: Number,
    longitude: Number,
    timezone: String
  },
  
  // Hosting
  hostingProvider: String,
  
  // Brand impersonation
  brandImpersonation: {
    isImpersonating: Boolean,
    targetBrand: String,
    confidence: Number
  },
  
  // Risk assessment
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  riskFactors: [{
    factor: String,
    points: Number,
    description: String
  }],
  
  // Enrichment metadata
  enrichmentSource: {
    type: String,
    enum: ['whois-api', 'dns-lookup', 'geoip', 'manual'],
    default: 'whois-api'
  },
  enrichmentDuration: Number, // milliseconds
  enrichmentStatus: {
    type: String,
    enum: ['success', 'partial', 'failed'],
    default: 'success'
  },
  
  // Neo4j reference
  neo4jNodeId: String,
  
  // Timestamps
  enrichedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastChecked: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
EnrichmentLogSchema.index({ domain: 1, enrichedAt: -1 });
EnrichmentLogSchema.index({ riskScore: -1 });
EnrichmentLogSchema.index({ 'brandImpersonation.isImpersonating': 1 });

export default mongoose.models.EnrichmentLog || mongoose.model('EnrichmentLog', EnrichmentLogSchema);
