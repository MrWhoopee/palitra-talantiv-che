-- Needed for the exclusion constraint that prevents two lessons
-- of the same teacher from overlapping in time (stage 3).
CREATE EXTENSION IF NOT EXISTS btree_gist;
