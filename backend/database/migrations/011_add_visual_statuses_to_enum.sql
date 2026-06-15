-- Add new campaign lifecycle statuses for the visual selection flow

ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'generating_visuals' AFTER 'pending_selection';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'pending_visual'      AFTER 'generating_visuals';
