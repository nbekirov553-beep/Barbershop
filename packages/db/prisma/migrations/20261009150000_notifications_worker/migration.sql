-- Роль для Edge Function notifications: читает только нужные таблицы и меняет только статус и отметки уведомлений.
-- Пароль задаётся отдельно (npm run notifications:role), в миграции его нет.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'notifications_worker') THEN
    CREATE ROLE notifications_worker LOGIN NOINHERIT;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO notifications_worker;
GRANT SELECT ON "bookings", "clients", "barbers", "booking_services", "reviews", "settings" TO notifications_worker;
GRANT UPDATE ("status", "reminder_day_sent_at", "reminder_30m_sent_at", "review_requested_at", "auto_completed_at")
  ON "bookings" TO notifications_worker;

-- RLS включён на всех таблицах; политики открывают доступ только этой роли.
CREATE POLICY "notifications_worker_select" ON "bookings" FOR SELECT TO notifications_worker USING (true);
CREATE POLICY "notifications_worker_update" ON "bookings" FOR UPDATE TO notifications_worker USING (true) WITH CHECK (true);
CREATE POLICY "notifications_worker_select" ON "clients" FOR SELECT TO notifications_worker USING (true);
CREATE POLICY "notifications_worker_select" ON "barbers" FOR SELECT TO notifications_worker USING (true);
CREATE POLICY "notifications_worker_select" ON "booking_services" FOR SELECT TO notifications_worker USING (true);
CREATE POLICY "notifications_worker_select" ON "reviews" FOR SELECT TO notifications_worker USING (true);
CREATE POLICY "notifications_worker_select" ON "settings" FOR SELECT TO notifications_worker USING (true);
