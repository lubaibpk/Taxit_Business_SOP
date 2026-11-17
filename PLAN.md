# Business System Builder — Architecture & Build Plan

Goal: assess any Saudi business (questionnaire + real ERP data), score each department, and generate
Hannawi-style consulting packs (department reports, JDs, policies, Excel trackers) as Word files,
in English or Arabic, with consultant review and approval before delivery.

Reference output: `HANNAWI_SOP/` (14 department reports, 5 JDs, 8 policies, 15 templates).

---

## 1. Stack

| Layer | Choice |
|---|---|
| App | Next.js (App Router, TypeScript), hosted on Vercel, code on GitHub |
| Database / auth / files | Supabase (Postgres, Auth, Storage for logos, uploads and generated files) |
| AI writing | Claude API (Opus 5.5 for report writing, Haiku 5.5 for cheap tasks like column mapping) |
| Word output | `docx` npm library (supports Arabic RTL) |
| Excel output / import | `exceljs` / SheetJS |
| Long jobs | Background job per report section (Vercel functions + Supabase job table), so a 60-page report never times out |

## 2. How a report gets made

```
Client profile ──┐
Questionnaire ───┼──► Findings & metrics ──► Scores ──► AI writes sections ──► Review/approve ──► .docx
ERP data upload ─┘     (gaps, KPIs)          (1–5)      (per department)        (consultant)       (EN/AR)
```

1. **Client profile**: name, logo, CR number, branches, industry, product/service categories,
   headcount, ERP used, key people (directors, managers).
2. **Department selection**: pick from the library (seeded with Hannawi's 14) or add a custom
   department; AI drafts the questions and report skeleton for a new department, a consultant edits them.
3. **Questionnaire**: per department, answered by consultant and/or client (client gets a link later).
   Each question maps to a control or practice ("Is there a written credit approval matrix?") and a weight.
4. **Data upload**: Excel/CSV exports from Zoho, Tally, Odoo or anything else. A mapping step
   (AI suggests, user confirms) turns them into standard datasets:
   - AR ageing → DSO, overdue %, >90-day share, top debtor concentration
   - Sales lines → revenue trend, margin by category, salesman performance, inactive customers
   - Inventory → slow/dead stock, stock days, ABC/FSN
   - Employees → Iqama/insurance expiries, Saudization %, headcount by department
   - Trial balance / P&L → margins, expense ratios, working capital
5. **Scoring**: maturity 1–5 per dimension per department (questionnaire), plus green/amber/red KPI
   checks from data, rolled up to a department score and an overall business health score.
6. **AI generation**: each report section is written separately. Claude receives the client profile,
   that department's answers, findings and metrics, the matching Hannawi section as a style and depth
   example, and a Saudi compliance knowledge pack (ZATCA, VAT, Zakat, GOSI, Qiwa, Mudad, Iqama, labour law).
   It returns structured content (headings, paragraphs, tables, bullet lists), not free text, so the
   Word layout stays consistent.
7. **Review**: each section is shown in the app; the consultant can edit, regenerate with
   instructions, comment, and mark it approved. Statuses: Draft → In review → Approved.
   Only a fully approved report exports as the final client file.
8. **Export**: Word file with client logo, name and details, cover page, table of contents and
   consistent styling; English or Arabic chosen per report.
9. **Re-assessment**: each engagement is a dated round; a later round shows score changes and
   roadmap progress (like the Implementation Tracker).

## 3. Main database tables

`organisations` (your firm) · `users` (roles: admin, consultant, reviewer; later: client) ·
`clients` · `engagements` (one assessment round) · `department_library` · `engagement_departments` ·
`questions` · `responses` (who answered) · `data_uploads` · `datasets` (mapped rows) · `metrics` ·
`findings` · `scores` · `report_templates` (section skeletons) · `reports` · `report_sections`
(content, status, version history) · `comments` · `roadmap_actions` · `generated_files` · `jobs`

Every client row is protected by Supabase row-level security so it is ready for client logins later.

## 4. Build phases

**Phase 1: one department end to end**
- GitHub repo, Next.js app, Supabase project, internal login
- Clients, engagements, logo upload
- Department library seeded with the Hannawi skeletons
- Questionnaire and scoring for **Credit & Collections** (the one that also has real data: AR ageing)
- AR ageing upload with column mapping → DSO, ageing and concentration metrics
- AI writes the Credit report; section-by-section review and approval
- English Word export with client branding
- Check: compare the output with Hannawi's Credit report

**Phase 2: breadth**
- Remaining 13 departments, sales/inventory/employee/trial balance imports
- Overall health score and executive summary report
- Arabic export

**Phase 3: the full pack**
- JDs, policies and Excel trackers generated per client
- Custom department builder
- Client questionnaire link (no full client login yet)

**Phase 4: over time and integrations**
- Re-assessment rounds, progress tracking and comparison
- Direct ERP connections (Zoho Books API, Odoo API); Tally stays file-based
- Client portal / SaaS readiness

## 5. Open items before building

- GitHub repo name and account/organisation
- New Supabase project or an existing one; Vercel team
- Data residency: Supabase has no Saudi region; client financial and employee data falls
  under the Saudi PDPL, so pick a region (e.g. Frankfurt or Mumbai) and confirm it's acceptable
- Anthropic API key: set it yourself as an environment variable in Vercel / `.env.local`
- Original Word (.docx) versions of the Hannawi reports, if available, to copy exact styling
- Who checks Arabic output quality
