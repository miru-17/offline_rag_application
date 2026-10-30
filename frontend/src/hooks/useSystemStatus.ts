import { useEffect, useState } from "react";

import { getSystemStatus, type SystemStatus } from "../api/system.api";

/* Shared, lightly cached /system/status so the shell and pages don't
   each poll the backend separately. */

interface StatusState {
  status: SystemStatus | null;
  loading: boolean;
  error: boolean;
  checkedAt: number | null;
}

const REFRESH_MS = 60_000;

let state: StatusState = { status: null, loading: true, error: false, checkedAt: null };
let inflight: Promise<void> | null = null;
const subscribers = new Set<(s: StatusState) => void>();

const publish = (next: StatusState) => {
  state = next;
  subscribers.forEach((fn) => fn(state));
};

export const refreshSystemStatus = (): Promise<void> => {
  if (inflight) return inflight;
  publish({ ...state, loading: true });
  inflight = getSystemStatus()
    .then((status) => publish({ status, loading: false, error: false, checkedAt: Date.now() }))
    .catch(() => publish({ status: null, loading: false, error: true, checkedAt: Date.now() }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
};

export function useSystemStatus() {
  const [snapshot, setSnapshot] = useState<StatusState>(state);

  useEffect(() => {
    subscribers.add(setSnapshot);
    const stale = !state.checkedAt || Date.now() - state.checkedAt > REFRESH_MS;
    if (stale) void refreshSystemStatus();
    const id = window.setInterval(() => void refreshSystemStatus(), REFRESH_MS);
    return () => {
      subscribers.delete(setSnapshot);
      window.clearInterval(id);
    };
  }, []);

  const s = snapshot.status;
  return {
    ...snapshot,
    apiOnline: s?.api === "healthy",
    ollamaOnline: s?.ollama === "online",
    modelReady: s?.model_status === "available",
    allReady: s?.api === "healthy" && s?.ollama === "online" && s?.model_status === "available",
    refresh: refreshSystemStatus,
  };
}
