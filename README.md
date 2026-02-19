# SaaS Research Platform — Backend

> **Research/education only — not financial advice.**

Production-ready backend for a SaaS research platform built on **Supabase** (Auth, Postgres, Storage, Edge Functions) with **n8n** automation workflows.

---

## Features

| Module | Description |
| --- | --- |
| **Personal Finance** | Net worth tracking, holdings, account management, CSV/PDF import, statement parsing, alerts, digests |
| **Trading Research** | Strategy templates, backtesting (skeleton), paper trading (skeleton), compliance-filtered prompt-to-strategy |
| **Automation** | 5 n8n workflows: daily digest, alert triggers, weekly summary, statement webhook, macro event reminders |
| **Compliance** | All LLM output filtered for advice language; prompts seeking trading advice are blocked; mandatory disclaimers |

---

## Repository Structure

```
finance/
├── supabase/
│   ├── migrations/
│   │   └── 0001_init.sql          # 35 tables, 55+ RLS policies, 3 storage buckets
│   ├── seed/
│   │   └── seed.sql               # Strategy templates + demo macro events
│   └── functions/
│       ├── _shared/               # Shared utilities
│       │   ├── cors.ts            # CORS handler
│       │   ├── supabase.ts        # Client factory (user JWT + service role)
│       │   ├── response.ts        # Standardized JSON responses
│       │   ├── validators.ts      # Input validation (UUID, email, enum, etc.)
│       │   ├── compliance.ts      # LLM compliance filter
│       │   └── audit.ts           # Audit logging
│       ├── finance-dashboard/     # GET  /v1/finance/dashboard
│       ├── finance-accounts/      # POST /v1/finance/accounts
│       ├── finance-import-csv/    # POST /v1/finance/import/csv
│       ├── finance-signed-upload/ # POST /v1/finance/statements/signed-upload
│       ├── finance-parse-statement/ # POST /v1/finance/statements/parse
│       ├── finance-generate-digest/ # POST /v1/finance/digest/generate
│       ├── finance-evaluate-alerts/ # POST /v1/finance/alerts/evaluate
│       ├── prices-refresh/        # POST /internal/v1/prices/refresh (service role)
│       ├── strategies-from-prompt/ # POST /v1/strategies/from-prompt (skeleton)
│       ├── backtests-run/         # POST /v1/backtests/run (skeleton)
│       └── paper-deploy/          # POST /v1/paper/deploy (skeleton)
├── n8n/workflows/
│   ├── wf1-daily-market-digest.json
│   ├── wf2-alerts-trigger.json
│   ├── wf3-weekly-portfolio-summary.json
│   ├── wf4-statement-upload-webhook.json
│   └── wf5-macro-events-reminders.json
├── scripts/
│   └── worker.ts                  # Job queue worker (polls `jobs` table)
├── tests/
│   ├── compliance.test.ts         # Compliance filter tests
│   └── validators.test.ts         # Input validator tests
├── .env.example
└── README.md
```

---

## Quick Start

### 1. Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Deno](https://deno.land) v1.30+
- [n8n](https://n8n.io) (for workflow automation)

### 2. Environment

```bash
cp .env.example .env
# Fill in your Supabase project URL, keys, Telegram token, etc.
```

### 3. Database

```bash
# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push

# Seed (optional)
supabase db reset  # applies migrations + seed
```

### 4. Edge Functions

```bash
# Deploy all functions
supabase functions deploy finance-dashboard
supabase functions deploy finance-accounts
supabase functions deploy finance-import-csv
supabase functions deploy finance-signed-upload
supabase functions deploy finance-parse-statement
supabase functions deploy finance-generate-digest
supabase functions deploy finance-evaluate-alerts
supabase functions deploy prices-refresh
supabase functions deploy strategies-from-prompt
supabase functions deploy backtests-run
supabase functions deploy paper-deploy
```

### 5. Worker

```bash
deno run --allow-net --allow-env scripts/worker.ts
```

### 6. n8n Workflows

Import the JSON files from `n8n/workflows/` into your n8n instance. Update environment variables in n8n settings.

### 7. Tests

```bash
deno test --allow-none tests/
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/v1/finance/dashboard?org_id=X` | JWT | Dashboard with net worth, allocation, alerts |
| `POST` | `/v1/finance/accounts` | JWT | Create or update finance account |
| `POST` | `/v1/finance/import/csv` | JWT | Import CSV with auto-detect columns |
| `POST` | `/v1/finance/statements/signed-upload` | JWT | Get signed upload URL |
| `POST` | `/v1/finance/statements/parse` | JWT | Parse uploaded statement |
| `POST` | `/v1/finance/digest/generate` | JWT | Generate daily/weekly digest |
| `POST` | `/v1/finance/alerts/evaluate` | JWT | Evaluate alert triggers |
| `POST` | `/internal/v1/prices/refresh` | Service | Refresh market prices |
| `POST` | `/v1/strategies/from-prompt` | JWT | Generate strategy from prompt (skeleton) |
| `POST` | `/v1/backtests/run` | JWT | Queue backtest run (skeleton) |
| `POST` | `/v1/paper/deploy` | JWT | Deploy paper trading bot (skeleton) |

### Response Format

```json
{
  "ok": true,
  "data": { ... },
  "request_id": "uuid",
  "disclaimer": "Research/education only — not financial advice."
}
```

---

## Security

- **RLS**: All tables have Row Level Security policies scoped by `org_id` and `user_id`
- **Storage**: Private buckets with path-based access (`{org_id}/{user_id}/...`)
- **Auth**: Supabase Auth JWT for user endpoints; service role key for internal/system endpoints
- **Compliance**: Advisory language filtered from all LLM outputs; prompts for trading advice blocked
- **Audit**: All mutations logged to `audit_logs` with `X-Request-Id` tracking

---

## Compliance

All outputs are **informational and educational**. The system:

1. **Filters** advice verbs, targets, certainty language from generated text
2. **Blocks** prompts seeking explicit buy/sell recommendations
3. **Appends** mandatory disclaimer to all responses
4. **Logs** compliance violations for audit review

> ⚠️ **Disclaimer**: This platform is for research and education purposes only. It does not provide financial advice, trading signals, or investment recommendations. Always consult a qualified financial advisor.
