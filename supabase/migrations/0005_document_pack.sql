-- Generation log per section (model, output tokens, stop reason, dropped blocks) for diagnosing thin sections.
alter table public.report_sections add column if not exists gen_meta jsonb;

-- AI-built parts of a report's document pack: Excel tracker designs and job descriptions.
-- (SOPs, forms, policies and checklists are split from the approved report chapters on the fly.)
create table if not exists public.pack_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  kind text not null check (kind in ('tracker', 'jd')),
  code text not null,
  title text not null,
  data jsonb not null,
  sort int not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists pack_items_report_idx on public.pack_items (report_id, kind, sort);

alter table public.pack_items enable row level security;
create policy "staff full access" on public.pack_items for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Credit outline: every SOP / form / register / policy / checklist starts with its own coded heading,
-- so the document pack can split them into separate files.
update public.departments
set report_skeleton = (
  select jsonb_agg(
    case s->>'key'
      when 'sops' then jsonb_set(s, '{guidance}', to_jsonb('Write 6–8 complete SOPs. Each SOP starts with a level-2 heading "SOP CR-01: <NAME>", then a two-column table (Objective, Scope, Owner, Zero-Tolerance Rule), then a Step-by-Step Workflow table (Step | Process action | Responsible | Output / document | Timeline), then Controls, Risks & Governance Requirements bullets.'::text))
      when 'forms' then jsonb_set(s, '{guidance}', to_jsonb('Reproduce 4–6 ready-to-use forms (customer credit application, credit approval form, credit limit change request, customer visit report, write-off request). Each form starts with a level-2 heading "FORM CR-01: <NAME>", then a field table (Field | Details / entry) with blank entry cells, then an approval and signature table.'::text))
      when 'registers' then jsonb_set(s, '{guidance}', to_jsonb('For each register (customer credit master, collection follow-up tracker, promise-to-pay tracker, security cheque register, bad debt register): a level-2 heading "REG CR-01: <NAME>", a paragraph with purpose, owner and update frequency, and a table of its fields (Field | Description | Example).'::text))
      when 'policies' then jsonb_set(s, '{guidance}', to_jsonb('Write 6–8 policies. Each starts with a level-2 heading "POLICY CP-01: <NAME>", followed by numbered clauses: a level-3 heading "CP-01.1 <clause title>" then a paragraph, for every clause.'::text))
      when 'checklists' then jsonb_set(s, '{guidance}', to_jsonb('5–6 checklists. Each starts with a level-2 heading "CHECKLIST CR-01: <NAME>", then a table: # | Checklist item | Responsible | Done (✓) | Date.'::text))
      else s
    end order by ord)
  from jsonb_array_elements(report_skeleton) with ordinality as t(s, ord)
)
where code = 'credit';
