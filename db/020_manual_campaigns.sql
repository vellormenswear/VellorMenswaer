-- Keep current active campaigns active indefinitely; never activate expired or scheduled campaigns.
-- Preserve IDs, discount settings and timestamps of inactive campaigns.
SELECT pg_advisory_xact_lock(8033340);
UPDATE store_campaigns
SET enabled=(enabled AND starts_at<=now() AND ends_at>now()),
    ends_at=CASE WHEN enabled AND starts_at<=now() AND ends_at>now()
                 THEN '9999-12-31T23:59:59Z'::timestamptz ELSE ends_at END,
    updated_at=now()
WHERE enabled AND ends_at<'9999-12-31T23:59:59Z'::timestamptz;
