# NorthTap data-pipeline review — Big Six

- **Run ID:** `2026-09-23T02-07-59-187Z`
- **Generated:** 2026-09-23T02:08:55.298Z
- **Staging captured:** 2026-09-23T02:07:59.187Z
- **Pipeline version:** 0.1.0
- **Production Big Six cards:** 42
- **Staging facts:** 141

## Summary

| Signal | Count |
|--------|------:|
| New card candidates | 0 |
| Removed card candidates | 7 |
| Fee change candidates | 0 |
| Earn-rate change candidates | 0 |
| New partnership candidates | 3 |
| Partnership conflicts | 12 |
| Source failures | 2 |

> Staging is **not** production. Nothing here is written to `cards.ts` or `partnerships.ts` until a human verifies and promotes it.

## Source attempts

- **rbc-cards** (RBC) — OK (216004 bytes) — https://www.rbcroyalbank.com/credit-cards/
- **td-cards** (TD) — OK (440503 bytes) — https://www.td.com/ca/en/personal-banking/products/credit-cards
- **scotia-cards** (Scotiabank) — OK (515498 bytes) — https://www.scotiabank.com/ca/en/personal/credit-cards.html
- **bmo-cards** (BMO) — network_error — https://www.bmo.com/en-ca/main/personal/credit-cards/
- **cibc-cards** (CIBC) — OK (504783 bytes) — https://www.cibc.com/en/personal-banking/credit-cards.html
- **nbc-cards** (National Bank) — OK (523724 bytes) — https://www.nbc.ca/en/personal/credit-cards.html
- **scotia-shell** (Scotiabank) — OK (497569 bytes) — https://www.scotiabank.com/ca/en/personal/programs-services/shell.html
- **shell-scotia-partner** (Scotiabank) — OK (5355 bytes) — https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html
- **cibc-journie** (CIBC) — OK (364629 bytes) — https://www.cibc.com/en/special-offers/journie-gas-rewards.html
- **journie-cibc-partner** (CIBC) — OK (79615 bytes) — https://journie.ca/on-en/partners/cibc
- **rbc-moi-faq** (RBC) — OK (59249 bytes) — https://www.avionrewards.com/partnerships/moi-rewards/faq.html
- **cibc-costco** (CIBC) — OK (479853 bytes) — https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/costco-mastercard.html
- **bmo-air-miles** (BMO) — network_error — https://www.bmo.com/en-ca/main/personal/credit-cards/air-miles-world-elite-mastercard/

## Partnership conflicts (verify before trusting catalog)

- **[conflict] Scotiabank — Shell:cents_per_litre**
  - Staged benefit "10¢/ L" contradicts cited amounts on related partnerships [shell-scene-scotia-scene-cards, shell-go-tangerine-scotia-cashback]
  - Production: `3, 4, 1, 1, 3`
  - Staging: `10`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.tangerine.ca/en/about-us/press-releases/pr-2026-05-26>
- **[conflict] Scotiabank — Shell:cents_per_litre**
  - Staged benefit "7 cents per l" contradicts cited amounts on related partnerships [shell-scene-scotia-scene-cards, shell-go-tangerine-scotia-cashback]
  - Production: `3, 4, 1, 1, 3`
  - Staging: `7`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.tangerine.ca/en/about-us/press-releases/pr-2026-05-26>
- **[conflict] Scotiabank — Shell:cents_per_litre**
  - Staged benefit "8 cents per l" contradicts cited amounts on related partnerships [shell-scene-scotia-scene-cards, shell-go-tangerine-scotia-cashback]
  - Production: `3, 4, 1, 1, 3`
  - Staging: `8`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.tangerine.ca/en/about-us/press-releases/pr-2026-05-26>
- **[conflict] Scotiabank — Shell:cents_per_litre**
  - Staged benefit "2 cents per l" contradicts cited amounts on related partnerships [shell-scene-scotia-scene-cards, shell-go-tangerine-scotia-cashback]
  - Production: `3, 4, 1, 1, 3`
  - Staging: `2`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.tangerine.ca/en/about-us/press-releases/pr-2026-05-26>
- **[conflict] Scotiabank — Shell:cents_per_litre**
  - Staged benefit "5 cents per L" contradicts cited amounts on related partnerships [shell-scene-scotia-scene-cards, shell-go-tangerine-scotia-cashback]
  - Production: `3, 4, 1, 1, 3`
  - Staging: `5`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.tangerine.ca/en/about-us/press-releases/pr-2026-05-26>
- **[conflict] Scotiabank — Shell:cents_per_litre**
  - Staged benefit "5 cents per l" contradicts cited amounts on related partnerships [shell-scene-scotia-scene-cards, shell-go-tangerine-scotia-cashback]
  - Production: `3, 4, 1, 1, 3`
  - Staging: `5`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.tangerine.ca/en/about-us/press-releases/pr-2026-05-26>
- **[conflict] Scotiabank — Shell:cents_per_litre**
  - Staged benefit "2 cents per L" contradicts cited amounts on related partnerships [shell-scene-scotia-scene-cards, shell-go-tangerine-scotia-cashback]
  - Production: `3, 4, 1, 1, 3`
  - Staging: `2`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.tangerine.ca/en/about-us/press-releases/pr-2026-05-26>
- **[conflict] Scotiabank — Shell:cents_per_litre**
  - Staged benefit "10 cents per l" contradicts cited amounts on related partnerships [shell-scene-scotia-scene-cards, shell-go-tangerine-scotia-cashback]
  - Production: `3, 4, 1, 1, 3`
  - Staging: `10`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html>, <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>, <https://www.tangerine.ca/en/about-us/press-releases/pr-2026-05-26>
- **[conflict] CIBC — JOURNIE:cents_per_litre**
  - Staged benefit "10 cents per l" contradicts cited amounts on related partnerships [journie-cibc-gas-discount]
  - Production: `3`
  - Staging: `10`
  - Sources: <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://journie.ca/on-en/partners/cibc>, <https://journie.ca/pe-en/terms>
- **[conflict] CIBC — JOURNIE:cents_per_litre**
  - Staged benefit "7 cents per l" contradicts cited amounts on related partnerships [journie-cibc-gas-discount]
  - Production: `3`
  - Staging: `7`
  - Sources: <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://journie.ca/on-en/partners/cibc>, <https://journie.ca/pe-en/terms>
- **[conflict] CIBC — JOURNIE:cents_per_litre**
  - Staged benefit "10¢/L" contradicts cited amounts on related partnerships [journie-cibc-gas-discount]
  - Production: `3`
  - Staging: `10`
  - Sources: <https://journie.ca/on-en/partners/cibc>, <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://journie.ca/on-en/partners/cibc>, <https://journie.ca/pe-en/terms>
- **[conflict] CIBC — JOURNIE:cents_per_litre**
  - Staged benefit "7¢/L" contradicts cited amounts on related partnerships [journie-cibc-gas-discount]
  - Production: `3`
  - Staging: `7`
  - Sources: <https://journie.ca/on-en/partners/cibc>, <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://journie.ca/on-en/partners/cibc>, <https://journie.ca/pe-en/terms>

## Fee change candidates

_None._

## Earn-rate / currency change candidates

- **[review] RBC — Ion+**
  - Point currency hint "Moi" differs from catalog "cashback"
  - Production: `cashback`
  - Staging: `Moi`
  - Sources: <https://www.rbcroyalbank.com/credit-cards/>
- **[review] RBC — Ion**
  - Point currency hint "RBC Avion" differs from catalog "cashback"
  - Production: `cashback`
  - Staging: `RBC Avion`
  - Sources: <https://www.rbcroyalbank.com/credit-cards/>
- **[review] CIBC — Aventura Visa Infinite**
  - Point currency hint "Aeroplan" differs from catalog "CIBC Aventura"
  - Production: `CIBC Aventura`
  - Staging: `Aeroplan`
  - Sources: <https://www.cibc.com/en/personal-banking/credit-cards.html>

## New card candidates

_None._

## New partnership candidates

- **[review] Scotiabank — Shell ↔ Shell Go+**
  - Partnership mention "Shell Go+" with benefit text is not clearly covered by partnerships.ts
  - Staging: `Shell Go+`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>
- **[review] Scotiabank — Shell ↔ Scene+**
  - Partnership mention "Scene+" with benefit text is not clearly covered by partnerships.ts
  - Staging: `Scene+`
  - Sources: <https://www.scotiabank.com/ca/en/personal/programs-services/shell.html>
- **[review] CIBC — JOURNIE ↔ Aeroplan**
  - Partnership mention "Aeroplan" with benefit text is not clearly covered by partnerships.ts
  - Staging: `Aeroplan`
  - Sources: <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>

## Possibly missing from listing pages

- **[info] RBC — WestJet World Elite Mastercard**
  - Catalog card was not detected on fetched listing text (may be JS-only, renamed, or still offered — verify before removing)
  - Production: `WestJet World Elite Mastercard`
  - Sources: <https://www.rbcroyalbank.com/credit-cards/>, <https://www.avionrewards.com/partnerships/moi-rewards/faq.html>
- **[info] TD — Aeroplan Visa Infinite Privilege**
  - Catalog card was not detected on fetched listing text (may be JS-only, renamed, or still offered — verify before removing)
  - Production: `Aeroplan Visa Infinite Privilege`
  - Sources: <https://www.td.com/ca/en/personal-banking/products/credit-cards>
- **[info] TD — Rewards Visa**
  - Catalog card was not detected on fetched listing text (may be JS-only, renamed, or still offered — verify before removing)
  - Production: `Rewards Visa`
  - Sources: <https://www.td.com/ca/en/personal-banking/products/credit-cards>
- **[info] TD — Rewards Visa Infinite**
  - Catalog card was not detected on fetched listing text (may be JS-only, renamed, or still offered — verify before removing)
  - Production: `Rewards Visa Infinite`
  - Sources: <https://www.td.com/ca/en/personal-banking/products/credit-cards>
- **[info] CIBC — Aventura Gold Visa**
  - Catalog card was not detected on fetched listing text (may be JS-only, renamed, or still offered — verify before removing)
  - Production: `Aventura Gold Visa`
  - Sources: <https://www.cibc.com/en/personal-banking/credit-cards.html>, <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/costco-mastercard.html>
- **[info] CIBC — Dividend Visa Infinite Privilege**
  - Catalog card was not detected on fetched listing text (may be JS-only, renamed, or still offered — verify before removing)
  - Production: `Dividend Visa Infinite Privilege`
  - Sources: <https://www.cibc.com/en/personal-banking/credit-cards.html>, <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/costco-mastercard.html>
- **[info] CIBC — Aventura Visa Infinite Privilege**
  - Catalog card was not detected on fetched listing text (may be JS-only, renamed, or still offered — verify before removing)
  - Production: `Aventura Visa Infinite Privilege`
  - Sources: <https://www.cibc.com/en/personal-banking/credit-cards.html>, <https://www.cibc.com/en/special-offers/journie-gas-rewards.html>, <https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/costco-mastercard.html>

## Source failures

- **[review] BMO — bmo-cards**
  - Source fetch network_error: The operation was aborted due to timeout
  - Staging: `network_error`
  - Sources: <https://www.bmo.com/en-ca/main/personal/credit-cards/>
- **[review] BMO — bmo-air-miles**
  - Source fetch network_error: The operation was aborted due to timeout
  - Staging: `network_error`
  - Sources: <https://www.bmo.com/en-ca/main/personal/credit-cards/air-miles-world-elite-mastercard/>

## Confirmed catalog mentions (28)

- **RBC** / Avion Visa Infinite
- **RBC** / Avion Visa Infinite Privilege
- **RBC** / Cash Back Mastercard
- **RBC** / moi RBC Visa
- **RBC** / Ion+
- **RBC** / Avion Gold Visa
- **RBC** / Ion
- **RBC** / Cash Back Preferred World Elite Mastercard
- **TD** / Aeroplan Visa Infinite
- **TD** / Cash Back Visa Infinite
- **TD** / First Class Travel Visa Infinite
- **TD** / Cash Back Visa
- **TD** / Aeroplan Visa
- **Scotiabank** / Gold American Express
- **Scotiabank** / Passport Visa Infinite
- **Scotiabank** / Momentum Visa Infinite
- **Scotiabank** / Scene+ Visa
- **Scotiabank** / Scene+ Visa Infinite
- **Scotiabank** / Momentum Visa
- **Scotiabank** / Platinum American Express
- **CIBC** / Aeroplan Visa Infinite
- **CIBC** / Dividend Visa Infinite
- **CIBC** / Dividend Visa
- **CIBC** / Aventura Visa Infinite
- **CIBC** / Costco Mastercard
- **CIBC** / Aeroplan Visa
- **National Bank** / World Elite Mastercard
- **National Bank** / Allure World Elite Mastercard
