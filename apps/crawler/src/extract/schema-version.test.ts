import { describe, expect, it } from "vitest";
import {
  canReuseCardExtraction,
  EXTRACTION_SCHEMA_VERSION,
  extractionSchemaVersionOf,
  stampSourceUrl,
} from "./schema";
import { goldExtraction } from "../test/fixtures";

describe("extraction schema version", () => {
  it("stamps the current version onto fresh extractions", () => {
    const stamped = stampSourceUrl(goldExtraction(), "https://example.com/card");
    expect(stamped.schema_version).toBe(EXTRACTION_SCHEMA_VERSION);
    expect(extractionSchemaVersionOf(stamped)).toBe(EXTRACTION_SCHEMA_VERSION);
  });

  it("treats pre-MC2 rows (no promotions) as version 1", () => {
    const preMc2 = { ...goldExtraction() } as ReturnType<typeof goldExtraction> & {
      promotions?: unknown;
    };
    delete preMc2.promotions;
    expect(extractionSchemaVersionOf(preMc2)).toBe(1);
  });

  it("reports unstamped MC2 rows as literal version 2, not the live constant", () => {
    const unstamped = { ...goldExtraction() };
    delete unstamped.schema_version;
    expect(extractionSchemaVersionOf(unstamped)).toBe(2);
  });

  it("does not reuse a v2 DB row when the live schema version has been bumped", () => {
    const v2 = stampSourceUrl(goldExtraction(), "https://example.com/card");
    expect(v2.schema_version).toBe(2);
    const prev = { hash: "sha256:abc", extraction: v2, schemaVersion: 2 };
    expect(canReuseCardExtraction(prev, "sha256:abc", 2)).toBe(true);
    expect(canReuseCardExtraction(prev, "sha256:abc", 3)).toBe(false);
    expect(canReuseCardExtraction({ hash: "sha256:abc", extraction: { ...v2, schema_version: undefined } }, "sha256:abc", 3)).toBe(
      false,
    );
  });
});
