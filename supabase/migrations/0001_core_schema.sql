-- Core schema for the Business System Builder (assessment + report generation)

create extension if not exists pgcrypto;

-- ───────────────────────── Staff profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'pending' check (role in ('admin','consultant','reviewer','pending')),
  created_at timestamptz not null default now()
);

-- first user to sign up becomes admin, everyone after waits for approval
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when exists (select 1 from public.profiles) then 'pending' else 'admin' end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','consultant','reviewer'));
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.can_approve()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','reviewer'));
$$;

-- ───────────────────────── Clients ─────────────────────────
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_ar text,
  logo_path text,
  cr_number text,
  vat_number text,
  industry text,
  business_model text,
  city text,
  address text,
  branches jsonb not null default '[]'::jsonb,        -- [{name, city}]
  categories text[] not null default '{}',            -- products / services
  headcount int,
  erp_system text,
  key_people jsonb not null default '[]'::jsonb,      -- [{name, position, responsibilities}]
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ───────────────────────── Department library ─────────────────────────
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  name_ar text,
  description text,
  is_custom boolean not null default false,
  report_title text,
  report_skeleton jsonb not null default '[]'::jsonb,   -- [{key, title, guidance}]
  supported_datasets text[] not null default '{}',      -- e.g. {'ar_ageing'}
  sort int not null default 100,
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  code text not null,
  dimension text not null,
  text text not null,
  text_ar text,
  answer_type text not null default 'maturity' check (answer_type in ('maturity','yes_no','text','number')),
  weight numeric not null default 1,
  guidance text,
  sort int not null default 100,
  unique (department_id, code)
);

-- ───────────────────────── Engagements (assessment rounds) ─────────────────────────
create table public.engagements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  round int not null default 1,
  assessment_date date not null default current_date,
  status text not null default 'in_progress' check (status in ('in_progress','completed','archived')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.engagement_departments (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete cascade,
  department_id uuid not null references public.departments(id),
  score numeric,                         -- maturity 1–5
  dimension_scores jsonb,                -- {dimension: score}
  scored_at timestamptz,
  unique (engagement_id, department_id)
);

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  source text not null default 'consultant' check (source in ('consultant','client')),
  value jsonb,                           -- maturity: 0–4, yes_no: bool, text/number
  comment text,
  respondent text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (engagement_id, question_id, source)
);

-- ───────────────────────── Data uploads & metrics ─────────────────────────
create table public.data_uploads (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete cascade,
  dataset_type text not null,            -- 'ar_ageing', later 'sales', 'inventory', ...
  file_path text,
  original_name text,
  column_map jsonb,
  params jsonb not null default '{}'::jsonb,   -- e.g. {annual_credit_sales: 1200000}
  row_count int,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.dataset_rows (
  id bigserial primary key,
  upload_id uuid not null references public.data_uploads(id) on delete cascade,
  data jsonb not null
);
create index on public.dataset_rows (upload_id);

create table public.metrics (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete cascade,
  department_id uuid not null references public.departments(id),
  upload_id uuid references public.data_uploads(id) on delete cascade,
  code text not null,
  label text not null,
  value numeric,
  unit text,
  rag text check (rag in ('green','amber','red')),
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Reports ─────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete cascade,
  department_id uuid not null references public.departments(id),
  language text not null default 'en' check (language in ('en','ar')),
  status text not null default 'draft' check (status in ('draft','in_review','approved')),
  version int not null default 1,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.report_sections (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  key text not null,
  title text not null,
  sort int not null,
  content jsonb,                         -- {blocks: [...]}
  status text not null default 'empty' check (status in ('empty','generating','draft','in_review','approved','error')),
  instructions text,
  error text,
  generated_at timestamptz,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (report_id, key)
);

create table public.section_comments (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.report_sections(id) on delete cascade,
  author uuid references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Row level security ─────────────────────────
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.departments enable row level security;
alter table public.questions enable row level security;
alter table public.engagements enable row level security;
alter table public.engagement_departments enable row level security;
alter table public.responses enable row level security;
alter table public.data_uploads enable row level security;
alter table public.dataset_rows enable row level security;
alter table public.metrics enable row level security;
alter table public.reports enable row level security;
alter table public.report_sections enable row level security;
alter table public.section_comments enable row level security;

create policy "own profile or staff read" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));
create policy "admin manages profiles" on public.profiles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

do $$
declare t text;
begin
  foreach t in array array['clients','departments','questions','engagements','engagement_departments',
    'responses','data_uploads','dataset_rows','metrics','report_sections','section_comments']
  loop
    execute format('create policy "staff full access" on public.%I for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()))', t);
  end loop;
end $$;

-- reports: staff can read/write, but only admin/reviewer may set status = approved
create policy "staff read reports" on public.reports for select to authenticated using ((select public.is_staff()));
create policy "staff create reports" on public.reports for insert to authenticated with check ((select public.is_staff()) and status <> 'approved');
create policy "staff update reports" on public.reports for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()) and (status <> 'approved' or (select public.can_approve())));
create policy "staff delete reports" on public.reports for delete to authenticated using ((select public.is_staff()));

-- ───────────────────────── Storage ─────────────────────────
insert into storage.buckets (id, name, public) values ('logos','logos', false), ('uploads','uploads', false)
on conflict (id) do nothing;

create policy "staff storage access" on storage.objects for all to authenticated
  using (bucket_id in ('logos','uploads') and (select public.is_staff()))
  with check (bucket_id in ('logos','uploads') and (select public.is_staff()));
