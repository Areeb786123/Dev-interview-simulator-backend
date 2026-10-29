-- Expand interview status check for FAILED / ABANDONED (existing DBs)

ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_status_check;

ALTER TABLE interviews
  ADD CONSTRAINT interviews_status_check
  CHECK (status IN (
    'IN_PROGRESS', 'NEEDS_REVISION', 'PASSED', 'FAILED', 'ABANDONED'
  ));
