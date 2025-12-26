/**
 * @fileoverview Web page routes for the benchmark visualization UI.
 * Renders EJS templates for dashboard, benchmarks, trends, and comparison pages.
 * @module routes/web
 */

const express = require('express');

/** @type {express.Router} */
const router = express.Router();
const queries = require('../db/queries');
const { formatBenchmark } = require('../models/benchmark');
const { getDimensionsByGroup, DIMENSIONS, filterValidDimensions } = require('../config/dimensions');
const { getActiveColumns, formatCellValue } = require('../config/tableColumns');

/**
 * GET / - Dashboard page.
 * Displays overview statistics and recent benchmarks.
 * @name Dashboard
 * @route {GET} /
 */
router.get('/', (req, res) => {
  const stats = queries.getStats();
  const recentBenchmarks = stats.recentBenchmarks.map(formatBenchmark);
  res.render('index', { stats, recentBenchmarks });
});

/**
 * GET /benchmarks - Benchmarks listing page.
 * Displays filterable table of all benchmarks with pagination.
 * Supports HTMX partial rendering.
 * @name Benchmarks
 * @route {GET} /benchmarks
 * @queryparam {number} [limit=50] - Results per page
 * @queryparam {number} [offset=0] - Pagination offset
 * @queryparam {string} [model] - Filter by model
 * @queryparam {string} [commit] - Filter by commit
 * @queryparam {string} [test_type] - Filter by test type
 */
router.get('/benchmarks', (req, res) => {
  const { limit, offset, model, commit, test_type } = req.query;
  const benchmarks = queries.getBenchmarks({
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
    model,
    commit,
    testType: test_type
  }).map(formatBenchmark);

  const models = queries.getModels();
  const builds = queries.getBuilds();
  const columns = getActiveColumns(benchmarks);

  // Check if this is an HTMX request
  if (req.headers['hx-request']) {
    return res.render('partials/table', { benchmarks, columns, formatCell: formatCellValue });
  }

  res.render('benchmarks', { benchmarks, models, builds, filters: req.query, columns, formatCell: formatCellValue });
});

/**
 * GET /trends - Performance trends page with dimensional analysis.
 * Displays charts showing performance over time with pivot-table style dimension control.
 * Users can select which dimensions to group by (create series) and which to filter on.
 * @name Trends
 * @route {GET} /trends
 * @queryparam {string|string[]} [models] - Filter by model filenames (multi-select)
 * @queryparam {string|string[]} [test_types=['pp','tg']] - Filter by test types (checkboxes)
 * @queryparam {string|string[]} [group_by] - Dimensions to create separate series for
 * @queryparam {string|string[]} [filter_*] - Dimension filters (e.g., filter_n_batch=512)
 */
router.get('/trends', (req, res) => {
  const models = queries.getModels();
  const builds = queries.getBuilds();
  const dimensionsByGroup = getDimensionsByGroup();

  // Parse model selection
  const selectedModels = req.query.models ? [].concat(req.query.models).filter(m => m) : [];

  // Parse test types (default to pp and tg)
  const testTypes = req.query.test_types ? [].concat(req.query.test_types) : ['pp', 'tg'];

  // Parse group_by dimensions (validated against allowlist)
  const groupByDimensions = req.query.group_by
    ? filterValidDimensions([].concat(req.query.group_by).filter(d => d))
    : [];

  // Parse filter dimensions (filter_<dimension>=value pattern)
  const dimensionFilters = {};
  Object.keys(req.query).forEach(key => {
    if (key.startsWith('filter_')) {
      const dimension = key.replace('filter_', '');
      // Only accept valid dimensions
      if (filterValidDimensions([dimension]).length > 0) {
        const values = [].concat(req.query[key]).filter(v => v !== '');
        if (values.length > 0) {
          // Convert numeric values for numeric dimensions
          const dimConfig = DIMENSIONS.find(d => d.key === dimension);
          if (dimConfig && (dimConfig.type === 'numeric' || dimConfig.type === 'boolean')) {
            dimensionFilters[dimension] = values.map(v => parseInt(v, 10));
          } else {
            dimensionFilters[dimension] = values;
          }
        }
      }
    }
  });

  // Get unique values for all dimensions (for filter dropdowns)
  const dimensionValues = queries.getAllDimensionValues();

  // Fetch trend data with dimensional grouping
  const trends = queries.getDimensionalTrends({
    groupByDimensions,
    filters: dimensionFilters,
    testTypes,
    models: selectedModels
  });

  // Also fetch individual benchmarks for the data table (with same filters)
  const benchmarks = queries.getBenchmarksFiltered({
    models: selectedModels,
    testTypes,
    dimensionFilters
  }).map(formatBenchmark);

  const columns = getActiveColumns(benchmarks);

  res.render('trends', {
    trends,
    benchmarks,
    models,
    builds,
    dimensionsByGroup,
    dimensionValues,
    columns,
    formatCell: formatCellValue,
    filters: {
      models: selectedModels,
      test_types: testTypes,
      group_by: groupByDimensions,
      dimension_filters: dimensionFilters
    }
  });
});

/**
 * GET /compare - Model/build comparison page.
 * Allows side-by-side comparison of benchmark results.
 * @name Compare
 * @route {GET} /compare
 * @queryparam {string} [models] - Comma-separated model filenames
 * @queryparam {string} [commits] - Comma-separated build commits
 * @queryparam {string} [test_type='tg'] - Filter by test type
 */
router.get('/compare', (req, res) => {
  const models = queries.getModels();
  const builds = queries.getBuilds();

  const { models: selectedModels, commits, test_type } = req.query;
  let comparison = [];

  if (selectedModels || commits) {
    comparison = queries.getComparisonData({
      models: selectedModels ? selectedModels.split(',') : [],
      commits: commits ? commits.split(',') : [],
      testType: test_type || 'tg'
    });
  }

  res.render('compare', { comparison, models, builds, filters: req.query });
});

/**
 * GET /partials/table - HTMX partial for benchmark table.
 * Returns only the table HTML for dynamic updates.
 * @name PartialsTable
 * @route {GET} /partials/table
 * @queryparam {number} [limit=50] - Results per page
 * @queryparam {number} [offset=0] - Pagination offset
 * @queryparam {string} [model] - Filter by model
 * @queryparam {string} [commit] - Filter by commit
 * @queryparam {string} [test_type] - Filter by test type
 */
router.get('/partials/table', (req, res) => {
  const { limit, offset, model, commit, test_type } = req.query;
  const benchmarks = queries.getBenchmarks({
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
    model,
    commit,
    testType: test_type
  }).map(formatBenchmark);

  const columns = getActiveColumns(benchmarks);
  res.render('partials/table', { benchmarks, columns, formatCell: formatCellValue });
});

/**
 * GET /partials/trends-chart - HTMX/AJAX endpoint for trends chart data.
 * Returns JSON data for Chart.js visualization.
 * @name PartialsTrendsChart
 * @route {GET} /partials/trends-chart
 * @queryparam {string} [model] - Filter by model
 * @queryparam {string} [test_type='tg'] - Filter by test type
 * @queryparam {string} [group_by='build_commit'] - Column to group by
 * @returns {Object[]} Array of trend data points for charting
 */
router.get('/partials/trends-chart', (req, res) => {
  const { model, test_type, group_by } = req.query;
  const trends = queries.getTrends({
    model,
    testType: test_type || 'tg',
    groupBy: group_by || 'build_commit'
  });

  res.json(trends);
});

module.exports = router;
