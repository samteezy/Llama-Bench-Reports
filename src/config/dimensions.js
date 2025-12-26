/**
 * @fileoverview Dimension configuration for pivot table analysis.
 * Defines all available dimensions with metadata for UI and query building.
 * @module config/dimensions
 */

/**
 * @typedef {Object} DimensionConfig
 * @property {string} key - Database column name
 * @property {string} label - Human-readable label
 * @property {string} group - Category for UI grouping
 * @property {string} type - Data type ('numeric', 'text', 'boolean')
 * @property {number} priority - Sort order in UI (lower = higher priority)
 */

/** @type {DimensionConfig[]} */
const DIMENSIONS = [
  // GPU Configuration (Priority 1)
  { key: 'n_gpu_layers', label: 'GPU Layers', group: 'GPU Config', type: 'numeric', priority: 1 },
  { key: 'split_mode', label: 'Split Mode', group: 'GPU Config', type: 'text', priority: 2 },
  { key: 'main_gpu', label: 'Main GPU', group: 'GPU Config', type: 'numeric', priority: 3 },

  // Batching (Priority 2)
  { key: 'n_batch', label: 'Batch Size', group: 'Batching', type: 'numeric', priority: 10 },
  { key: 'n_ubatch', label: 'Micro Batch', group: 'Batching', type: 'numeric', priority: 11 },

  // Context/Test Params (Priority 3)
  { key: 'n_ctx', label: 'Context Size', group: 'Test Params', type: 'numeric', priority: 20 },
  { key: 'n_prompt', label: 'Prompt Tokens', group: 'Test Params', type: 'numeric', priority: 21 },
  { key: 'n_gen', label: 'Gen Tokens', group: 'Test Params', type: 'numeric', priority: 22 },
  { key: 'n_depth', label: 'Context Depth', group: 'Test Params', type: 'numeric', priority: 23 },

  // Features (Priority 4)
  { key: 'flash_attn', label: 'Flash Attention', group: 'Features', type: 'boolean', priority: 30 },
  { key: 'cache_type_k', label: 'K Cache Type', group: 'Features', type: 'text', priority: 31 },
  { key: 'cache_type_v', label: 'V Cache Type', group: 'Features', type: 'text', priority: 32 },
  { key: 'embeddings', label: 'Embeddings', group: 'Features', type: 'boolean', priority: 33 },

  // Hardware/Build (Priority 5)
  { key: 'n_threads', label: 'Threads', group: 'Hardware', type: 'numeric', priority: 40 },
  { key: 'backend', label: 'Backend', group: 'Hardware', type: 'text', priority: 41 },
];

/** @type {string[]} Valid dimension keys for SQL injection prevention */
const VALID_DIMENSION_KEYS = DIMENSIONS.map(d => d.key);

/**
 * Get dimensions grouped by category.
 * @returns {Object.<string, DimensionConfig[]>} Dimensions organized by group
 */
function getDimensionsByGroup() {
  const groups = {};
  DIMENSIONS.sort((a, b) => a.priority - b.priority).forEach(dim => {
    if (!groups[dim.group]) {
      groups[dim.group] = [];
    }
    groups[dim.group].push(dim);
  });
  return groups;
}

/**
 * Get dimension config by key.
 * @param {string} key - Dimension column name
 * @returns {DimensionConfig|undefined}
 */
function getDimension(key) {
  return DIMENSIONS.find(d => d.key === key);
}

/**
 * Validate that a dimension key is valid (for SQL injection prevention).
 * @param {string} key - Dimension key to validate
 * @returns {boolean} True if the key is a valid dimension
 */
function isValidDimension(key) {
  return VALID_DIMENSION_KEYS.includes(key);
}

/**
 * Filter an array of dimension keys to only valid ones.
 * @param {string[]} keys - Array of dimension keys to validate
 * @returns {string[]} Array of valid dimension keys
 */
function filterValidDimensions(keys) {
  return keys.filter(key => isValidDimension(key));
}

module.exports = {
  DIMENSIONS,
  VALID_DIMENSION_KEYS,
  getDimensionsByGroup,
  getDimension,
  isValidDimension,
  filterValidDimensions
};
