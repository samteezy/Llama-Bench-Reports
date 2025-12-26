# Llama Bench Reports

A self-hostable web app for collecting and visualizing [llama-bench](https://github.com/ggml-org/llama.cpp/tree/master/tools/llama-bench) benchmark results from llama.cpp.

> **Note:** This is a vibe-coded project. Built fast, works well, no overthinking. PRs welcome if something breaks.

## Features

- Submit benchmark data via HTTP API (JSON or JSONL)
- View historical performance trends
- Compare results across models, builds, and parameters
- Interactive charts and filterable data tables
- Lightweight SQLite storage

## Quick Start

```bash
git clone https://github.com/samteezy/Llama-Bench-Reports.git
cd Llama-Bench-Reports
npm install
npm start
```

Server runs at `http://localhost:3000` by default.

## Docker

```bash
# Build
docker build -t llama-bench-reports .

# Run
docker run -d -p 3000:3000 -v llama-bench-data:/app/data llama-bench-reports
```

Or with docker-compose:

```yaml
services:
  llama-bench-reports:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - llama-bench-data:/app/data
    restart: unless-stopped

volumes:
  llama-bench-data:
```

## Submitting Benchmarks

Pipe llama-bench output directly to the API:

```bash
# JSON format
llama-bench -m model.gguf -o json | curl -X POST http://localhost:3000/api/benchmarks \
  -H "Content-Type: application/json" -d @-

# JSONL format
llama-bench -m model.gguf -o jsonl | curl -X POST http://localhost:3000/api/benchmarks \
  -H "Content-Type: application/x-ndjson" -d @-
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/benchmarks` | Submit benchmark results |
| GET | `/api/benchmarks` | Query benchmarks (supports filters) |
| DELETE | `/api/benchmarks` | Delete benchmarks by ID |
| GET | `/api/models` | List unique models |
| GET | `/api/builds` | List unique builds |
| GET | `/api/trends` | Get trend data for charts |
| GET | `/api/stats` | Get dashboard statistics |
| GET | `/api/compare` | Get comparison data |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `DB_PATH` | `./data/benchmarks.db` | SQLite database path |

## Tech Stack

- Node.js + Express
- SQLite (better-sqlite3)
- EJS templates + HTMX
- Chart.js
- Pico CSS

## License

MIT
