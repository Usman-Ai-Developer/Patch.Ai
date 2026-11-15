// frontend/components/visualbuilder/useVisualBuilderSync.js
"use client";

import { useEffect, useRef } from "react";

// A tiny BroadcastChannel wrapper so the main IDE window (file tree / code
// viewer) and the Visual Builder window can tell each other "something
// changed, please refresh" without any backend changes. Falls back to a
// no-op if BroadcastChannel isn't available (older browsers) — the two
// windows still work independently, they just won't auto-refresh each
// other; a manual refresh always shows the latest saved state.
const CHANNEL_NAME = "codeassistant-visual-builder-sync";

export function useVisualBuilderChannel(projectId, onMessage) {
  const channelRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return undefined;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    channel.onmessage = (event) => {
      if (event.data?.projectId === projectId) {
        onMessage?.(event.data);
      }
    };
    return () => channel.close();
  }, [projectId, onMessage]);

  function notify(payload) {
    channelRef.current?.postMessage({ projectId, ...payload });
  }

  return { notify };
}
