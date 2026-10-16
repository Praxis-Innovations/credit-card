function pushRow(lines: string[][], row: string[], field: string): string {
  row.push(field);
  if (row.some((c) => c.trim() !== "") || row.length > 1) lines.push(row);
  return "";
}

function rowsFromText(src: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < src.length) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      field = pushRow(lines, row, field);
      row = [];
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    pushRow(lines, row, field);
  }
  return lines;
}

/** Minimal RFC4180-ish CSV parse (handles quotes and commas). */
export function parseCsv(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const src = text.replace(/^\uFEFF/, "");
  const lines = rowsFromText(src);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0]!.map((h) => h.trim());
  const rows = lines.slice(1).map((cols) => {
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]!] = (cols[c] ?? "").trim();
    }
    return obj;
  });
  return { headers, rows };
}
