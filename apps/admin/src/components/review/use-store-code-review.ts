"use client";

import { useMemo, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  approveMerchantCodeFinding,
  bulkApproveMerchantCodeFindings,
  bulkRejectMerchantCodeFindings,
  rejectMerchantCodeFinding,
} from "@/app/(console)/review/mcc-actions";
import { groupFindingsByChain, type ChainGroup } from "@/lib/mcc-review/present";
import type { BrandSnapshot, MerchantCodeFinding } from "@/lib/mcc-review/types";

type Notice = { ok: boolean; message: string } | null;

function useDecisionRunner(setNotice: Dispatch<SetStateAction<Notice>>, onSuccess: () => void) {
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<{ ok: boolean; message: string }>) => {
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await action();
        setNotice({ ok: res.ok, message: res.message });
        if (res.ok) onSuccess();
      } catch {
        setNotice({ ok: false, message: "Something went wrong. Refresh and try again." });
      }
    });
  };
  return { pending, run };
}

export function useStoreCodeReview(findings: MerchantCodeFinding[], brands: BrandSnapshot[]) {
  const router = useRouter();
  const groups = useMemo(() => groupFindingsByChain(findings, brands), [findings, brands]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [expanded, setExpanded] = useState<string | null>(groups[0]?.chain.toLowerCase() ?? null);
  const [notice, setNotice] = useState<Notice>(null);
  const { pending, run } = useDecisionRunner(setNotice, () => {
    setSelected(new Set());
    setReason("");
    router.refresh();
  });

  return {
    groups,
    selected,
    reason,
    setReason,
    rejectId,
    rejectReason,
    setRejectReason,
    expanded,
    setExpanded,
    notice,
    pending,
    toggle: (id: string) => setSelected((prev) => flipId(prev, id)),
    toggleGroup: (group: ChainGroup) => setSelected((prev) => flipGroup(prev, group)),
    selectAll: () => setSelected(new Set(findings.map((f) => f.id))),
    clearSelection: () => setSelected(new Set()),
    approveOne: (id: string) => run(() => approveMerchantCodeFinding(id, reason || null)),
    startReject: (id: string) => {
      setRejectId(id);
      setRejectReason(reason);
    },
    confirmReject: () => {
      if (!rejectId) return;
      run(async () => {
        const res = await rejectMerchantCodeFinding(rejectId, rejectReason);
        if (res.ok) {
          setRejectId(null);
          setRejectReason("");
        }
        return res;
      });
    },
    cancelReject: () => {
      setRejectId(null);
      setRejectReason("");
    },
    bulkApprove: () => run(() => bulkApproveMerchantCodeFindings([...selected], reason)),
    bulkReject: () => run(() => bulkRejectMerchantCodeFindings([...selected], reason)),
  };
}

function flipId(prev: Set<string>, id: string): Set<string> {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function flipGroup(prev: Set<string>, group: ChainGroup): Set<string> {
  const ids = group.findings.map((f) => f.id);
  const next = new Set(prev);
  const allOn = ids.every((id) => next.has(id));
  for (const id of ids) {
    if (allOn) next.delete(id);
    else next.add(id);
  }
  return next;
}
