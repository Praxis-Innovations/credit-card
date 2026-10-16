import type { PillTone } from "@/lib/sources/present";
import type { CrawlRun, CrawlRunStatus } from "./types";

export type CrawlPanelState = "last_run" | CrawlRunStatus;

export function panelState(run: CrawlRun | null): CrawlPanelState {
  if (!run) return "last_run";
  return run.status;
}

export function panelTitle(state: CrawlPanelState): string {
  switch (state) {
    case "last_run":
      return "Last run";
    case "requested":
      return "Requested";
    case "running":
      return "Running";
    case "done":
      return "Done";
    case "failed":
      return "Failed";
  }
}

export function panelPill(state: CrawlPanelState): { label: string; tone: PillTone } {
  switch (state) {
    case "last_run":
      return { label: "No crawl yet", tone: "neutral" };
    case "requested":
      return { label: "Requested", tone: "warn" };
    case "running":
      return { label: "Running", tone: "ok" };
    case "done":
      return { label: "Done", tone: "ok" };
    case "failed":
      return { label: "Failed", tone: "bad" };
  }
}

export function whenLabel(run: CrawlRun | null): string | null {
  if (!run) return null;
  if (run.status === "requested") return run.created_at;
  if (run.status === "running") return run.started_at ?? run.created_at;
  return run.finished_at ?? run.started_at ?? run.created_at;
}
