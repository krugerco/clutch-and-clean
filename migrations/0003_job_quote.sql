-- Itemized price breakdown for a job, saved from the price builder:
-- JSON { state: {...builder choices...}, lines: [{ label, cents }] }. NULL = entered by hand.
ALTER TABLE jobs ADD COLUMN quote TEXT;
