-- CR4: add remaining catalog issuers (+ Brim) to crawl_sources.
-- Scotiabank already seeded in admin_console. Blocked issuers keep their URLs
-- for a later retry after bot/robots fixes.

insert into public.crawl_sources (issuer_name, compare_url, url_pattern, schedule, status, notes)
values
  (
    'RBC',
    'https://www.rbcroyalbank.com/credit-cards/all-credit-cards.html',
    '/credit-cards/',
    'monthly',
    'active',
    null
  ),
  (
    'TD',
    'https://www.td.com/ca/en/personal-banking/products/credit-cards/compare-cards',
    '/credit-cards/',
    'monthly',
    'active',
    null
  ),
  (
    'CIBC',
    'https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards.html',
    '/credit-cards/',
    'monthly',
    'blocked',
    'Playwright Chromium gets net::ERR_HTTP2_PROTOCOL_ERROR on all-credit-cards.html (curl 200). Marked blocked in CR4; robots allow the path.'
  ),
  (
    'National Bank',
    'https://www.nbc.ca/personal/mastercard-credit-cards.html',
    '/mastercard-credit-cards/',
    'monthly',
    'active',
    null
  ),
  (
    'American Express',
    'https://www.americanexpress.com/ca/en/credit-cards/',
    '/credit-cards/',
    'monthly',
    'blocked',
    'robots.txt unreachable from crawler fetch (Actions + local Playwright gate); curl returns 200. Marked blocked in CR4.'
  ),
  (
    'BMO',
    'https://www.bmo.com/main/personal/credit-cards/all-cards/',
    '/credit-cards/',
    'monthly',
    'blocked',
    'robots.txt unreachable (timeout) from crawler on Actions. Marked blocked in CR4.'
  ),
  (
    'Tangerine',
    'https://www.tangerine.ca/en/personal/spend/credit-cards',
    '/credit-cards/',
    'monthly',
    'active',
    null
  ),
  (
    'Desjardins',
    'https://www.desjardins.com/en/credit-cards.html',
    '/credit-cards/',
    'monthly',
    'active',
    null
  ),
  (
    'PC Financial',
    'https://www.pcfinancial.ca/en/credit-cards/',
    '/credit-cards/',
    'monthly',
    'blocked',
    'robots.txt unreachable (timeout) from crawler on Actions. Marked blocked in CR4.'
  ),
  (
    'Rogers',
    'https://www.rogersbank.com/en/personal/credit-cards',
    '/credit-cards/',
    'monthly',
    'active',
    null
  ),
  (
    'Simplii',
    'https://www.simplii.com/en/credit-cards.html',
    '/credit-cards/',
    'monthly',
    'blocked',
    'Playwright Chromium gets net::ERR_HTTP2_PROTOCOL_ERROR on credit-cards.html. Marked blocked in CR4.'
  ),
  (
    'Canadian Tire',
    'https://www.triangle.com/en/credit-cards.html',
    '/credit-cards/',
    'monthly',
    'blocked',
    'page.goto Timeout 30000ms after 3 attempts on triangle.com credit-cards hub. Marked blocked in CR4.'
  ),
  (
    'MBNA',
    'https://www.mbna.ca/en/credit-cards/',
    '/credit-cards/',
    'monthly',
    'active',
    null
  ),
  (
    'Neo',
    'https://www.neofinancial.com/credit-cards',
    '/credit-cards/',
    'monthly',
    'active',
    null
  ),
  (
    'HSBC',
    'https://www.hsbc.ca/credit-cards/',
    '/credit-cards/',
    'monthly',
    'blocked',
    'robots.txt unreachable from crawler on Actions. Marked blocked in CR4.'
  ),
  (
    'Brim',
    'https://brimfinancial.com/personal-credit-cards',
    '/credit-cards',
    'monthly',
    'active',
    null
  )
on conflict (issuer_name) do update set
  compare_url = excluded.compare_url,
  url_pattern = excluded.url_pattern,
  schedule = excluded.schedule,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();
