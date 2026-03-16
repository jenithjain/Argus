import mongoose from 'mongoose';

const PromptInjectionEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  chatSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    required: true,
    index: true,
  },
  messageId: {
    type: String,
    required: true,
    index: true,
  },
  source: {
    type: String,
    default: 'educational-chatbot',
  },
  messageText: {
    type: String,
    required: true,
  },
  riskScore: {
    type: Number,
    required: true,
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
  },
  action: {
    type: String,
    enum: ['allow', 'warn', 'block'],
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  matchedSignals: {
    type: [String],
    default: [],
  },
  detectorReasons: {
    type: [String],
    default: [],
  },
  detectorVersion: {
    type: String,
    default: 'rules-v1',
  },
  clientIp: {
    type: String,
    default: 'unknown',
    index: true,
  },
  forwardedFor: {
    type: String,
    default: '',
  },
  userAgent: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

PromptInjectionEventSchema.index({ userId: 1, createdAt: -1 });
PromptInjectionEventSchema.index({ severity: 1, createdAt: -1 });
PromptInjectionEventSchema.index({ clientIp: 1, createdAt: -1 });

export default mongoose.models.PromptInjectionEvent || mongoose.model('PromptInjectionEvent', PromptInjectionEventSchema);