require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes       = require('./routes/auth');
const clientRoutes     = require('./routes/clients');
const noteRoutes       = require('./routes/notes');
const categoryRoutes   = require('./routes/categories');
const userRoutes       = require('./routes/users');
const reportRoutes     = require('./routes/reports');
const activityRoutes   = require('./routes/activity');

const app = express();

// ── Security ────────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = [
  (process.env.FRONTEND_URL || '').replace(/\/$/, ''),
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    const clean = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(clean)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));

// ── Rate limiting ────────────────────────────────────────────
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 20,
  message: { error: 'Too many requests, please try again later' },
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
}));

// ── Body parsing ─────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ──────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Health check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ── API routes ───────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/clients',    clientRoutes);
app.use('/api/notes',      noteRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/reports',    reportRoutes);
app.use('/api/activity',   activityRoutes);

// ── 404 ──────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ─────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 IssueTrack CRM API running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health:      http://localhost:${PORT}/health\n`);
});

module.exports = app;
