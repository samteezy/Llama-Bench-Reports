/**
 * @fileoverview Database query functions for benchmark data operations.
 * Provides CRUD operations and aggregation queries for benchmarks.
 * @module db/queries
 */

const { getDb } = require('./index');
const { VALID_DIMENSION_KEYS, filterValidDimensions } = require('../config/dimensions');

/**
 * @typedef {Object} BenchmarkData
 * @property {string|null} build_commit - Git commit hash of the build
 * @property {number|null} build_number - Build number
 * @property {string|null} test_time - ISO timestamp of the test
 * @property {string|null} cpu_info - CPU information
 * @property {string|null} gpu_info - GPU information
 * @property {string|null} backend - Backend used (e.g., CUDA, Metal)
 * @property {string|null} model_filename - Model file name
 * @property {string|null} model_type - Model architecture type
 * @property {number|null} model_size - Model size in bytes
 * @property {number|null} model_n_params - Number of model parameters
 * @property {string|null} test_type - Test type ('pp', 'tg', or 'pp+tg')
 * @property {number|null} n_prompt - Number of prompt tokens
 * @property {number|null} n_gen - Number of generated tokens
 * @property {number|null} n_depth - Context depth (for -d parameter)
 * @property {number|null} n_batch - Batch size
 * @property {number|null} n_ubatch - Micro batch size
 * @property {number|null} n_threads - Number of threads
 * @property {number|null} n_gpu_layers - Number of GPU layers
 * @property {number|null} n_ctx - Context size
 * @property {number} flash_attn - Flash attention enabled (0 or 1)
 * @property {string|null} cache_type_k - Key cache type
 * @property {string|null} cache_type_v - Value cache type
 * @property {number} embeddings - Embeddings enabled (0 or 1)
 * @property {string|null} split_mode - GPU split mode ('none', 'layer', or 'row')
 * @property {number|null} main_gpu - Main GPU device index
 * @property {number|null} tokens_per_second - Tokens per second result
 * @property {number|null} stddev - Standard deviation of results
 * @property {string|null} samples - JSON string of sample data
 */

/** @type {string} SQL statement for inserting a benchmark record */
const INSERT_BENCHMARK = `
  INSERT INTO benchmarks (
    build_commit, build_number, test_time,
    cpu_info, gpu_info, backend,
    model_filename, model_type, model_size, model_n_params,
    test_type, n_prompt, n_gen, n_depth, n_batch, n_ubatch, n_threads, n_gpu_layers,
    n_ctx, flash_attn, cache_type_k, cache_type_v, embeddings,
    split_mode, main_gpu,
    tokens_per_second, stddev, samples
  ) VALUES (
    @build_commit, @build_number, @test_time,
    @cpu_info, @gpu_info, @backend,
    @model_filename, @model_type, @model_size, @model_n_params,
    @test_type, @n_prompt, @n_gen, @n_depth, @n_batch, @n_ubatch, @n_threads, @n_gpu_layers,
    @n_ctx, @flash_attn, @cache_type_k, @cache_type_v, @embeddings,
    @split_mode, @main_gpu,
    @tokens_per_second, @stddev, @samples
  )
`;

/**
 * Insert a single benchmark record into the database.
 * @param {BenchmarkData} data - The benchmark data to insert
 * @returns {Database.RunResult} The result of the insert operation
 */
function insertBenchmark(data) {
  const db = getDb();
  const stmt = db.prepare(INSERT_BENCHMARK);
  return stmt.run(data);
}

/**
 * Insert multiple benchmark records in a single transaction.
 * @param {BenchmarkData[]} benchmarks - Array of benchmark data to insert
 * @returns {number} The number of records inserted
 */
function insertBenchmarks(benchmarks) {
  const db = getDb();
  const stmt = db.prepare(INSERT_BENCHMARK);
  const insertMany = db.transaction((items) => {
    for (const item of items) {
      stmt.run(item);
    }
    return items.length;
  });
  return insertMany(benchmarks);
}

/**
 * @typedef {Object} GetBenchmarksOptions
 * @property {number} [limit=100] - Maximum number of records to return
 * @property {number} [offset=0] - Number of records to skip
 * @property {string} [model] - Filter by model filename (partial match)
 * @property {string} [commit] - Filter by exact build commit
 * @property {string} [testType] - Filter by test type ('pp', 'tg', 'pp+tg')
 * @property {string} [startDate] - Filter by minimum test time
 * @property {string} [endDate] - Filter by maximum test time
 */

/**
 * Query benchmarks with optional filtering and pagination.
 * @param {GetBenchmarksOptions} [options] - Query options
 * @returns {Object[]} Array of benchmark records
 */
function getBenchmarks({ limit = 100, offset = 0, model, commit, testType, startDate, endDate } = {}) {
  const db = getDb();
  let query = 'SELECT * FROM benchmarks WHERE 1=1';
  const params = {};

  if (model) {
    query += ' AND model_filename LIKE @model';
    params.model = `%${model}%`;
  }
  if (commit) {
    query += ' AND build_commit = @commit';
    params.commit = commit;
  }
  if (testType) {
    query += ' AND test_type = @testType';
    params.testType = testType;
  }
  if (startDate) {
    query += ' AND test_time >= @startDate';
    params.startDate = startDate;
  }
  if (endDate) {
    query += ' AND test_time <= @endDate';
    params.endDate = endDate;
  }

  query += ' ORDER BY created_at DESC LIMIT @limit OFFSET @offset';
  params.limit = limit;
  params.offset = offset;

  return db.prepare(query).all(params);
}

/**
 * Get all unique models from the database.
 * @returns {{model_filename: string, model_type: string, model_size: number, model_n_params: number}[]} Array of unique model records
 */
function getModels() {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT model_filename, model_type, model_size, model_n_params
    FROM benchmarks
    ORDER BY model_filename
  `).all();
}

/**
 * Get all unique builds from the database, ordered by most recent test.
 * @returns {{build_commit: string, build_number: number, latest_test: string}[]} Array of unique build records
 */
function getBuilds() {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT build_commit, build_number, MAX(test_time) as latest_test
    FROM benchmarks
    GROUP BY build_commit
    ORDER BY latest_test DESC
  `).all();
}

/**
 * Get all unique GPUs from the database.
 * Splits multi-GPU entries (separated by ', ') into individual GPUs.
 * @returns {{gpu_info: string}[]} Array of unique GPU records
 */
function getGpus() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT DISTINCT gpu_info
    FROM benchmarks
    WHERE gpu_info IS NOT NULL AND gpu_info != ''
  `).all();

  // Extract individual GPUs from multi-GPU strings (split by ', ')
  const gpuSet = new Set();
  for (const row of rows) {
    const gpus = row.gpu_info.split(', ').map(g => g.trim()).filter(g => g);
    for (const gpu of gpus) {
      gpuSet.add(gpu);
    }
  }

  // Convert to array of objects and sort
  return Array.from(gpuSet)
    .sort()
    .map(gpu => ({ gpu_info: gpu }));
}

/**
 * Get all unique main GPU values from the database.
 * @returns {{main_gpu: number}[]} Array of unique main GPU records
 */
function getMainGpus() {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT main_gpu
    FROM benchmarks
    WHERE main_gpu IS NOT NULL
    ORDER BY main_gpu
  `).all();
}

/**
 * Get all unique split modes from the database.
 * @returns {{split_mode: string}[]} Array of unique split mode records
 */
function getSplitModes() {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT split_mode
    FROM benchmarks
    WHERE split_mode IS NOT NULL AND split_mode != ''
    ORDER BY split_mode
  `).all();
}

/**
 * @typedef {Object} GetTrendsOptions
 * @property {string} [model] - Filter by model filename (partial match)
 * @property {string} [testType='tg'] - Filter by test type
 * @property {string} [groupBy='build_commit'] - Column to group results by
 */

/**
 * @typedef {Object} TrendData
 * @property {string} [build_commit] - Build commit (when groupBy is 'build_commit')
 * @property {string} test_time - Test timestamp
 * @property {number} avg_tps - Average tokens per second
 * @property {number} min_tps - Minimum tokens per second
 * @property {number} max_tps - Maximum tokens per second
 * @property {number} sample_count - Number of samples
 */

/** @type {string[]} Valid columns for groupBy parameter in getTrends */
const VALID_GROUP_BY_COLUMNS = ['build_commit', 'model_filename', 'model_type', 'gpu_info', 'test_type', 'backend', ...VALID_DIMENSION_KEYS];

/**
 * Get aggregated trend data for performance over time.
 * @param {GetTrendsOptions} [options] - Query options
 * @returns {TrendData[]} Array of trend data points
 */
function getTrends({ model, testType = 'tg', groupBy = 'build_commit' } = {}) {
  const db = getDb();

  // Validate groupBy to prevent SQL injection
  if (!VALID_GROUP_BY_COLUMNS.includes(groupBy)) {
    groupBy = 'build_commit';
  }

  let query = `
    SELECT
      ${groupBy},
      test_time,
      AVG(tokens_per_second) as avg_tps,
      MIN(tokens_per_second) as min_tps,
      MAX(tokens_per_second) as max_tps,
      COUNT(*) as sample_count
    FROM benchmarks
    WHERE test_type = @testType
  `;
  const params = { testType };

  if (model) {
    query += ' AND model_filename LIKE @model';
    params.model = `%${model}%`;
  }

  query += ` GROUP BY ${groupBy} ORDER BY test_time ASC`;

  return db.prepare(query).all(params);
}

/**
 * @typedef {Object} GetTrendsMultiSeriesOptions
 * @property {string[]} [models=[]] - Filter by model filenames (exact match)
 * @property {string[]} [gpus=[]] - Filter by GPU info (partial match, supports multi-GPU strings)
 * @property {string[]} [testTypes=['pp', 'tg']] - Filter by test types
 * @property {number[]} [mainGpus=[]] - Filter by main GPU device index
 * @property {string[]} [splitModes=[]] - Filter by split mode (none, layer, row)
 */

/**
 * @typedef {Object} TrendMultiSeriesData
 * @property {string} build_commit - Build commit hash
 * @property {string} model_filename - Model filename
 * @property {string} gpu_info - GPU information
 * @property {string} test_type - Test type (pp or tg)
 * @property {string} test_time - Test timestamp
 * @property {number} avg_tps - Average tokens per second
 * @property {number} sample_count - Number of samples
 */

/**
 * Get multi-series trend data grouped by build, model, GPU, and test type.
 * Used for comparing performance across different configurations.
 * @param {GetTrendsMultiSeriesOptions} [options] - Query options
 * @returns {TrendMultiSeriesData[]} Array of trend data points for multi-line charts
 */
function getTrendsMultiSeries({ models = [], gpus = [], testTypes = ['pp', 'tg'], mainGpus = [], splitModes = [] } = {}) {
  const db = getDb();
  const params = {};
  const conditions = [];

  // Build test types condition
  if (testTypes.length > 0) {
    const testTypePlaceholders = testTypes.map((_, i) => `@testType${i}`).join(', ');
    conditions.push(`test_type IN (${testTypePlaceholders})`);
    testTypes.forEach((t, i) => params[`testType${i}`] = t);
  }

  // Build models condition (exact match when specified)
  if (models.length > 0) {
    const modelPlaceholders = models.map((_, i) => `@model${i}`).join(', ');
    conditions.push(`model_filename IN (${modelPlaceholders})`);
    models.forEach((m, i) => params[`model${i}`] = m);
  }

  // Build GPUs condition (partial match to support multi-GPU strings like "GPU A/GPU B")
  if (gpus.length > 0) {
    const gpuConditions = gpus.map((_, i) => `gpu_info LIKE @gpu${i}`);
    conditions.push(`(${gpuConditions.join(' OR ')})`);
    gpus.forEach((g, i) => params[`gpu${i}`] = `%${g}%`);
  }

  // Build main GPU condition
  if (mainGpus.length > 0) {
    const mainGpuPlaceholders = mainGpus.map((_, i) => `@mainGpu${i}`).join(', ');
    conditions.push(`main_gpu IN (${mainGpuPlaceholders})`);
    mainGpus.forEach((g, i) => params[`mainGpu${i}`] = g);
  }

  // Build split mode condition
  if (splitModes.length > 0) {
    const splitModePlaceholders = splitModes.map((_, i) => `@splitMode${i}`).join(', ');
    conditions.push(`split_mode IN (${splitModePlaceholders})`);
    splitModes.forEach((s, i) => params[`splitMode${i}`] = s);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT
      build_commit,
      model_filename,
      gpu_info,
      test_type,
      MAX(test_time) as test_time,
      AVG(tokens_per_second) as avg_tps,
      COUNT(*) as sample_count
    FROM benchmarks
    ${whereClause}
    GROUP BY build_commit, model_filename, gpu_info, test_type
    ORDER BY test_time ASC, model_filename, gpu_info, test_type
  `;

  return db.prepare(query).all(params);
}

/**
 * @typedef {Object} DashboardStats
 * @property {number} total_benchmarks - Total number of benchmarks
 * @property {number} unique_models - Number of unique models
 * @property {number} unique_builds - Number of unique builds
 * @property {number|null} avg_tg_tps - Average token generation speed
 * @property {number|null} avg_pp_tps - Average prompt processing speed
 * @property {string|null} latest_test - Most recent test timestamp
 * @property {Object[]} recentBenchmarks - Array of 10 most recent benchmarks
 */

/**
 * Get dashboard statistics including aggregates and recent benchmarks.
 * @returns {DashboardStats} Dashboard statistics object
 */
function getStats() {
  const db = getDb();
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_benchmarks,
      COUNT(DISTINCT model_filename) as unique_models,
      COUNT(DISTINCT build_commit) as unique_builds,
      AVG(CASE WHEN test_type = 'tg' THEN tokens_per_second END) as avg_tg_tps,
      AVG(CASE WHEN test_type = 'pp' THEN tokens_per_second END) as avg_pp_tps,
      MAX(test_time) as latest_test
    FROM benchmarks
  `).get();

  const recentBenchmarks = db.prepare(`
    SELECT * FROM benchmarks
    ORDER BY created_at DESC
    LIMIT 10
  `).all();

  return { ...stats, recentBenchmarks };
}

/**
 * @typedef {Object} GetComparisonOptions
 * @property {string[]} [models=[]] - Filter by model filenames (exact match)
 * @property {string[]} [commits=[]] - Filter by build commits (exact match)
 * @property {string} [testType='tg'] - Filter by test type
 */

/**
 * @typedef {Object} ComparisonData
 * @property {string} model_filename - Model filename
 * @property {string} build_commit - Build commit hash
 * @property {string} test_type - Test type
 * @property {number} avg_tps - Average tokens per second
 * @property {number} avg_stddev - Average standard deviation
 * @property {number} runs - Number of test runs
 */

/**
 * Get comparison data for models and/or builds.
 * @param {GetComparisonOptions} [options] - Query options
 * @returns {ComparisonData[]} Array of comparison data records
 */
function getComparisonData({ models = [], commits = [], testType = 'tg' } = {}) {
  const db = getDb();

  let query = `
    SELECT
      model_filename,
      build_commit,
      test_type,
      AVG(tokens_per_second) as avg_tps,
      AVG(stddev) as avg_stddev,
      COUNT(*) as runs
    FROM benchmarks
    WHERE test_type = @testType
  `;
  const params = { testType };

  if (models.length > 0) {
    query += ` AND model_filename IN (${models.map((_, i) => `@model${i}`).join(', ')})`;
    models.forEach((m, i) => params[`model${i}`] = m);
  }
  if (commits.length > 0) {
    query += ` AND build_commit IN (${commits.map((_, i) => `@commit${i}`).join(', ')})`;
    commits.forEach((c, i) => params[`commit${i}`] = c);
  }

  query += ' GROUP BY model_filename, build_commit ORDER BY model_filename, build_commit';

  return db.prepare(query).all(params);
}

/**
 * @typedef {Object} GetBenchmarksFilteredOptions
 * @property {string[]} [models=[]] - Filter by model filenames (exact match)
 * @property {string[]} [gpus=[]] - Filter by GPU info (partial match)
 * @property {string[]} [testTypes=['pp','tg']] - Filter by test types
 * @property {number[]} [mainGpus=[]] - Filter by main GPU device index
 * @property {string[]} [splitModes=[]] - Filter by split mode (none, layer, row)
 * @property {Object.<string, (string|number)[]>} [dimensionFilters={}] - Dynamic dimension filters
 * @property {number} [limit=100] - Maximum number of records to return
 */

/**
 * Get benchmarks with multi-select filters matching the trends page.
 * Supports both legacy filters and new dimensional analysis filters.
 * @param {GetBenchmarksFilteredOptions} [options] - Query options
 * @returns {Object[]} Array of benchmark records
 */
function getBenchmarksFiltered({ models = [], gpus = [], testTypes = ['pp', 'tg'], mainGpus = [], splitModes = [], dimensionFilters = {}, limit = 100 } = {}) {
  const db = getDb();
  const params = {};
  const conditions = [];

  // Build test types condition
  if (testTypes.length > 0) {
    const testTypePlaceholders = testTypes.map((_, i) => `@testType${i}`).join(', ');
    conditions.push(`test_type IN (${testTypePlaceholders})`);
    testTypes.forEach((t, i) => params[`testType${i}`] = t);
  }

  // Build models condition (exact match when specified)
  if (models.length > 0) {
    const modelPlaceholders = models.map((_, i) => `@model${i}`).join(', ');
    conditions.push(`model_filename IN (${modelPlaceholders})`);
    models.forEach((m, i) => params[`model${i}`] = m);
  }

  // Build GPUs condition (partial match to support multi-GPU strings)
  if (gpus.length > 0) {
    const gpuConditions = gpus.map((_, i) => `gpu_info LIKE @gpu${i}`);
    conditions.push(`(${gpuConditions.join(' OR ')})`);
    gpus.forEach((g, i) => params[`gpu${i}`] = `%${g}%`);
  }

  // Build main GPU condition
  if (mainGpus.length > 0) {
    const mainGpuPlaceholders = mainGpus.map((_, i) => `@mainGpu${i}`).join(', ');
    conditions.push(`main_gpu IN (${mainGpuPlaceholders})`);
    mainGpus.forEach((g, i) => params[`mainGpu${i}`] = g);
  }

  // Build split mode condition
  if (splitModes.length > 0) {
    const splitModePlaceholders = splitModes.map((_, i) => `@splitMode${i}`).join(', ');
    conditions.push(`split_mode IN (${splitModePlaceholders})`);
    splitModes.forEach((s, i) => params[`splitMode${i}`] = s);
  }

  // Build dynamic dimension filter conditions
  let filterIdx = 0;
  Object.entries(dimensionFilters).forEach(([dimension, values]) => {
    if (!VALID_DIMENSION_KEYS.includes(dimension) || !Array.isArray(values) || values.length === 0) {
      return;
    }
    const placeholders = values.map((_, i) => `@dimFilter${filterIdx}_${i}`).join(', ');
    conditions.push(`${dimension} IN (${placeholders})`);
    values.forEach((v, i) => params[`dimFilter${filterIdx}_${i}`] = v);
    filterIdx++;
  });

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.limit = limit;

  const query = `
    SELECT * FROM benchmarks
    ${whereClause}
    ORDER BY test_time DESC
    LIMIT @limit
  `;

  return db.prepare(query).all(params);
}

/**
 * Delete benchmarks by their IDs.
 * @param {number[]} ids - Array of benchmark IDs to delete
 * @returns {number} Number of records deleted
 */
function deleteBenchmarks(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return 0;
  }
  const db = getDb();
  const placeholders = ids.map((_, i) => `@id${i}`).join(', ');
  const params = {};
  ids.forEach((id, i) => params[`id${i}`] = id);

  const result = db.prepare(`DELETE FROM benchmarks WHERE id IN (${placeholders})`).run(params);
  return result.changes;
}

/**
 * @typedef {Object} DimensionalTrendsOptions
 * @property {string[]} [groupByDimensions=[]] - Dimensions to create separate series for
 * @property {Object.<string, (string|number)[]>} [filters={}] - Dimension filters (column -> values)
 * @property {string[]} [testTypes=['pp','tg']] - Test types to include
 * @property {string[]} [models=[]] - Model filenames to include
 */

/**
 * @typedef {Object} DimensionalTrendData
 * @property {string} build_commit - Build commit hash
 * @property {string} model_filename - Model filename
 * @property {string} test_type - Test type (pp or tg)
 * @property {string} test_time - Test timestamp
 * @property {number} avg_tps - Average tokens per second
 * @property {number} min_tps - Minimum tokens per second
 * @property {number} max_tps - Maximum tokens per second
 * @property {number} sample_count - Number of samples
 */

/**
 * Get trend data with dynamic dimensional grouping.
 * Allows users to select which dimensions create separate series.
 * @param {DimensionalTrendsOptions} options - Query configuration
 * @returns {DimensionalTrendData[]} Trend data with dimension values for series identification
 */
function getDimensionalTrends({
  groupByDimensions = [],
  filters = {},
  testTypes = ['pp', 'tg'],
  models = []
} = {}) {
  const db = getDb();
  const params = {};
  const conditions = [];

  // Always include model_filename and test_type in grouping for series identification
  const baseGroupBy = ['build_commit', 'model_filename', 'test_type'];

  // Validate and sanitize dimension keys to prevent SQL injection
  const sanitizedGroupBy = filterValidDimensions(groupByDimensions);
  const allGroupBy = [...new Set([...baseGroupBy, ...sanitizedGroupBy])];

  // Build SELECT clause with all group by columns
  const selectColumns = [
    ...allGroupBy,
    'MAX(test_time) as test_time',
    'AVG(tokens_per_second) as avg_tps',
    'MIN(tokens_per_second) as min_tps',
    'MAX(tokens_per_second) as max_tps',
    'AVG(stddev) as avg_stddev',
    'COUNT(*) as sample_count'
  ].join(', ');

  // Test types filter
  if (testTypes.length > 0) {
    const placeholders = testTypes.map((_, i) => `@testType${i}`).join(', ');
    conditions.push(`test_type IN (${placeholders})`);
    testTypes.forEach((t, i) => params[`testType${i}`] = t);
  }

  // Models filter
  if (models.length > 0) {
    const placeholders = models.map((_, i) => `@model${i}`).join(', ');
    conditions.push(`model_filename IN (${placeholders})`);
    models.forEach((m, i) => params[`model${i}`] = m);
  }

  // Dynamic dimension filters (hold constant)
  let filterIdx = 0;
  Object.entries(filters).forEach(([dimension, values]) => {
    if (!VALID_DIMENSION_KEYS.includes(dimension) || !Array.isArray(values) || values.length === 0) {
      return;
    }
    const placeholders = values.map((_, i) => `@filter${filterIdx}_${i}`).join(', ');
    conditions.push(`${dimension} IN (${placeholders})`);
    values.forEach((v, i) => params[`filter${filterIdx}_${i}`] = v);
    filterIdx++;
  });

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT ${selectColumns}
    FROM benchmarks
    ${whereClause}
    GROUP BY ${allGroupBy.join(', ')}
    ORDER BY test_time ASC
  `;

  return db.prepare(query).all(params);
}

/**
 * @typedef {Object} DimensionValue
 * @property {*} value - The dimension value
 * @property {number} count - Number of occurrences
 */

/**
 * Get unique values for a dimension (for filter dropdowns).
 * @param {string} dimension - Column name to get values for
 * @returns {DimensionValue[]} Unique values with occurrence counts
 */
function getDimensionValues(dimension) {
  const db = getDb();

  // Validate dimension to prevent SQL injection
  if (!VALID_DIMENSION_KEYS.includes(dimension)) {
    return [];
  }

  return db.prepare(`
    SELECT ${dimension} as value, COUNT(*) as count
    FROM benchmarks
    WHERE ${dimension} IS NOT NULL
    GROUP BY ${dimension}
    ORDER BY ${dimension}
  `).all();
}

/**
 * Get unique values for all dimensions (batch fetch for UI).
 * @returns {Object.<string, DimensionValue[]>} Map of dimension key to values
 */
function getAllDimensionValues() {
  const result = {};
  for (const dimension of VALID_DIMENSION_KEYS) {
    result[dimension] = getDimensionValues(dimension);
  }
  return result;
}

module.exports = {
  insertBenchmark,
  insertBenchmarks,
  getBenchmarks,
  getBenchmarksFiltered,
  getModels,
  getBuilds,
  getGpus,
  getMainGpus,
  getSplitModes,
  getTrends,
  getTrendsMultiSeries,
  getStats,
  getComparisonData,
  deleteBenchmarks,
  getDimensionalTrends,
  getDimensionValues,
  getAllDimensionValues
};
