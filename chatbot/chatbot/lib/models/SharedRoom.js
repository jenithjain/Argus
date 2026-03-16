import mongoose from 'mongoose';

const SharedRoomMessageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  authorName: {
    type: String,
    required: true,
  },
  authorEmail: {
    type: String,
    default: '',
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

const SharedRoomSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  messages: {
    type: [SharedRoomMessageSchema],
    default: [],
  },
  participantEmails: {
    type: [String],
    default: [],
  },
  lastActivityAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

export default mongoose.models.SharedRoom || mongoose.model('SharedRoom', SharedRoomSchema);