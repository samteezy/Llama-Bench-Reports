/**
 * @fileoverview Express server entry point for Llama Bench Reports.
 * Initializes the web server, configures middleware, and sets up routes
 * for the benchmark visualization application.
 * @module server
 */

const express = require('express');
const path = require('path');
const db = require('./src/db');
const apiRoutes = require('./src/routes/api');
const webRoutes = require('./src/routes/web');

/** @type {express.Application} */
const app = express();

/** @type {number} Server port from environment or default 3000 */
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes - JSON parsing only for API routes
app.use('/api', express.json({ limit: '10mb' }), express.text({ type: 'application/x-ndjson', limit: '10mb' }), apiRoutes);
app.use('/', webRoutes);

/**
 * Global error handler middleware.
 * @param {Error} err - The error object
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @param {express.NextFunction} next - Express next function
 */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
db.initialize();

app.listen(PORT, () => {
  console.log(`Llama Bench Reports running at http://localhost:${PORT}`);
});
