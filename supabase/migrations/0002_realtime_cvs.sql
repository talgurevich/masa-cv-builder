-- ============================================================================
-- Enable Supabase Realtime on the cvs table so the client can subscribe to
-- UPDATE events. Used by CVWorkbench to keep the preview in sync between
-- browser tabs / devices on the same session.
-- ============================================================================

alter publication supabase_realtime add table public.cvs;
