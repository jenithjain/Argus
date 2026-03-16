import mongoose from 'mongoose';

const CampaignLogSchema = new mongoose.Schema({
  campaignId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Campaign details
  name: {
    type: String,
    default: function() {
      const id = this?.campaignId;
      return id ? `Campaign ${String(id).slice(-8)}` : 'Campaign';
    }
  },
  status: {
    type: String,
    enum: ['active', 'monitoring', 'resolved', 'archived'],
    default: 'active',
    index: true
  },
  
  // Domains in campaign
  domains: [{
    domain: String,
    addedAt: { type: Date, default: Date.now },
    riskScore: Number
  }],
  domainCount: {
    type: Number,
    default: 0
  },
  
  // Clustering reasons
  clusteringReasons: [{
    type: String,
    enum: ['shared_ip', 'shared_registrar', 'shared_target', 'similar_pattern']
  }],
  
  // Infrastructure
  sharedIPs: [String],
  sharedRegistrars: [String],
  targetBrands: [String],
  
  // Statistics
  totalInteractions: {
    type: Number,
    default: 0
  },
  affectedUsers: [{
    userId: String,
    userEmail: String,
    interactionCount: Number
  }],
  
  // Severity assessment
  overallSeverity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  averageRiskScore: {
    type: Number,
    default: 0
  },
  
  // Neo4j reference
  neo4jNodeId: String,
  
  // Timestamps
  detectedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  resolvedAt: Date
}, {
  timestamps: true
});

// Indexes
CampaignLogSchema.index({ status: 1, detectedAt: -1 });
CampaignLogSchema.index({ overallSeverity: 1 });
CampaignLogSchema.index({ domainCount: -1 });

export default mongoose.models.CampaignLog || mongoose.model('CampaignLog', CampaignLogSchema);
