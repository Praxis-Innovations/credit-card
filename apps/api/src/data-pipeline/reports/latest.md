# NorthTap data-pipeline review — Big Six

- **Run ID:** `2026-09-23T03-14-50-458Z`
- **Crawl scope:** `partnerships` (cards monthly / partnerships bi-weekly / full on the 1st)
- **Generated:** 2026-09-23T03:15:25.434Z
- **Staging captured:** 2026-09-23T03:14:50.458Z
- **Pipeline version:** 0.2.0
- **Production Big Six cards:** 42
- **Staging facts:** 82
- **Suppressed (already rejected):** 0

## Summary

| Signal | Count |
|--------|------:|
| New card candidates | 0 |
| Removed card candidates | 9 |
| Fee change candidates | 0 |
| Earn-rate change candidates | 0 |
| New partnership candidates | 3 |
| Partnership conflicts | 12 |
| Expiry reviews due | 0 |
| Source failures | 1 |

> Staging is **not** production. Promote via `pipeline:promote` → Supabase `status=verified` (human-gated). Rejected fingerprints are persisted so they are not re-flagged weekly.

## Source attempts

- **scotia-shell** (Scotiabank) — OK (497569 bytes) — https://www.scotiabank.com/ca/en/personal/programs-services/shell.html
- **shell-scotia-partner** (Scotiabank) — OK (5355 bytes) — https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html
- **cibc-journie** (CIBC) — OK (364629 bytes) — https://www.cibc.com/en/special-offers/journie-gas-rewards.html
- **journie-cibc-partner** (CIBC) — OK (79615 bytes) — https://journie.ca/on-en/partners/cibc
- **rbc-moi-faq** (RBC) — OK (59249 bytes) — https://www.avionrewards.com/partnerships/moi-rewards/faq.html
- **cibc-costco** (CIBC) — OK (479853 bytes) — https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/costco-mastercard.html
- **bmo-air-miles** (BMO) — network_error — https://www.bmo.com/en-ca/main/personal/credit-cards/air-miles-world-elite-mastercard/

## Partnership conflicts (with corroboration)

- **[conflict/pending] Scotiabank — Shell:cents_per_litre**
  - fingerprint: `bae4c148541daf3ae1ec`
  - Staged benefit "10¢/ L" contradicts cited amounts on related partnerships [shell-scene-scotia-scene-cards, shell-go-tangerine-scotia-cashback]
  - Production: `3, 4, 1, 1, 3`
  - Staging: `10`
  - Corroboration: Third source did not clearly match either figure. (<https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>) — agreesWith=`neither`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.tangerine.ca/en/about-us/press-releases/pr-2026-05-26>
- **[conflict/pending] Scotiabank — Shell:cents_per_litre**
  - fingerprint: `f71e737f8f34d81b82d2`
  - Staged benefit "7 cents per l" contradicts cited amounts on related partnerships [shell-scene-scotia-scene-cards, shell-go-tangerine-scotia-cashback]
  - Production: `3, 4, 1, 1, 3`
  - Staging: `7`
  - Corroboration: Third source did not clearly match either figure. (<https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>) — agreesWith=`neither`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.tangerine.ca/en/about-us/press-releases/pr-2026-05-26>
- **[conflict/pending] Scotiabank — Shell:cents_per_litre**
  - fingerprint: `cdbaa3c7091b494d0a5d`
  - Staged benefit "8 cents per l" contradicts cited amounts on related partnerships [shell-scene-scotia-scene-cards, shell-go-tangerine-scotia-cashback]
  - Production: `3, 4, 1, 1, 3`
  - Staging: `8`
  - Corroboration: Third source did not clearly match either figure. (<https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>) — agreesWith=`neither`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.tangerine.ca/en/about-us/press-releases/pr-2026-05-26>
- **[conflict/pending] Scotiabank — Shell:cents_per_litre**
  - fingerprint: `0b03dc561ebbb520978e`
  - Staged benefit "2 cents per l" contradicts cited amounts on related partnerships [shell-scene-scotia-scene-cards, shell-go-tangerine-scotia-cashback]
  - Production: `3, 4, 1, 1, 3`
  - Staging: `2`
  - Corroboration: Third source did not clearly match either figure. (<https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>) — agreesWith=`neither`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.tangerine.ca/en/about-us/press-releases/pr-2026-05-26>
- **[conflict/pending] Scotiabank — Shell:cents_per_litre**
  - fingerprint: `cbbfaadd603a699b2c83`
  - Staged benefit "5 cents per L" contradicts cited amounts on related partnerships [shell-scene-scotia-scene-cards, shell-go-tangerine-scotia-cashback]
  - Production: `3, 4, 1, 1, 3`
  - Staging: `5`
  - Corroboration: Third source did not clearly match either figure. (<https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>) — agreesWith=`neither`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.tangerine.ca/en/about-us/press-releases/pr-2026-05-26>
- **[conflict/pending] Scotiabank — Shell:cents_per_litre**
  - fingerprint: `cbbfaadd603a699b2c83`
  - Staged benefit "5 cents per l" contradicts cited amounts on related partnerships [shell-scene-scotia-scene-cards, shell-go-tangerine-scotia-cashback]
  - Production: `3, 4, 1, 1, 3`
  - Staging: `5`
  - Corroboration: Third source did not clearly match either figure. (<https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>) — agreesWith=`neither`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.tangerine.ca/en/about-us/press-releases/pr-2026-05-26>
- **[conflict/pending] Scotiabank — Shell:cents_per_litre**
  - fingerprint: `0b03dc561ebbb520978e`
  - Staged benefit "2 cents per L" contradicts cited amounts on related partnerships [shell-scene-scotia-scene-cards, shell-go-tangerine-scotia-cashback]
  - Production: `3, 4, 1, 1, 3`
  - Staging: `2`
  - Corroboration: Third source did not clearly match either figure. (<https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>) — agreesWith=`neither`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.tangerine.ca/en/about-us/press-releases/pr-2026-05-26>
- **[conflict/pending] Scotiabank — Shell:cents_per_litre**
  - fingerprint: `bae4c148541daf3ae1ec`
  - Staged benefit "10 cents per l" contradicts cited amounts on related partnerships [shell-scene-scotia-scene-cards, shell-go-tangerine-scotia-cashback]
  - Production: `3, 4, 1, 1, 3`
  - Staging: `10`
  - Corroboration: Third source did not clearly match either figure. (<https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>) — agreesWith=`neither`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.tangerine.ca/en/about-us/press-releases/pr-2026-05-26>
- **[conflict/pending] CIBC — JOURNIE:cents_per_litre**
  - fingerprint: `599a5420ea2cff1c27cb`
  - Staged benefit "10 cents per l" contradicts cited amounts on related partnerships [journie-cibc-gas-discount]
  - Production: `3`
  - Staging: `10`
  - Corroboration: Third source mentions both staging and production figures (often marketing totals vs components). (<https://journie.ca/on-en/partners/cibc>) — agreesWith=`both`
  - Third-source snippet: `tions.Learn MoreStack up and save up to 10¢/LSave more when you link your eligible CIBC card with yo`
  - Sources: <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://journie.ca/on-en/partners/cibc>, <https://journie.ca/pe-en/terms>
- **[conflict/pending] CIBC — JOURNIE:cents_per_litre**
  - fingerprint: `49afa35dd449da3e1379`
  - Staged benefit "7 cents per l" contradicts cited amounts on related partnerships [journie-cibc-gas-discount]
  - Production: `3`
  - Staging: `7`
  - Corroboration: Third source mentions both staging and production figures (often marketing totals vs components). (<https://journie.ca/on-en/partners/cibc>) — agreesWith=`both`
  - Third-source snippet: `igible linked CIBC card.* Save an extra 7¢/L when you reach 300 Journie points.** Linking is super e`
  - Sources: <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://journie.ca/on-en/partners/cibc>, <https://journie.ca/pe-en/terms>
- **[conflict/pending] CIBC — JOURNIE:cents_per_litre**
  - fingerprint: `599a5420ea2cff1c27cb`
  - Staged benefit "10¢/L" contradicts cited amounts on related partnerships [journie-cibc-gas-discount]
  - Production: `3`
  - Staging: `10`
  - Corroboration: Third source mentions both staging and production figures (often marketing totals vs components). (<https://www.cibc.com/en/special-offers/journie-gas-rewards.html>) — agreesWith=`both`
  - Third-source snippet: `dal CIBC and Journie Rewards Save up to 10 cents per litre on gas!1 Link and use your eligible CIBC`
  - Sources: <https://journie.ca/on-en/partners/cibc>, <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://journie.ca/on-en/partners/cibc>, <https://journie.ca/pe-en/terms>
- **[conflict/pending] CIBC — JOURNIE:cents_per_litre**
  - fingerprint: `49afa35dd449da3e1379`
  - Staged benefit "7¢/L" contradicts cited amounts on related partnerships [journie-cibc-gas-discount]
  - Production: `3`
  - Staging: `7`
  - Corroboration: Third source mentions both staging and production figures (often marketing totals vs components). (<https://www.cibc.com/en/special-offers/journie-gas-rewards.html>) — agreesWith=`both`
  - Third-source snippet: `ual to CIBC Prime, until December 6, 2027. Learn more about this low introductory rate. Investments`
  - Sources: <https://journie.ca/on-en/partners/cibc>, <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://journie.ca/on-en/partners/cibc>, <https://journie.ca/pe-en/terms>

## Expiry reviews due

_None._

## Fee change candidates

_None._

## Earn-rate / currency change candidates

_None._

## New card candidates

_None._

## New partnership candidates

- **[review/pending] Scotiabank — Shell ↔ Shell Go+**
  - fingerprint: `4f0aa0b6866ea52137ae`
  - Partnership mention "Shell Go+" with benefit text is not clearly covered by partnerships.ts
  - Staging: `Shell Go+`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>
- **[review/pending] Scotiabank — Shell ↔ Scene+**
  - fingerprint: `60c6bb1065f79f0bf131`
  - Partnership mention "Scene+" with benefit text is not clearly covered by partnerships.ts
  - Staging: `Scene+`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>
- **[review/pending] CIBC — JOURNIE ↔ Aeroplan**
  - fingerprint: `8e4c505a36a3c41e72d0`
  - Partnership mention "Aeroplan" with benefit text is not clearly covered by partnerships.ts
  - Staging: `Aeroplan`
  - Sources: <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>

## Possibly missing from listing pages

- **[info/pending] RBC — Cash Back Mastercard**
  - fingerprint: `e57bb21a9a3e06398060`
  - Catalog card was not detected on fetched listing text (may be JS-only, renamed, or still offered — verify before removing)
  - Production: `Cash Back Mastercard`
  - Sources: <https://www.avionrewards.com/partnerships/moi-rewards/faq.html>
- **[info/pending] RBC — WestJet World Elite Mastercard**
  - fingerprint: `01efd67f99c5db2abf85`
  - Catalog card was not detected on fetched listing text (may be JS-only, renamed, or still offered — verify before removing)
  - Production: `WestJet World Elite Mastercard`
  - Sources: <https://www.avionrewards.com/partnerships/moi-rewards/faq.html>
- **[info/pending] RBC — Cash Back Preferred World Elite Mastercard**
  - fingerprint: `bd8e84c1213b44c39211`
  - Catalog card was not detected on fetched listing text (may be JS-only, renamed, or still offered — verify before removing)
  - Production: `Cash Back Preferred World Elite Mastercard`
  - Sources: <https://www.avionrewards.com/partnerships/moi-rewards/faq.html>
- **[info/pending] CIBC — Aeroplan Visa Infinite**
  - fingerprint: `ffdf647780af28ca3822`
  - Catalog card was not detected on fetched listing text (may be JS-only, renamed, or still offered — verify before removing)
  - Production: `Aeroplan Visa Infinite`
  - Sources: <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/costco-mastercard.html>
- **[info/pending] CIBC — Aventura Visa Infinite**
  - fingerprint: `a7c0954b0231ced7d245`
  - Catalog card was not detected on fetched listing text (may be JS-only, renamed, or still offered — verify before removing)
  - Production: `Aventura Visa Infinite`
  - Sources: <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/costco-mastercard.html>
- **[info/pending] CIBC — Aventura Gold Visa**
  - fingerprint: `b3422c4ab166405d2171`
  - Catalog card was not detected on fetched listing text (may be JS-only, renamed, or still offered — verify before removing)
  - Production: `Aventura Gold Visa`
  - Sources: <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/costco-mastercard.html>
- **[info/pending] CIBC — Aeroplan Visa**
  - fingerprint: `79b415c8581d36ead760`
  - Catalog card was not detected on fetched listing text (may be JS-only, renamed, or still offered — verify before removing)
  - Production: `Aeroplan Visa`
  - Sources: <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/costco-mastercard.html>
- **[info/pending] CIBC — Dividend Visa Infinite Privilege**
  - fingerprint: `5062d9e7ec9c38e184c2`
  - Catalog card was not detected on fetched listing text (may be JS-only, renamed, or still offered — verify before removing)
  - Production: `Dividend Visa Infinite Privilege`
  - Sources: <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/costco-mastercard.html>
- **[info/pending] CIBC — Aventura Visa Infinite Privilege**
  - fingerprint: `1293c0487f5590ffc85f`
  - Catalog card was not detected on fetched listing text (may be JS-only, renamed, or still offered — verify before removing)
  - Production: `Aventura Visa Infinite Privilege`
  - Sources: <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/costco-mastercard.html>

## Source failures

- **[review/pending] BMO — bmo-air-miles**
  - fingerprint: `2bf3093822dc7ad14ecc`
  - Source fetch network_error: The operation was aborted due to timeout
  - Staging: `network_error`
  - Sources: <https://www.bmo.com/en-ca/main/personal/credit-cards/air-miles-world-elite-mastercard/>

## Source-health failures

_None._

## Confirmed catalog mentions (16)

- **RBC** / Avion Visa Infinite (`42e5b723`)
- **RBC** / Avion Visa Infinite Privilege (`abe0c02b`)
- **RBC** / moi RBC Visa (`c764cace`)
- **RBC** / Ion+ (`1def7197`)
- **RBC** / Avion Gold Visa (`456abeb5`)
- **RBC** / Ion (`66c7e287`)
- **Scotiabank** / Gold American Express (`4424ad07`)
- **Scotiabank** / Passport Visa Infinite (`f3a1cac2`)
- **Scotiabank** / Momentum Visa Infinite (`6567a577`)
- **Scotiabank** / Scene+ Visa (`046f3bf9`)
- **Scotiabank** / Scene+ Visa Infinite (`510d12bb`)
- **Scotiabank** / Momentum Visa (`0dc8169f`)
- **Scotiabank** / Platinum American Express (`d276f42a`)
- **CIBC** / Dividend Visa Infinite (`b250d3b6`)
- **CIBC** / Dividend Visa (`1e990d6f`)
- **CIBC** / Costco Mastercard (`437cd86a`)
