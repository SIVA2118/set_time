const mongoose = require('mongoose');

const timerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    appName: {
      type: String,
      required: true,
      trim: true,
    },
    appPackage: {
      // Android package name or iOS bundle ID (optional, for launching)
      type: String,
      trim: true,
      default: null,
    },
    durationMinutes: {
      // Total allowed time in minutes (legacy)
      type: Number,
      required: false,
    },
    durationSeconds: {
      // Total allowed time in seconds
      type: Number,
      required: true,
      min: 1,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      // Calculated: startedAt + durationMinutes
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'paused', 'cancelled'],
      default: 'active',
    },
    notifiedAt: {
      // When the app sent the expiry notification
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Index for efficient expiry queries
timerSchema.index({ userId: 1, status: 1 });
timerSchema.index({ expiresAt: 1, status: 1 });

// Virtual: remaining seconds
timerSchema.virtual('remainingSeconds').get(function () {
  if (this.status !== 'active') return 0;
  const remaining = Math.floor((this.expiresAt - Date.now()) / 1000);
  return Math.max(0, remaining);
});

timerSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Timer', timerSchema);
