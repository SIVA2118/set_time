const express = require('express');
const Timer = require('../models/Timer');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All timer routes require auth
router.use(protect);

// POST /api/timers — create a new timer for an app
router.post('/', async (req, res) => {
  try {
    let { appName, appPackage, durationMinutes, durationSeconds } = req.body;

    if (!appName) {
      return res.status(400).json({ message: 'appName is required' });
    }

    // If only minutes provided, convert to seconds
    if (!durationSeconds && durationMinutes) {
      durationSeconds = durationMinutes * 60;
    }

    if (!durationSeconds || durationSeconds < 1) {
      return res.status(400).json({ message: 'Duration must be at least 1 second' });
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + durationSeconds * 1000);

    const timer = await Timer.create({
      userId: req.user._id,
      appName,
      appPackage: appPackage || null,
      durationMinutes: Math.floor(durationSeconds / 60),
      durationSeconds,
      startedAt,
      expiresAt,
    });

    res.status(201).json(timer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/timers — list all timers for the logged-in user
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { userId: req.user._id };
    if (status) filter.status = status;

    const timers = await Timer.find(filter).sort({ createdAt: -1 });
    res.json(timers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/timers/:id — get a single timer (used for polling)
router.get('/:id', async (req, res) => {
  try {
    const timer = await Timer.findOne({ _id: req.params.id, userId: req.user._id });
    if (!timer) return res.status(404).json({ message: 'Timer not found' });
    res.json(timer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/timers/:id/status — update status (pause, cancel)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['paused', 'cancelled', 'active'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${allowed.join(', ')}` });
    }

    const timer = await Timer.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { status } },
      { new: true }
    );
    if (!timer) return res.status(404).json({ message: 'Timer not found' });
    res.json(timer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/timers/:id — delete a timer
router.delete('/:id', async (req, res) => {
  try {
    const timer = await Timer.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!timer) return res.status(404).json({ message: 'Timer not found' });
    res.json({ message: 'Timer deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/timers/:id/check — quick expiry check used by the mobile app
router.get('/:id/check', async (req, res) => {
  try {
    const timer = await Timer.findOne({ _id: req.params.id, userId: req.user._id });
    if (!timer) return res.status(404).json({ message: 'Timer not found' });

    const now = new Date();
    const remainingMs = Math.max(0, timer.expiresAt - now);
    const expired = timer.status === 'expired' || remainingMs === 0;

    // Auto-mark as expired if time is up
    if (expired && timer.status === 'active') {
      timer.status = 'expired';
      await timer.save();
    }

    res.json({
      expired,
      remainingSeconds: Math.floor(remainingMs / 1000),
      status: timer.status,
      expiresAt: timer.expiresAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
