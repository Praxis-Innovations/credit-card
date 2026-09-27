# Canadian merchant–loyalty–card partnerships — report

Status: **on `main`** (originally landed in commit `5da4882`; moved from `packages/core` to `apps/api` in PR #12)  
Data verified as of: **2026-09-22**  
Source of truth: `apps/api/src/domain/partnerships.ts` (types in `apps/api/src/domain/schema.ts`, tests in `apps/api/src/domain/partnerships.test.ts`)

Production-ready, cited entries only — no mock/placeholder/synthetic partnerships. Counts below match `main`.

Consumers on `main`:

- `apps/api/src/domain/merchant-match.ts` — matches merchant names to `MERCHANT_BRANDS`.
- `apps/api/src/domain/recommend-merchant.ts` — partnership-aware card ranking using `MERCHANT_PARTNERSHIPS`.
- `apps/api/src/lib/catalog.ts` — serves partnerships to the `/v1/partnerships` and `/v1/merchant-brands/{id}/partnerships` API routes.
- `apps/api/src/data-pipeline/extract/partnerships.ts` — staging crawl diffs against `MERCHANT_PARTNERSHIPS`; conflicts are flagged for review, never auto-promoted.

---

## Totals

| Asset | Count |
| --- | ---: |
| **Partnerships verified & cited** | **11** |
| Merchant / retail brands | 30 |
| Loyalty programs | 6 |
| New catalog cards added for coverage | 2 (`rbc-moi-visa`, `pc-financial-world`) |

Every partnership has at least one primary `sourceUrl` and a `lastVerified` ISO date. Unit tests in `apps/api/src/domain/partnerships.test.ts` enforce citations, catalog card references, and forbid mock/placeholder markers.

---

## Partnerships verified and cited (11)

1. **Shell ↔ Scene+ / Shell Go+ ↔ Scotiabank Scene+ cards**  
   Instant 3¢/L all grades; promotional +4¢/L on V-Power; Scene+ pts/L.  
   Sources: Scotiabank Shell page, Shell Scotiabank partner page.

2. **Shell ↔ Shell Go+ ↔ Tangerine Money-Back / Scotia Momentum**  
   Instant 3¢/L only (no Scene+ V-Power +4¢).  
   Sources: Scotiabank Shell page, Tangerine press release (2026-05-26).

3. **JOURNIE (Parkland) ↔ CIBC linked cards**  
   Brands: Pioneer, Ultramar, Fas Gas, Parkland Chevron, On the Run. Instant 3¢/L (≤100 L/fill). Simplii excluded.  
   Sources: CIBC JOURNIE offer, journie.ca CIBC partner + terms.

4. **Canadian Tire Gas+ / Petro-Canada ↔ Triangle Rewards ↔ Triangle cards**  
   5¢/L CT Money regular; 7¢/L premium; ~3¢/L cash/debit member baseline.  
   Sources: Gas+ Triangle page, Triangle Mastercard page, Triangle partners page.

5. **Costco Gas / Costco.ca / warehouse ↔ CIBC Costco Mastercard (direct)**  
   No loyalty layer. 3% Costco gas, 2% other gas/EV (first $5k/yr shared gas category), 2% Costco.ca (first $8k), 1% elsewhere. Caps per Benefits Guide.  
   Sources: CIBC Costco product page + Benefits Guide PDF.

6. **PC Optimum ↔ Esso / Mobil ↔ PC Mastercards**  
   Member base 10 pts/L; ≥30 pts/L with PC Mastercard; +10 pts/L premium with PC MC. **Not Shell.**  
   Sources: Esso PC Optimum FAQ/rewards, PC Financial card pages.

7. **PC Optimum ↔ Shoppers Drug Mart / Pharmaprix ↔ PC Mastercards**  
   2.5% / 3.5% / 4.5% back in points by card tier.  
   Source: PC Financial Mastercard pages.

8. **PC Optimum ↔ Loblaw grocery banners ↔ PC Mastercards**  
   Loblaws, No Frills, Real Canadian Superstore — 1% / 2% / 3% by card tier.  
   Source: PC Financial Mastercard pages.

9. **Scene+ ↔ Empire banners + Lawtons ↔ Scotiabank Scene+ cards**  
   Groceries: Sobeys, Safeway, Foodland, FreshCo, participating IGA, Thrifty Foods; drugstore: Lawtons. Card accelerators 2× / 3× / 6× by card.  
   Sources: Scotiabank participating stores, Sobeys Scene+, Scene+ cards hub.

10. **Moi Rewards ↔ Metro / Food Basics / Super C / Jean Coutu / Brunet ↔ linked RBC cards**  
    +1 Moi point per $2 (0.5 pts/$) after basket minima.  
    Sources: Avion↔Moi FAQ, partnership page, linked-loyalty PDF terms.

11. **Moi Rewards ↔ moi RBC Visa (co-brand)**  
    2 Moi pts/$ at participating Metro / Brunet / Jean Coutu (regional rules per issuer FAQ).  
    Source: RBC moi Visa product page.

---

## Brands & categories covered

### By category

| Category | Brands in seed |
| --- | --- |
| **Gas** | Shell; Pioneer, Ultramar, Fas Gas, Chevron (Parkland), On the Run; Gas+; Petro-Canada; Costco Gas; Esso; Mobil |
| **Groceries** | Costco Warehouse; Loblaws, No Frills, Real Canadian Superstore; Sobeys, Safeway, Foodland, FreshCo, IGA (participating), Thrifty Foods; Metro, Food Basics, Super C |
| **Drugstore** | Shoppers Drug Mart, Pharmaprix; Lawtons Drugs; Jean Coutu, Brunet |
| **Other / warehouse-adjacent** | Costco.ca |

### Loyalty programs

Scene+, Shell Go+, JOURNIE Rewards, Triangle Rewards, PC Optimum, Moi Rewards.

---

## Investigated but could **NOT** verify (left out)

Nothing below was silently dropped — each was checked and excluded for the stated reason.

| Candidate | Why excluded |
| --- | --- |
| **PC Optimum × Shell** | Does **not** partner. PC Optimum gas is Esso/Mobil only. Tests assert Shell partnerships never use `pc-optimum`. |
| **BMO AIR MILES / Blue Rewards × Metro** | Metro’s current loyalty partner is **Moi + RBC**. Historical AIR MILES×Metro and Blue Rewards “groceries anywhere” are not a clean, current Metro-specific partnership to cite. |
| **PC Insiders World Elite @ Esso** (higher pts/L, up to ~70) | Rates appear on Esso/PC materials, but the Insiders card is **not** in `apps/api/src/domain/cards.ts`; omitted rather than invent catalog rates. |
| **RBC “3¢/L fuel” promo** on moi Visa marketing | Mentioned without a clear primary mapping to a specific Canadian gas brand in materials reviewed. |
| **Première Moisson as its own brand/partnership row** | Appears in Moi linked-loyalty **basket thresholds** only; not added as a standalone merchant partnership without a cleaner primary row. |
| **Tangerine Rewards World Elite** as a separate Shell Scene+ stack card | Catalog only has `tangerine-moneyback`; Scene+ V-Power stack covered via Scotiabank Scene+ cards. Not invented. |

---

## Schema shape (reminder)

Canadian deals are modeled as **brand(s) → optional loyalty program → linked / affiliated / direct card(s) → typed benefits**, not a flat brand→card map. Costco Gas is the documented `direct` case (`loyaltyProgramId: null`).
