import mongoose from 'mongoose';

const ThreatLogSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    index: true
  },
  
  // Threat details
  domain: {
    type: String,
    required: true,
    index: true
  },
  threatType: {
    type: String,
    enum: ['phishing', 'malware', 'scam', 'impersonation', 'suspicious', 'other'],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
    index: true
  },
  
  // Detection details
  detectionSource: {
    type: String,
    enum: ['lexical', 'gemini', 'enrichment', 'manual', 'campaign'],
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  
  // Action taken
  actionTaken: {
    type: String,
    enum: ['blocked', 'warned', 'logged', 'allowed'],
    default: 'logged'
  },
  userResponse: {
    type: String,
    enum: ['proceeded', 'cancelled', 'ignored', null],
    default: null
  },
  
  // Context
  url: String,
  pageTitle: String,
  
  // Campaign association
  campaignId: {
    type: String,
    index: true
  },
  
  // Neo4j reference
  neo4jNodeId: String,
  
  // Timestamps
  detectedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  resolvedAt: Date
}, {
  timestamps: true
});

// Indexes for analytics
ThreatLogSchema.index({ userId: 1, detectedAt: -1 });
ThreatLogSchema.index({ severity: 1, detectedAt: -1 });
ThreatLogSchema.index({ threatType: 1, detectedAt: -1 });
ThreatLogSchema.index({ actionTaken: 1 });

export default mongoose.models.ThreatLog || mongoose.model('ThreatLog', ThreatLogSchema);
