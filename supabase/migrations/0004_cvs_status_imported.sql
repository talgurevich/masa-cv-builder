-- Allow CVs to enter the 'imported' status when populated from an uploaded file.
alter table public.cvs
  drop constraint if exists cvs_status_check;

alter table public.cvs
  add constraint cvs_status_check
  check (status in ('draft', 'imported', 'complete', 'tuned'));
