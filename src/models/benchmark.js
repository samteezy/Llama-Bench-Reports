/**
 * @fileoverview Data transformation utilities for llama-bench benchmark data.
 * Handles conversion between llama-bench JSON output and database format.
 * @module models/benchmark
 */

/**
 * Determine test type from n_prompt and n_gen values.
 * @param {number} nPrompt - Number of prompt tokens
 * @param {number} nGen - Number of generated tokens
 * @returns {string|null} 'pp' for prompt processing, 'tg' for token generation, 'pp+tg' for mixed
 */
function getTestType(nPrompt, nGen) {
  if (nPrompt > 0 && (!nGen || nGen === 0)) {
    return 'pp';
  }
  if (nGen > 0 && (!nPrompt || nPrompt === 0)) {
    return 'tg';
  }
  // Mixed or unknown test type
  if (nPrompt > 0 && nGen > 0) {
    return 'pp+tg';
  }
  return null;
}

/**
 * Transform llama-bench JSON output to database format
 * @param {Object} data - Raw llama-bench JSON object
 * @returns {Object} Transformed benchmark object for database storage
 */
function transformBenchmark(data) {
  return {
    build_commit: data.build_commit || null,
    build_number: data.build_number || null,
    test_time: data.test_time || new Date().toISOString(),

    cpu_info: data.cpu_info || null,
    gpu_info: data.gpu_info || null,
    // llama-bench outputs 'backends' (plural) but we store as 'backend'
    backend: data.backend || data.backends || null,

    model_filename: data.model_filename || null,
    model_type: data.model_type || null,
    model_size: data.model_size || null,
    model_n_params: data.model_n_params || null,

    test_type: getTestType(data.n_prompt, data.n_gen),
    // Use nullish coalescing (??) to preserve 0 values
    n_prompt: data.n_prompt ?? null,
    n_gen: data.n_gen ?? null,
    n_depth: data.n_depth ?? null,
    n_batch: data.n_batch ?? null,
    n_ubatch: data.n_ubatch ?? null,
    n_threads: data.n_threads ?? null,
    n_gpu_layers: data.n_gpu_layers ?? null,
    n_ctx: data.n_ctx ?? null,
    flash_attn: data.flash_attn ? 1 : 0,
    cache_type_k: data.type_k || null,
    cache_type_v: data.type_v || null,
    embeddings: data.embeddings ? 1 : 0,
    split_mode: data.split_mode || null,
    main_gpu: data.main_gpu ?? null,

    tokens_per_second: data.avg_ts || data.t_s || null,
    stddev: data.stddev_ts || data.stddev || null,
    samples: data.samples ? JSON.stringify(data.samples) : null
  };
}

/**
 * Parse JSONL (newline-delimited JSON) input into an array of objects.
 * @param {string} text - JSONL text with one JSON object per line
 * @returns {Object[]} Array of parsed JSON objects
 * @throws {SyntaxError} If any line contains invalid JSON
 */
function parseJsonl(text) {
  return text
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

/**
 * @typedef {Object} FormattedBenchmark
 * @property {Object[]} samples - Parsed samples array (from JSON string)
 * @property {string|null} model_size_gb - Model size in gigabytes (formatted)
 * @property {string|null} model_params_b - Model parameters in billions (formatted)
 */

/**
 * Format a benchmark record for display in the UI.
 * Parses JSON fields and adds human-readable size/param values.
 * @param {Object} benchmark - Raw benchmark record from database
 * @returns {Object & FormattedBenchmark} Formatted benchmark with additional display fields
 */
function formatBenchmark(benchmark) {
  return {
    ...benchmark,
    samples: benchmark.samples ? JSON.parse(benchmark.samples) : [],
    model_size_gb: benchmark.model_size ? (benchmark.model_size / 1e9).toFixed(2) : null,
    model_params_b: benchmark.model_n_params ? (benchmark.model_n_params / 1e9).toFixed(2) : null
  };
}

module.exports = {
  transformBenchmark,
  parseJsonl,
  formatBenchmark
};
