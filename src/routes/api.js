/**
 * @fileoverview REST API routes for benchmark data operations.
 * Provides endpoints for submitting, querying, and managing benchmark data.
 * @module routes/api
 */

const express = require('express');

/** @type {express.Router} */
const router = express.Router();
const queries = require('../db/queries');
const { transformBenchmark, parseJsonl } = require('../models/benchmark');

/**
 * POST /api/benchmarks - Submit benchmark results.
 * Accepts JSON array, single JSON object, or JSONL format.
 * @name PostBenchmarks
 * @route {POST} /api/benchmarks
 * @bodyparam {Object|Object[]} body - Benchmark data in JSON or JSONL format
 * @returns {Object} Success response with insert count
 */
router.post('/benchmarks', (req, res) => {
  try {
    let data;
    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('application/x-ndjson') || typeof req.body === 'string') {
      // JSONL format
      data = parseJsonl(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    } else {
      // JSON format (array or single object)
      data = Array.isArray(req.body) ? req.body : [req.body];
    }

    const benchmarks = data.map(transformBenchmark);
    const count = queries.insertBenchmarks(benchmarks);

    res.json({ success: true, inserted: count });
  } catch (error) {
    console.error('Error inserting benchmarks:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/benchmarks - Query benchmarks with optional filters.
 * @name GetBenchmarks
 * @route {GET} /api/benchmarks
 * @queryparam {number} [limit=100] - Maximum results to return
 * @queryparam {number} [offset=0] - Number of results to skip
 * @queryparam {string} [model] - Filter by model filename
 * @queryparam {string} [commit] - Filter by build commit
 * @queryparam {string} [test_type] - Filter by test type
 * @queryparam {string} [start_date] - Filter by minimum date
 * @queryparam {string} [end_date] - Filter by maximum date
 * @returns {Object[]} Array of benchmark records
 */
router.get('/benchmarks', (req, res) => {
  try {
    const { limit, offset, model, commit, test_type, start_date, end_date } = req.query;
    const benchmarks = queries.getBenchmarks({
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0,
      model,
      commit,
      testType: test_type,
      startDate: start_date,
      endDate: end_date
    });
    res.json(benchmarks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/models - List all unique models.
 * @name GetModels
 * @route {GET} /api/models
 * @returns {Object[]} Array of unique model records
 */
router.get('/models', (req, res) => {
  try {
    const models = queries.getModels();
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/builds - List all unique builds.
 * @name GetBuilds
 * @route {GET} /api/builds
 * @returns {Object[]} Array of unique build records with latest test time
 */
router.get('/builds', (req, res) => {
  try {
    const builds = queries.getBuilds();
    res.json(builds);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trends - Get trend data for performance charts.
 * @name GetTrends
 * @route {GET} /api/trends
 * @queryparam {string} [model] - Filter by model filename
 * @queryparam {string} [test_type='tg'] - Filter by test type
 * @queryparam {string} [group_by='build_commit'] - Column to group by
 * @returns {Object[]} Array of aggregated trend data points
 */
router.get('/trends', (req, res) => {
  try {
    const { model, test_type, group_by } = req.query;
    const trends = queries.getTrends({
      model,
      testType: test_type || 'tg',
      groupBy: group_by || 'build_commit'
    });
    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/stats - Get dashboard statistics.
 * @name GetStats
 * @route {GET} /api/stats
 * @returns {Object} Dashboard statistics including totals, averages, and recent benchmarks
 */
router.get('/stats', (req, res) => {
  try {
    const stats = queries.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/compare - Get comparison data for models/builds.
 * @name GetCompare
 * @route {GET} /api/compare
 * @queryparam {string} [models] - Comma-separated list of model filenames
 * @queryparam {string} [commits] - Comma-separated list of build commits
 * @queryparam {string} [test_type='tg'] - Filter by test type
 * @returns {Object[]} Array of comparison data records
 */
router.get('/compare', (req, res) => {
  try {
    const { models, commits, test_type } = req.query;
    const data = queries.getComparisonData({
      models: models ? models.split(',') : [],
      commits: commits ? commits.split(',') : [],
      testType: test_type || 'tg'
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/benchmarks - Delete benchmarks by IDs.
 * @name DeleteBenchmarks
 * @route {DELETE} /api/benchmarks
 * @bodyparam {number[]} ids - Array of benchmark IDs to delete
 * @returns {Object} Success response with delete count
 */
router.delete('/benchmarks', (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const parsedIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    if (parsedIds.length === 0) {
      return res.status(400).json({ error: 'No valid ids provided' });
    }
    const deleted = queries.deleteBenchmarks(parsedIds);
    res.json({ success: true, deleted });
  } catch (error) {
    console.error('Error deleting benchmarks:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
