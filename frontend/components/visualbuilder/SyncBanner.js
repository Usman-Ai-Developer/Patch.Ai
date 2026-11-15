// frontend/components/visualbuilder/SyncBanner.js
"use client";

import React from "react";

// Honest sync-status indicator. The Blueprint's stored layout JSON is
// always the source of truth; this banner compares it against whatever
// layout schema is embedded in the currently-generated file (if any) and
// tells the user plainly what will happen if they hit "Generate".
//
// Note: this cannot detect a human hand-editing the JSX body of an
// already-generated visual page without touching its header comment —
// doing that reliably would require re-implementing the Python JSX
// renderer a second time in JavaScript, which is a much bigger source of
// bugs than the problem it solves. If you hand-edit a visual page's body,
// your edits will be OVERWRITTEN the next time you click "Generate" for
// that page — the badge below tells you when that regeneration is about
// to happen.
export default function SyncBanner({ status }) {
  if (status === "in-sync") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/10 text-secondary text-xs rounded-lg">
        <span className="material-symbols-outlined text-sm">check_circle</span>
        Code matches your visual layout
      </div>
    );
  }
  if (status === "unsaved") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-400 text-xs rounded-lg">
        <span className="material-symbols-outlined text-sm">sync_problem</span>
        Layout changed — click Generate to update the code file
      </div>
    );
  }
  if (status === "never-generated") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 text-on-surface-variant text-xs rounded-lg">
        <span className="material-symbols-outlined text-sm">info</span>
        This page hasn&apos;t been generated with your visual layout yet
      </div>
    );
  }
  if (status === "no-frontend") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 text-on-surface-variant text-xs rounded-lg">
        <span className="material-symbols-outlined text-sm">info</span>
        Frontend not generated yet — Generate to create it
      </div>
    );
  }
  return null;
}
