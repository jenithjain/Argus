import mongoose from 'mongoose';

const InteractionLogSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    index: true
  },
  
  // Interaction details
  url: {
    type: String,
    required: true
  },
  domain: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String
  },
  
  // Security indicators
  hasLoginForm: {
    type: Boolean,
    default: false
  },
  suspiciousPatterns: [{
    type: String
  }],
  
  // Links found on page
  links: [{
    url: String,
    text: String
  }],
  
  // Risk assessment
  riskScore: {
    type: Number,
    min: 0,
    max: 100
  },
  threatLevel: {
    type: String,
    enum: ['safe', 'low', 'medium', 'high', 'critical'],
    default: 'safe'
  },
  
  // Enrichment data
  enrichmentData: {
    domainAge: Number,
    registrar: String,
    ipAddress: String,
    country: String,
    city: String,
    hostingProvider: String,
    brandImpersonation: {
      isImpersonating: Boolean,
      targetBrand: String
    }
  },
  
  // Neo4j reference
  neo4jNodeId: String,
  
  // Timestamps
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for analytics queries
InteractionLogSchema.index({ userId: 1, timestamp: -1 });
InteractionLogSchema.index({ domain: 1, timestamp: -1 });
InteractionLogSchema.index({ riskScore: -1 });
InteractionLogSchema.index({ threatLevel: 1, timestamp: -1 });

export default mongoose.models.InteractionLog || mongoose.model('InteractionLog', InteractionLogSchema);
