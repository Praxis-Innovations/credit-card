# NorthTap source-health — verified catalog URLs

- **Run ID:** `2026-09-23T03-16-06-679Z`
- **Generated:** 2026-09-23T03:16:06.679Z
- **OK / failed / marked stale:** 6 / 2 / 0

> Light daily check (GET + claim presence). Failures flip Supabase rows to `status=stale` when credentials are configured.

## Failures (2)

- **[claim_missing] merchant_brands/chevron-parkland**
  - None of claims matched: Chevron (Parkland)
  - <https://journie.ca/pe-en/terms>
- **[unreachable] merchant_brands/petro-canada**
  - The operation was aborted due to timeout
  - <https://triangle.canadiantire.ca/en/partners.html>
