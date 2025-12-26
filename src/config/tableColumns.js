/**
 * @fileoverview Table column configuration for dynamic rendering.
 * Defines all possible columns with display metadata.
 * @module config/tableColumns
 */

/**
 * @typedef {Object} ColumnConfig
 * @property {string} key - Database/object field name
 * @property {string} label - Display header
 * @property {string} [format] - Format type: 'number', 'code', 'boolean', or default (string)
 * @property {number} [decimals] - Decimal places for number format
 * @property {boolean} [bold] - Whether to bold the value
 */

/** @type {ColumnConfig[]} */
const TABLE_COLUMNS = [
  // Identity
  { key: 'model_filename', label: 'Model' },
  { key: 'model_type', label: 'Type' },

  // Test info
  { key: 'test_type', label: 'Test' },
  { key: 'n_prompt', label: 'Prompt' },
  { key: 'n_gen', label: 'Gen' },
  { key: 'n_depth', label: 'Depth' },

  // Results (primary metrics)
  { key: 'tokens_per_second', label: 't/s', format: 'number', decimals: 2, bold: true },
  { key: 'stddev', label: 'Stddev', format: 'number', decimals: 2 },

  // Hardware
  { key: 'gpu_info', label: 'GPU' },
  { key: 'backend', label: 'Backend' },

  // Parameters
  { key: 'n_batch', label: 'Batch' },
  { key: 'n_ubatch', label: 'uBatch' },
  { key: 'n_threads', label: 'Threads' },
  { key: 'n_gpu_layers', label: 'GPU Layers' },
  { key: 'n_ctx', label: 'Context' },

  // GPU config
  { key: 'split_mode', label: 'Split Mode' },
  { key: 'main_gpu', label: 'Main GPU' },

  // Features
  { key: 'flash_attn', label: 'Flash Attn', format: 'boolean' },
  { key: 'cache_type_k', label: 'K Cache' },
  { key: 'cache_type_v', label: 'V Cache' },
  { key: 'embeddings', label: 'Embeddings', format: 'boolean' },

  // Build info
  { key: 'build_commit', label: 'Build', format: 'code' },
  { key: 'build_number', label: 'Build #' },
  { key: 'test_time', label: 'Time' },
];

/**
 * Detect which columns have at least one non-null value in the data.
 * @param {Object[]} data - Array of benchmark objects
 * @returns {ColumnConfig[]} Columns that have data
 */
function getActiveColumns(data) {
  if (!data || data.length === 0) {
    return [];
  }

  return TABLE_COLUMNS.filter(col => {
    return data.some(row => {
      const val = row[col.key];
      return val !== null && val !== undefined && val !== '';
    });
  });
}

/**
 * Format a cell value based on column configuration.
 * @param {*} value - The raw value
 * @param {ColumnConfig} column - Column configuration
 * @returns {string} Formatted value for display
 */
function formatCellValue(value, column) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  switch (column.format) {
    case 'number':
      const num = typeof value === 'number' ? value : parseFloat(value);
      return isNaN(num) ? String(value) : num.toFixed(column.decimals || 0);

    case 'code':
      // Truncate commit hashes
      return typeof value === 'string' && value.length > 7
        ? value.substring(0, 7)
        : String(value);

    case 'boolean':
      return value === 1 || value === true || value === '1' ? 'Yes' : 'No';

    default:
      return String(value);
  }
}

module.exports = {
  TABLE_COLUMNS,
  getActiveColumns,
  formatCellValue
};
