/**
 * @fileoverview SQLite database connection and schema initialization.
 * Handles database setup, migrations, and provides the database instance.
 * @module db
 */

const Database = require('better-sqlite3');
const path = require('path');

/** @type {string} Path to the SQLite database file */
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/benchmarks.db');

/** @type {Database.Database|undefined} Singleton database instance */
let db;

/**
 * Get or create the SQLite database instance.
 * Creates the data directory if it doesn't exist and enables WAL mode.
 * @returns {Database.Database} The SQLite database instance
 */
function getDb() {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

/**
 * Run migrations to add new columns to existing databases
 * @param {Database} database - The SQLite database instance
 */
function runMigrations(database) {
  // Get existing columns
  const columns = database.prepare("PRAGMA table_info(benchmarks)").all();
  const columnNames = columns.map(c => c.name);

  // Add n_prompt column if missing
  if (!columnNames.includes('n_prompt')) {
    database.exec('ALTER TABLE benchmarks ADD COLUMN n_prompt INTEGER');
    console.log('Migration: Added n_prompt column');
  }

  // Add n_gen column if missing
  if (!columnNames.includes('n_gen')) {
    database.exec('ALTER TABLE benchmarks ADD COLUMN n_gen INTEGER');
    console.log('Migration: Added n_gen column');
  }

  // Add split_mode column if missing
  if (!columnNames.includes('split_mode')) {
    database.exec('ALTER TABLE benchmarks ADD COLUMN split_mode TEXT');
    console.log('Migration: Added split_mode column');
  }

  // Add main_gpu column if missing
  if (!columnNames.includes('main_gpu')) {
    database.exec('ALTER TABLE benchmarks ADD COLUMN main_gpu INTEGER');
    console.log('Migration: Added main_gpu column');
  }

  // Add n_depth column if missing (context depth for -d parameter)
  if (!columnNames.includes('n_depth')) {
    database.exec('ALTER TABLE benchmarks ADD COLUMN n_depth INTEGER');
    console.log('Migration: Added n_depth column');
  }
}

/**
 * Initialize the database schema and run migrations.
 * Creates the benchmarks table with all required columns and indexes.
 * @returns {void}
 */
function initialize() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS benchmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      -- Build info
      build_commit TEXT,
      build_number INTEGER,
      test_time TEXT,

      -- Hardware
      cpu_info TEXT,
      gpu_info TEXT,
      backend TEXT,

      -- Model
      model_filename TEXT,
      model_type TEXT,
      model_size INTEGER,
      model_n_params INTEGER,

      -- Test parameters
      test_type TEXT,
      n_prompt INTEGER,
      n_gen INTEGER,
      n_batch INTEGER,
      n_ubatch INTEGER,
      n_threads INTEGER,
      n_gpu_layers INTEGER,
      n_ctx INTEGER,
      flash_attn INTEGER,
      cache_type_k TEXT,
      cache_type_v TEXT,
      embeddings INTEGER,
      split_mode TEXT,
      main_gpu INTEGER,

      -- Results
      tokens_per_second REAL,
      stddev REAL,
      samples TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_build_commit ON benchmarks(build_commit);
    CREATE INDEX IF NOT EXISTS idx_model_filename ON benchmarks(model_filename);
    CREATE INDEX IF NOT EXISTS idx_test_time ON benchmarks(test_time);
    CREATE INDEX IF NOT EXISTS idx_test_type ON benchmarks(test_type);
    CREATE INDEX IF NOT EXISTS idx_gpu_info ON benchmarks(gpu_info);
  `);

  // Run migrations for existing databases
  runMigrations(database);

  console.log(`Database initialized at ${DB_PATH}`);
}

module.exports = { getDb, initialize };
