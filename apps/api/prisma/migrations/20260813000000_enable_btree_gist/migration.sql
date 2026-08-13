-- Потрібне для exclusion constraint, що не дає двом заняттям
-- одного викладача перетинатися в часі (етап 3).
CREATE EXTENSION IF NOT EXISTS btree_gist;
