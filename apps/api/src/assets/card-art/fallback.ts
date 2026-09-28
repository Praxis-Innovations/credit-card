import type { CreditCard } from "@/domain";

/**
 * Neutral generated card render. Deliberately not an imitation of real card
 * art: one flat tone per issuer from a fixed muted palette that avoids each
 * issuer's own brand colours, plain-text names (no logos or network marks), no
 * card number, and an "Illustration" label.
 */

export const FALLBACK_WIDTH = 856;
export const FALLBACK_HEIGHT = 540;

/** Muted tones, each chosen to differ from that issuer's brand colour. */
export const ISSUER_TONES: Record<string, string> = {
  "American Express": "#5b5566",
  TD: "#5a4660",
  CIBC: "#2f5f63",
  Scotiabank: "#454a78",
  RBC: "#7a5a48",
  BMO: "#5f7266",
  Rogers: "#3d4a5c",
  Tangerine: "#3a3d42",
  "PC Financial": "#6b6a63",
  Simplii: "#4d5b45",
  Neo: "#6e4a3f",
  "Canadian Tire": "#34555a",
  "National Bank": "#4f4a63",
  Desjardins: "#6a5d4d",
  HSBC: "#48566b",
  MBNA: "#5b5048",
};

const SPARE_TONES = ["#4a4f57", "#5c5347", "#465a57", "#56485a"];

export function toneForIssuer(issuer: string): string {
  const tone = ISSUER_TONES[issuer];
  if (tone) return tone;
  let hash = 0;
  for (let i = 0; i < issuer.length; i++) {
    hash = (hash * 31 + issuer.charCodeAt(i)) >>> 0;
  }
  return SPARE_TONES[hash % SPARE_TONES.length]!;
}

function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = (n >> shift) & 0xff;
    const v = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
    return Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Greedy word wrap; a single word longer than `maxChars` gets its own line. */
export function wrapWords(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const NAME_BOX_WIDTH = 540;

function layoutName(name: string): { size: number; lines: string[] } {
  for (const size of [46, 40, 34]) {
    const lines = wrapWords(name, Math.floor(NAME_BOX_WIDTH / (size * 0.56)));
    if (lines.length <= 2) return { size, lines };
  }
  return { size: 30, lines: wrapWords(name, Math.floor(NAME_BOX_WIDTH / (30 * 0.56))) };
}

export function networkLabel(network: CreditCard["network"]): string {
  if (network === "Amex") return "AMEX";
  return network ? network.toUpperCase() : "";
}

const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";

export function renderFallbackSvg(
  card: Pick<CreditCard, "issuer" | "name" | "network">,
): string {
  const tone = toneForIssuer(card.issuer);
  const { size, lines } = layoutName(card.name);
  const lineHeight = Math.round(size * 1.12);
  const nameBaseline = 468;
  const nameTspans = lines
    .map((line, i) => {
      const y = nameBaseline - (lines.length - 1 - i) * lineHeight;
      return `<tspan x="60" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("");
  const network = networkLabel(card.network);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${FALLBACK_WIDTH}" height="${FALLBACK_HEIGHT}" viewBox="0 0 ${FALLBACK_WIDTH} ${FALLBACK_HEIGHT}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${shade(tone, 0.12)}"/>
<stop offset="1" stop-color="${shade(tone, -0.18)}"/>
</linearGradient>
<clipPath id="card"><rect width="${FALLBACK_WIDTH}" height="${FALLBACK_HEIGHT}" rx="40"/></clipPath>
</defs>
<g clip-path="url(#card)">
<rect width="${FALLBACK_WIDTH}" height="${FALLBACK_HEIGHT}" fill="url(#bg)"/>
<path d="M0 400 L${FALLBACK_WIDTH} 230 L${FALLBACK_WIDTH} ${FALLBACK_HEIGHT} L0 ${FALLBACK_HEIGHT} Z" fill="#ffffff" fill-opacity="0.05"/>
</g>
<text x="60" y="92" font-family="${FONT}" font-size="34" font-weight="600" fill="#ffffff" fill-opacity="0.92">${escapeXml(card.issuer)}</text>
<text x="796" y="90" text-anchor="end" font-family="${FONT}" font-size="17" letter-spacing="3" fill="#ffffff" fill-opacity="0.55">ILLUSTRATION</text>
<g>
<rect x="60" y="176" width="112" height="86" rx="14" fill="#d6c79f"/>
<path d="M60 219 H172 M116 176 V262 M60 197 H96 M60 241 H96 M136 197 H172 M136 241 H172" stroke="#a6946a" stroke-width="3" fill="none"/>
</g>
<text font-family="${FONT}" font-size="${size}" font-weight="700" fill="#ffffff">${nameTspans}</text>
${network ? `<text x="796" y="${nameBaseline}" text-anchor="end" font-family="${FONT}" font-size="28" font-weight="700" letter-spacing="2" fill="#ffffff" fill-opacity="0.8">${escapeXml(network)}</text>` : ""}
</svg>
`;
}

export function fallbackAlt(card: Pick<CreditCard, "issuer" | "name">): string {
  return `${card.issuer} ${card.name} card (illustration)`;
}
