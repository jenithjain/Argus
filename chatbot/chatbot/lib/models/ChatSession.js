import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  riskScore: {
    type: Number,
    default: 0,
  },
  riskSeverity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low',
  },
  riskAction: {
    type: String,
    enum: ['allow', 'warn', 'block'],
    default: 'allow',
  },
  category: {
    type: String,
    default: 'benign',
  },
  matchedSignals: {
    type: [String],
    default: [],
  },
  detectorReasons: {
    type: [String],
    default: [],
  },
  blocked: {
    type: Boolean,
    default: false,
  },
}, { _id: false });

const ChatSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  messages: {
    type: [ChatMessageSchema],
    default: [],
  },
  messageCount: {
    type: Number,
    default: 0,
  },
  suspiciousCount: {
    type: Number,
    default: 0,
  },
  blockedCount: {
    type: Number,
    default: 0,
  },
  lastRiskScore: {
    type: Number,
    default: 0,
  },
  lastActivityAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

ChatSessionSchema.index({ userId: 1, lastActivityAt: -1 });

export default mongoose.models.ChatSession || mongoose.model('ChatSession', ChatSessionSchema);