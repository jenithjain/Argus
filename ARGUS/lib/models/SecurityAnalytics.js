import mongoose from 'mongoose';

/**
 * Security Analytics Schema - Logs for URL, Email, and Deepfake detections
 * Tracks all security threats detected by ARGUS modules
 */
const SecurityAnalyticsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Detection type: 'url', 'email', 'deepfake'
  detectionType: {
    type: String,
    required: true,
    enum: ['url', 'email', 'deepfake'],
    index: true
  },
  
  // Timestamp of detection
  detectedAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
  // Verdict: MALICIOUS, HIGH_RISK, SUSPICIOUS, CLEAR for URL/Email
  // FAKE, REAL, UNCERTAIN for deepfake
  verdict: {
    type: String,
    required: true,
    index: true
  },
  
  // Risk score (0-100)
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  
  // Severity level
  severity: {
    type: String,
    enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
    default: 'LOW'
  },
  
  // URL-specific fields
  url: {
    type: String,
    sparse: true
  },
  urlDomain: {
    type: String,
    sparse: true
  },
  
  // Email-specific fields
  emailSender: {
    type: String,
    sparse: true
  },
  emailSubject: {
    type: String,
    sparse: true
  },
  
  // Deepfake-specific fields
  fakeProbability: {
    type: Number,
    min: 0,
    max: 1
  },
  frameCount: {
    type: Number
  },
  analysisMode: {
    type: String
  },
  
  // Common fields
  reason: {
    type: String,
    required: true
  },
  signals: [{
    type: String
  }],
  
  // AI explanation (from Gemini)
  explanation: {
    type: String
  },
  
  // Recommended action
  action: {
    type: String
  },
  
  // Processing metadata
  processingTimeMs: {
    type: Number
  },
  
  // User action taken (if any)
  userAction: {
    type: String,
    enum: ['blocked', 'allowed', 'reported', 'ignored', null],
    default: null
  },
  
  // Session identifier (for grouping related detections)
  sessionId: {
    type: String,
    index: true
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes for common queries
SecurityAnalyticsSchema.index({ userId: 1, detectedAt: -1 });
SecurityAnalyticsSchema.index({ userId: 1, detectionType: 1, detectedAt: -1 });
SecurityAnalyticsSchema.index({ userId: 1, verdict: 1 });
SecurityAnalyticsSchema.index({ userId: 1, severity: 1 });
SecurityAnalyticsSchema.index({ sessionId: 1, detectedAt: -1 });

export default mongoose.models.SecurityAnalytics || mongoose.model('SecurityAnalytics', SecurityAnalyticsSchema);
