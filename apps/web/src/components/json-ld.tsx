import { serializeJsonLd } from "@/lib/json-ld";
import type { JsonLdObject } from "@/lib/json-ld";

export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
