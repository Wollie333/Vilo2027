-- Migration: Track broadcast link clicks for CTR.
--
-- A user can ack/dismiss a broadcast AND/OR click its link; the two are
-- independent (clicking doesn't ack, ack-ing doesn't click). One row per
-- (broadcast, user) was already PK; we just add a third nullable column.

ALTER TABLE public.broadcast_acknowledgements
  ADD COLUMN link_clicked_at timestamptz;

CREATE INDEX idx_broadcast_acks_clicked
  ON public.broadcast_acknowledgements (broadcast_id)
  WHERE link_clicked_at IS NOT NULL;

COMMENT ON COLUMN public.broadcast_acknowledgements.link_clicked_at IS
  'When the recipient first clicked the broadcast link. NULL = never clicked. Used to compute CTR on /admin/broadcasts/[id].';
