-- CreateTable
CREATE TABLE "barber_link_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "barber_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barber_link_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "barber_link_codes_code_hash_key" ON "barber_link_codes"("code_hash");

-- CreateIndex
CREATE INDEX "barber_link_codes_barber_id_idx" ON "barber_link_codes"("barber_id");

-- AddForeignKey
ALTER TABLE "barber_link_codes" ADD CONSTRAINT "barber_link_codes_barber_id_fkey" FOREIGN KEY ("barber_id") REFERENCES "barbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase: таблица недоступна через Data API, Prisma работает под ролью postgres
ALTER TABLE "barber_link_codes" ENABLE ROW LEVEL SECURITY;
