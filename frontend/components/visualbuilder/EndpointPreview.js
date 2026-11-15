// frontend/components/visualbuilder/EndpointPreview.js
"use client";

import React, { useState } from "react";
import { getPreviewStatus } from "../../lib/api";
import { getAccessToken } from "../../lib/auth";
import { useBuilderData } from "./builderContext";
import { getModelEndpoint, getModelApiSettings, buildLivePreviewUrl } from "./apiUtils";

// Shown inside Table / Form / DetailView / StatCard / DataList previews once
// a model is selected. Displays the exact REST endpoint the generated
// backend will expose for that model, and lets the builder fetch a live
// sample from it (if the project's preview server is running) so the
// widget<->API binding can be verified without leaving the canvas.
export default function EndpointPreview({ model }) {
  const { projectId } = useBuilderData();
  const [state, setState] = useState({ status: "idle" }); // idle | loading | success | error

  if (!model) return null;
  const endpoint = getModelEndpoint(model);
  if (!endpoint) return null;
  const apiSettings = getModelApiSettings(model);
  const enabled = apiSettings.enabled !== false;

  async function handlePreview(e) {
    e.stopPropagation();
    if (!enabled || !projectId) return;
    setState({ status: "loading" });
    try {
      const preview = await getPreviewStatus(projectId);
      if (!preview?.running || !preview?.backend_running || !preview?.backend_port) {
        setState({
          status: "error",
          message: "Preview server isn't running. Start the live preview from the workspace toolbar, then try again.",
        });
        return;
      }
      const url = buildLivePreviewUrl(preview.backend_port, endpoint);
      const token = getAccessToken();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setState({
            status: "error",
            message: `Endpoint returned ${res.status}. It requires "${apiSettings.permissions}" access — log into the generated app first, or set permissions to "Public (AllowAny)" in the API Designer to preview it here.`,
          });
        } else {
          setState({ status: "error", message: `Request failed: HTTP ${res.status}` });
        }
        return;
      }
      const json = await res.json();
      const rows = Array.isArray(json) ? json : json.results || [];
      setState({ status: "success", rows, count: json.count ?? rows.length });
    } catch (err) {
      setState({
        status: "error",
        message: err.message || "Could not reach the preview server. Is it running on this machine?",
      });
    }
  }

  return (
    <div className="mt-2 border-t border-white/10 pt-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2">
        <code className="text-[10px] text-on-surface-variant/70 truncate">
          GET {endpoint}
        </code>
        <button
          type="button"
          onClick={handlePreview}
          disabled={!enabled || state.status === "loading"}
          title={!enabled ? "Enable this model's API in the API Designer first" : "Fetch a live sample from this endpoint"}
          className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-all font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {state.status === "loading" ? "Fetching…" : "Preview live data"}
        </button>
      </div>

      {!enabled && (
        <p className="text-[10px] text-amber-400/80 mt-1">API is disabled for this model — enable it in the API Designer.</p>
      )}

      {state.status === "error" && (
        <p className="text-[10px] text-red-400/90 mt-1.5 leading-snug">{state.message}</p>
      )}

      {state.status === "success" && (
        <div className="mt-1.5">
          <p className="text-[10px] text-secondary mb-1">
            {state.count} record{state.count === 1 ? "" : "s"} returned
          </p>
          {state.rows.length === 0 ? (
            <p className="text-[10px] text-on-surface-variant/50">No rows yet.</p>
          ) : (
            <div className="max-h-28 overflow-y-auto rounded border border-white/10 bg-surface-container-low">
              {state.rows.slice(0, 5).map((row, i) => (
                <div key={row.id ?? i} className="px-2 py-1 text-[10px] text-on-surface-variant/80 border-b border-white/5 last:border-0 truncate">
                  {Object.entries(row)
                    .slice(0, 4)
                    .map(([k, v]) => `${k}: ${String(v)}`)
                    .join("  ·  ")}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
