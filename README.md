# Business System Builder

Internal tool for assessing Saudi businesses department by department and generating
consulting reports (SOPs, policies, KPIs, roadmaps) as Word files, with review and approval.

See [PLAN.md](PLAN.md) for the architecture and phases.

## Stack
Next.js (App Router) · Supabase (Postgres, Auth, Storage) · Claude API · Vercel

## Run locally
```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

## Environment variables
| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `ANTHROPIC_API_KEY` | Claude API key used to write report sections |
| `FIRM_NAME` | Name printed on reports as "Prepared by" (default: Taxit) |

## Database
Migrations live in `supabase/migrations/`. The first person to sign up becomes admin;
everyone after that waits as "pending" until an admin assigns a role on the Team page.

## Phase 1 status
- Clients with logo, branches, key people
- Assessments (rounds) with department selection
- Credit & Collections questionnaire, consultant and client answers, maturity scoring
- AR ageing upload from any ERP export (column mapping) → receivables metrics with RAG status
- AI-written report sections, edit / revise / approve per section, report approval
- Word export (English / Arabic), client branding, draft watermark until approved
