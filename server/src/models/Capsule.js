const mongoose = require('mongoose');

const capsuleSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    contentType: { type: String, enum: ['text', 'image', 'file'], default: 'text' },

    // --- cryptographic fields: never returned by the API ---
    encryptedContent: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    wrappedKey: { type: String, required: true },
    keyVersion: { type: Number, default: 1 },
    contentHash: { type: String, required: true },

    // --- unlock condition (exactly one mode) ---
    unlockMode: { type: String, enum: ['date', 'event', 'inactivity'], required: true },
    unlockDate: Date,
    eventName: String,
    eventConfirmed: { type: Boolean, default: false },
    confirmerContactId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrustedContact' },
    eventTokenHash: String,
    inactivityDays: Number,

    // --- recipient ---
    recipientEmail: { type: String, required: true, lowercase: true, trim: true }, // deliberate snapshot
    recipientContactId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrustedContact' },

    // --- lifecycle ---
    status: { type: String, enum: ['LOCKED', 'UNLOCKED', 'TAMPERED', 'DELIVERED'], default: 'LOCKED' },
    processingAt: Date, // atomic claim for at-most-once processing
    unlockedAt: Date,
    deliveredAt: Date,
    accessTokenHash: String,
    accessTokenExpiry: Date,
    reminderSentAt: Date,
    tamperAlertSentAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

capsuleSchema.index({ ownerId: 1, createdAt: -1 });
capsuleSchema.index({ status: 1, unlockMode: 1, unlockDate: 1 });
capsuleSchema.index({ accessTokenHash: 1 }, { sparse: true });
capsuleSchema.index({ eventTokenHash: 1 }, { sparse: true });

module.exports = mongoose.model('Capsule', capsuleSchema);
