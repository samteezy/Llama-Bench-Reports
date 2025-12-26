# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Llama Bench Reports is a self-hostable web app for collecting and visualizing llama-bench benchmark results from llama.cpp. Users submit benchmark data via HTTP API, then view historical trends and compare performance across models, builds, and parameters.

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQLite (better-sqlite3)
- **Frontend:** Server-rendered EJS templates + HTMX + Chart.js
- **CSS:** Pico CSS (classless, minimal)

## Commands

```bash
npm install        # Install dependencies
npm start          # Start production server (PORT env var, default 3000)
npm run dev        # Start with nodemon for development
```

## Architecture

```
server.js                    # Express app entry point
src/
├── db/
│   ├── index.js            # SQLite connection, schema initialization
│   └── queries.js          # All database query functions
├── models/
│   └── benchmark.js        # Data transformation (llama-bench JSON → DB format)
└── routes/
    ├── api.js              # REST API endpoints (/api/*)
    └── web.js              # Page routes (renders EJS templates)
views/                       # EJS templates
public/                      # Static assets (CSS, JS)
```

## Data Flow

1. llama-bench outputs JSON/JSONL via `-o json` or `-o jsonl` per https://raw.githubusercontent.com/ggml-org/llama.cpp/refs/heads/master/tools/llama-bench/README.md
2. User pipes output to `curl -X POST http://host/api/benchmarks`
3. API transforms data using `src/models/benchmark.js` and stores in SQLite
4. Web routes query DB and render EJS templates with HTMX for interactivity

## Key Files

- `src/db/queries.js` - All SQL queries (getBenchmarks, getTrends, getStats, etc.)
- `src/models/benchmark.js` - Maps llama-bench field names to DB schema
- `src/routes/api.js` - POST /api/benchmarks handles both JSON array and JSONL input
- `views/partials/table.ejs` - HTMX-swappable benchmark table partial

## Environment Variables

- `PORT` - Server port (default: 3000)
- `DB_PATH` - SQLite database path (default: ./data/benchmarks.db)

## Practices
- Always use JSDoc when writing JS code.
