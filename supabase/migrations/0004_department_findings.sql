-- Consultant's own findings and notes per department in an assessment; fed to the AI as the
-- highest-priority input when writing the report.
alter table public.engagement_departments
  add column if not exists findings text,
  add column if not exists findings_updated_at timestamptz;
