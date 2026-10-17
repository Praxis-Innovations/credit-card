import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { MAX_OUTPUT_TOKENS } from "../config";
import { ClaudeExtractor, type MessagesClient } from "./claude";

function message(
  input: unknown,
  opts: { name?: string; stop?: Anthropic.Message["stop_reason"]; outputTokens?: number } = {},
): Anthropic.Message {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    stop_reason: opts.stop ?? "tool_use",
    stop_sequence: null,
    content: [{ type: "tool_use", id: "tu_1", name: opts.name ?? "record_card", input } as Anthropic.ToolUseBlock],
    usage: { input_tokens: 1200, output_tokens: opts.outputTokens ?? 300 },
  } as Anthropic.Message;
}

function stub(msg: Anthropic.Message) {
  const create = vi.fn<MessagesClient["messages"]["stream"]>(() => ({ finalMessage: async () => msg }));
  return { client: { messages: { stream: create } }, create };
}

describe("ClaudeExtractor.extractCard", () => {
  it("forces the record_card tool and coerces its input", async () => {
    const { client, create } = stub(
      message({
        card_name: { value: "Gold Card", quote: "Gold Card" },
        network: { value: "american express", quote: "Gold American Express Card" },
        annual_fee: { value: "$120", quote: "Annual fee $120" },
        purchase_apr: { value: "n/a", quote: "x" },
        earn_rates: [
          {
            category: "groceries",
            description: "Sobeys",
            rate: 6,
            unit: "points_per_dollar",
            cap: null,
            quote: "Earn 6 at Sobeys",
            mccs: [],
            merchants: ["Sobeys"],
            mcc_source: "terms",
            exclusions: [],
            cap_amount: null,
            cap_period: null,
            cap_group: null,
            rate_after_cap: null,
            tier_threshold: null,
            valid_from: null,
            valid_to: null,
          },
          { category: "pets", description: "?", rate: 9, unit: "points_per_dollar", cap: null, quote: "Earn 9" },
        ],
        promotions: [],
        insurance_highlights: [{ value: "Travel medical", quote: "Travel medical" }, "bad"],
      }),
    );
    const extractor = new ClaudeExtractor(client, "claude-sonnet-5-5");
    const { extraction, usage } = await extractor.extractCard({
      issuer: "Scotiabank",
      pageUrl: "https://bank.example/gold",
      pageText: "Gold Card",
    });

    const params = create.mock.calls[0]![0];
    expect(params.model).toBe("claude-sonnet-5-5");
    expect(params.max_tokens).toBe(MAX_OUTPUT_TOKENS);
    expect(params.tool_choice).toEqual({ type: "auto" });
    expect(params.messages[0]!.content).toContain("<page_text>\nGold Card\n</page_text>");

    expect(usage).toEqual({ inputTokens: 1200, outputTokens: 300 });
    expect(extraction.network).toEqual({ value: "American Express", quote: "Gold American Express Card" });
    expect(extraction.annual_fee).toEqual({ value: 120, quote: "Annual fee $120" });
    expect(extraction.purchase_apr).toBeNull();
    expect(extraction.issuer).toBeNull();
    expect(extraction.earn_rates.map((e) => e.category)).toEqual(["groceries"]);
    expect(extraction.earn_rates[0]).toMatchObject({
      merchants: ["Sobeys"],
      mcc_source: "terms",
      source_url: "https://bank.example/gold",
    });
    expect(extraction.promotions).toEqual([]);
    expect(extraction.insurance_highlights).toHaveLength(1);
  });

  it("throws when Claude does not call the tool or runs out of tokens", async () => {
    const noTool = { ...message({}), content: [{ type: "text", text: "hi" }] } as Anthropic.Message;
    await expect(
      new ClaudeExtractor(stub(noTool).client, "m").extractCard({ issuer: "x", pageUrl: "u", pageText: "t" }),
    ).rejects.toThrow(/did not call record_card/);
  });

  it("reports the output token count when Claude hits max_tokens", async () => {
    const truncated = message({}, { stop: "max_tokens", outputTokens: MAX_OUTPUT_TOKENS });
    await expect(
      new ClaudeExtractor(stub(truncated).client, "m").extractCard({ issuer: "x", pageUrl: "u", pageText: "t" }),
    ).rejects.toThrow(
      `Claude hit max_tokens before finishing record_card (output_tokens=${MAX_OUTPUT_TOKENS}, max_tokens=${MAX_OUTPUT_TOKENS})`,
    );
  });
});

describe("ClaudeExtractor.discoverCardLinks", () => {
  it("sends the numbered link list and returns the picked cards", async () => {
    const { client, create } = stub(
      message({ cards: [{ card_name: "Gold", url: "https://b.example/gold.html" }, { nope: true }] }, { name: "report_card_pages" }),
    );
    const res = await new ClaudeExtractor(client, "m").discoverCardLinks({
      issuer: "Bank",
      pageUrl: "https://b.example/compare.html",
      pageText: "Compare",
      links: [{ url: "https://b.example/gold.html", text: "Gold card" }],
    });
    const params = create.mock.calls[0]![0];
    expect(params.max_tokens).toBe(MAX_OUTPUT_TOKENS);
    expect(params.tool_choice).toEqual({ type: "auto" });
    expect(params.messages[0]!.content).toContain("1. Gold card | https://b.example/gold.html");
    expect(res.cards).toEqual([{ card_name: "Gold", url: "https://b.example/gold.html" }]);
  });

  it("reports the output token count when Claude hits max_tokens", async () => {
    const truncated = message({}, { name: "report_card_pages", stop: "max_tokens", outputTokens: 9000 });
    await expect(
      new ClaudeExtractor(stub(truncated).client, "m").discoverCardLinks({ issuer: "Bank", pageUrl: "u", pageText: "t", links: [] }),
    ).rejects.toThrow(/finishing report_card_pages \(output_tokens=9000,/);
  });
});
