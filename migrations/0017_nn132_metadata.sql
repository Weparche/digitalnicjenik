-- Additive migration; existing publications and their names are unchanged.
ALTER TABLE publication_metadata ADD COLUMN merchant_identifier TEXT;
ALTER TABLE publication_metadata ADD COLUMN merchant_type TEXT CHECK(merchant_type IN ('legal','natural'));
ALTER TABLE publication_metadata ADD COLUMN all_locations INTEGER NOT NULL DEFAULT 0 CHECK(all_locations IN (0,1));
