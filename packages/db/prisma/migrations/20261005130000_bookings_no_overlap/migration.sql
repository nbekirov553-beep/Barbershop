-- Защита от двойной записи на уровне PostgreSQL: проверки в коде недостаточно при гонке запросов.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

ALTER TABLE "bookings"
ADD COLUMN "time_range" tstzrange
GENERATED ALWAYS AS (tstzrange("starts_at", "ends_at", '[)')) STORED;

ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_no_overlap"
EXCLUDE USING gist (
  "barber_id" WITH =,
  "time_range" WITH &&
)
WHERE ("status" = 'confirmed');

ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_ends_after_starts" CHECK ("ends_at" > "starts_at");
