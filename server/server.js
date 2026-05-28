// ─────────────────────────────────────────────────
// Personal Finance Tracker – Main Entry Point
// ─────────────────────────────────────────────────

// Load environment variables FIRST, before any other imports that depend on them
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
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
// Global Middleware
// ─────────────────────────────────────────────────

// Security headers
app.use(helmet());

// CORS – allow all origins in development; restrict in production
app.use(cors());

// Request logging
app.use(morgan('dev'));

// Parse JSON request bodies (limit 10 MB)
app.use(express.json({ limit: '10mb' }));

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
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/borrowings', borrowingRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ─────────────────────────────────────────────────
// 404 handler – no route matched
// ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

// ─────────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error.',
  });
});

// ─────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────
async function startServer() {
  try {
    // Initialize database tables before accepting requests
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`🚀 Finance Tracker API server running on http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
