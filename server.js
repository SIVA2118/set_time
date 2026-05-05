require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cron = require('node-cron');

const authRoutes = require('./routes/auth');
const timerRoutes = require('./routes/timers');
const Timer = require('./models/Timer');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/timers', timerRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ─────────────────────────────────────────────────────
// Background job: check expired timers every minute
// Marks timers as "expired" so the app can auto-exit
// ─────────────────────────────────────────────────────
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const result = await Timer.updateMany(
      { expiresAt: { $lte: now }, status: 'active' },
      { $set: { status: 'expired' } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[Cron] Expired ${result.modifiedCount} timer(s) at ${now.toISOString()}`);
    }
  } catch (err) {
    console.error('[Cron] Error expiring timers:', err.message);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
