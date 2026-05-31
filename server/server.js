// ─────────────────────────────────────────────────
// Personal Finance Tracker – Main Entry Point
// ─────────────────────────────────────────────────

// Load environment variables FIRST, before any other imports that depend on them
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { initializeDatabase } = require('./config/db');

// Import route modules
const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const incomeRoutes = require('./routes/income');
const savingsRoutes = require('./routes/savings');
const borrowingRoutes = require('./routes/borrowing');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────────────
// SECURITY FIX: Trust proxy (required for rate limiting behind Render's reverse proxy)
// ─────────────────────────────────────────────────
app.set('trust proxy', 1);

// ─────────────────────────────────────────────────
// SECURITY FIX: HTTPS enforcement in production (VULN-05)
// ─────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// ─────────────────────────────────────────────────
// Global Middleware
// ─────────────────────────────────────────────────

// Security headers
app.use(helmet());

// SECURITY FIX: CORS – restrict to allowed origins only (VULN-01)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL, // Set this in Render env vars
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// SECURITY FIX: Global rate limiter — 100 requests per 15 min per IP (VULN-02)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});
app.use(globalLimiter);

// SECURITY FIX: Strict rate limiter for auth routes — 10 attempts per 15 min (VULN-02)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
});

// Request logging
app.use(morgan('dev'));

// Parse JSON request bodies (reduced from 10mb to 500kb for security — VULN-11)
app.use(express.json({ limit: '500kb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────────
// Health-check endpoint
// ─────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Finance Tracker API is running',
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────
// Mount API Routes
// ─────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);  // Auth routes get stricter rate limiting
app.use('/api/expenses', expenseRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/borrowings', borrowingRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ─────────────────────────────────────────────────
// 404 handler – no route matched (VULN-10: generic message)
// ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
  });
});

// ─────────────────────────────────────────────────
// Global Error Handler (VULN-04: hide details in production)
// ─────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error.'
      : err.message || 'Internal server error.',
  });
});

// ─────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────
async function startServer() {
  // Start listening FIRST so Render detects the port and doesn't time out
  app.listen(PORT, () => {
    console.log(`🚀 Finance Tracker API server running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  });

  // Then initialize database tables (retry if connection is slow)
  try {
    await initializeDatabase();
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error('⚠️  Server is running but database may not be ready. Retrying in 5s...');
    setTimeout(async () => {
      try {
        await initializeDatabase();
      } catch (retryError) {
        console.error('❌ Database retry failed:', retryError.message);
      }
    }, 5000);
  }
}

startServer();
