-- The "active planning week": the Mon–Sun week the app is currently planning for.
--
-- It is the current calendar week (Mon–Sun, in UTC) Monday through Friday, and
-- shifts to the upcoming week on Saturday and Sunday (UTC). The Friday-evening (PT)
-- cron that generates meals runs in the early UTC hours of Saturday, so this makes
-- meals it creates get assigned to — and shown for — the following week, while the
-- home page also rolls forward to that week over the weekend.
CREATE OR REPLACE FUNCTION active_week_start()
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (
    DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC')
    + CASE WHEN EXTRACT(ISODOW FROM NOW() AT TIME ZONE 'UTC') >= 6
           THEN INTERVAL '1 week' ELSE INTERVAL '0 week' END
  )::date;
$$;

-- A chosen_at value anchored at noon UTC of the active week's Monday. Inserting
-- selections with this guarantees week_start_utc(chosen_at) resolves to the active
-- week regardless of the server session timezone.
CREATE OR REPLACE FUNCTION active_week_chosen_at()
RETURNS timestamptz LANGUAGE sql STABLE AS $$
  SELECT (active_week_start()::timestamp AT TIME ZONE 'UTC') + INTERVAL '12 hours';
$$;
