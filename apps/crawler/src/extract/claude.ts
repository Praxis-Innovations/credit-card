import type Anthropic from "@anthropic-ai/sdk";
import { MAX_CARD_TEXT_CHARS, MAX_COMPARE_LINKS, MAX_COMPARE_TEXT_CHARS } from "../config";
import type { CardLink, PageLink, Usage } from "../types";
import { CARD_TOOL_SCHEMA, coerceExtraction, LINKS_TOOL_SCHEMA, type CardExtraction } from "./schema";

export interface Extractor {
  readonly model: string;
  discoverCardLinks(input: {
    issuer: string;
    pageUrl: string;
    pageText: string;
    links: PageLink[];
  }): Promise<{ cards: CardLink[]; usage: Usage }>;
  extractCard(input: {
    issuer: string;
    pageUrl: string;
    pageText: string;
  }): Promise<{ extraction: CardExtraction; usage: Usage }>;
}

/** The slice of the SDK we use, so tests can pass a stub. */
export interface MessagesClient {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

const LINKS_SYSTEM = `You read the text of a Canadian bank's credit card comparison page and pick out links to individual credit card product pages.

Rules:
- Return one entry per distinct personal credit card product page.
- Include no-annual-fee and no-rewards cards. Student versions are separate cards; include them.
- Exclude hub or category pages (e.g. "travel cards", "cash back cards", "no annual fee cards"), comparison tools, calculators, application flows, offers pages, help/FAQ, benefit guides, rewards-program pages and business cards.
- Only use URLs from the provided link list, copied exactly. Never construct or guess a URL.
- card_name is the product's name as the page or link text gives it.`;

const CARD_SYSTEM = `You extract facts about one credit card from the text of its official product page.

Rules:
- Use only the page text provided. Never use outside knowledge, never infer, never compute.
- Every value needs a quote: the shortest passage, copied character-for-character from the page text, that states the value (usually a sentence or a table row). One contiguous passage — no ellipses, no joining, no rewording.
- If the page does not state a field, use null (or an empty list). A null is always better than a guess.
- Amounts are CAD numbers without symbols; rates are percentages as numbers (20.99% -> 20.99).
- APRs: standard rates only, not promotional or introductory rates.
- annual_fee: the regular primary-card fee, even if the first year is waived.
- earn_rates: ongoing earn rates only (not welcome or limited-time bonuses). Map each to the closest category; the base rate on all other purchases is "other". Cash back is percent_cashback.
- welcome_bonus: the current sign-up offer; points is the maximum total bonus if stated.`;

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n[...truncated]`;
}

function usageOf(msg: Anthropic.Message): Usage {
  return { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens };
}

function toolInput(msg: Anthropic.Message, tool: string): unknown {
  if (msg.stop_reason === "max_tokens") throw new Error(`Claude hit max_tokens before finishing ${tool}`);
  const block = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === tool);
  if (!block) throw new Error(`Claude did not call ${tool} (stop_reason=${msg.stop_reason})`);
  return block.input;
}

/** Build with `createClaudeClient()` from ../auth so credentials stay in one place. */
export class ClaudeExtractor implements Extractor {
  constructor(
    private readonly client: MessagesClient,
    readonly model: string,
  ) {}

  async discoverCardLinks(input: { issuer: string; pageUrl: string; pageText: string; links: PageLink[] }) {
    const list = input.links
      .slice(0, MAX_COMPARE_LINKS)
      .map((l, i) => `${i + 1}. ${l.text || "(no text)"} | ${l.url}`)
      .join("\n");
    const msg = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: LINKS_SYSTEM,
      tools: [
        {
          name: "report_card_pages",
          description: "Report the individual credit card product pages linked from this page.",
          input_schema: LINKS_TOOL_SCHEMA as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "report_card_pages" },
      messages: [
        {
          role: "user",
          content: `Issuer: ${input.issuer}\nPage: ${input.pageUrl}\n\n<page_text>\n${truncate(input.pageText, MAX_COMPARE_TEXT_CHARS)}\n</page_text>\n\n<links>\n${list}\n</links>`,
        },
      ],
    });
    const raw = toolInput(msg, "report_card_pages") as { cards?: unknown };
    const cards: CardLink[] = (Array.isArray(raw.cards) ? raw.cards : []).flatMap((c) =>
      c && typeof c === "object" && typeof (c as CardLink).url === "string"
        ? [{ card_name: String((c as CardLink).card_name ?? ""), url: (c as CardLink).url }]
        : [],
    );
    return { cards, usage: usageOf(msg) };
  }

  async extractCard(input: { issuer: string; pageUrl: string; pageText: string }) {
    const msg = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: CARD_SYSTEM,
      tools: [
        {
          name: "record_card",
          description: "Record the card's facts, each with its verbatim quote from the page.",
          input_schema: CARD_TOOL_SCHEMA as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "record_card" },
      messages: [
        {
          role: "user",
          content: `Issuer: ${input.issuer}\nPage: ${input.pageUrl}\n\n<page_text>\n${truncate(input.pageText, MAX_CARD_TEXT_CHARS)}\n</page_text>`,
        },
      ],
    });
    return { extraction: coerceExtraction(toolInput(msg, "record_card")), usage: usageOf(msg) };
  }
}
