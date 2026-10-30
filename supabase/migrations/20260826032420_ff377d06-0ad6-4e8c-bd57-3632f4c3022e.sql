CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

INSERT INTO public.seo_monitor_settings (id, alert_email, email_enabled, base_url)
VALUES (true, '1891frs@gmail.com', true, 'https://inkvision.app')
ON CONFLICT (id) DO UPDATE
  SET alert_email = EXCLUDED.alert_email,
      email_enabled = true,
      base_url = EXCLUDED.base_url,
      updated_at = now();

SELECT cron.unschedule('inkvision-seo-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'inkvision-seo-daily');

SELECT cron.schedule(
  'inkvision-seo-daily',
  '17 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--78382135-b5d4-4b76-84d2-3a0c421e9e68.lovable.app/api/public/seo-check',
    headers := '{"Content-Type": "application/json", "x-seo-monitor-secret": "45744d1967b142cbdd4eba75fb8992b99da0f7b64622d150"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);