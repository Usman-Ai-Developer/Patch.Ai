// frontend/components/TerminalPanel.js

"use client";

import { useEffect, useRef, useState } from "react";
import { getAccessToken } from "../lib/auth";

// VS Code Dark+ terminal palette
const VSCODE_THEME = {
  background: "#1e1e1e",
  foreground: "#cccccc",
  cursor: "#ffffff",
  cursorAccent: "#1e1e1e",
  selectionBackground: "#264f78",
  black: "#000000",
  red: "#cd3131",
  green: "#0dbc79",
  yellow: "#e5e510",
  blue: "#2472c8",
  magenta: "#bc3fbc",
  cyan: "#11a8cd",
  white: "#e5e5e5",
  brightBlack: "#666666",
  brightRed: "#f14c4c",
  brightGreen: "#23d18b",
  brightYellow: "#f5f543",
  brightBlue: "#3b8eea",
  brightMagenta: "#d670d6",
  brightCyan: "#29b8db",
  brightWhite: "#e5e5e5",
};

const HEADER_HEIGHT = 34;
const DEFAULT_HEIGHT = 240;
const MIN_HEIGHT = 140;
const MAX_HEIGHT = 640;

export default function TerminalPanel({ projectId, onClose }) {
  const terminalRef = useRef(null);
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);

  const [isMinimized, setIsMinimized] = useState(false);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const dragStateRef = useRef({ dragging: false, startY: 0, startHeight: DEFAULT_HEIGHT });
  const [isDragging, setIsDragging] = useState(false);

  // ─── Minimize / restore ─────────────────────────────────────────────
  // This only toggles visibility — the WebSocket + shell process stay
  // alive underneath, exactly like collapsing VS Code's terminal panel
  // doesn't kill your running shell.
  const toggleMinimize = () => {
    setIsMinimized((prev) => {
      const next = !prev;
      if (!next) {
        // Restoring: the container was `display: none`, so xterm's
        // internal size measurements are stale — refit once it's
        // visible again.
        requestAnimationFrame(() => {
          try {
            fitAddonRef.current?.fit();
          } catch (e) {
            console.warn("Fit after restore failed:", e);
          }
        });
      }
      return next;
    });
  };

  // ─── Drag-to-resize ──────────────────────────────────────────────────
  const handleDragStart = (e) => {
    if (isMinimized) return;
    dragStateRef.current = { dragging: true, startY: e.clientY, startHeight: height };
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleDragMove = (e) => {
      if (!dragStateRef.current.dragging) return;
      // Dragging the handle up (clientY decreases) should grow the
      // panel; dragging down should shrink it — the panel's bottom
      // edge stays put and only the top edge moves, which is what
      // makes it feel like it collapses toward the bottom.
      const delta = dragStateRef.current.startY - e.clientY;
      const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragStateRef.current.startHeight + delta));
      setHeight(next);
    };
    const handleDragEnd = () => {
      if (!dragStateRef.current.dragging) return;
      dragStateRef.current.dragging = false;
      setIsDragging(false);
    };
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
    };
  }, []);

  const resetHeight = () => setHeight(DEFAULT_HEIGHT);

  // ─── Terminal + WebSocket lifecycle ─────────────────────────────────
  // Deliberately depends on [projectId] only — NOT isMinimized — so
  // minimizing the panel never tears down the shell session.
  useEffect(() => {
    if (typeof window === "undefined") return;

    let term;
    let fitAddon;
    let resizeObserver;
    let disposed = false;

    import("@xterm/xterm").then(({ Terminal }) => {
      import("@xterm/addon-fit").then(({ FitAddon }) => {
        import("@xterm/xterm/css/xterm.css");

        if (!terminalRef.current || disposed) return;

        const token = getAccessToken();
        if (!token) {
          console.error("No access token found");
          return;
        }

        term = new Terminal({
          cursorBlink: true,
          cursorStyle: "bar",
          theme: VSCODE_THEME,
          fontFamily:
            "'Cascadia Code', 'JetBrains Mono', Menlo, Consolas, 'Courier New', monospace",
          fontSize: 14,
          lineHeight: 1.2,
          letterSpacing: 0,
          scrollback: 5000,
          convertEol: true,
          allowProposedApi: true,
        });
        termRef.current = term;

        fitAddon = new FitAddon();
        fitAddonRef.current = fitAddon;
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);

        requestAnimationFrame(() => {
          try {
            fitAddon.fit();
          } catch (e) {
            console.warn("Initial fit failed:", e);
          }
          term.focus();

          const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
          // Derive the WebSocket host from configuration instead of a
          // hardcoded port: NEXT_PUBLIC_WS_URL wins, then the API origin,
          // then the page's own origin.
          let wsHost = window.location.host;
          try {
            const configured =
              process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL;
            if (configured) wsHost = new URL(configured, window.location.origin).host;
          } catch {
            wsHost = window.location.host;
          }
          const wsUrl = `${protocol}//${wsHost}/ws/terminal/${projectId}/?token=${token}&cols=${term.cols}&rows=${term.rows}`;

          const ws = new WebSocket(wsUrl);
          wsRef.current = ws;

          const sendResize = () => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
            }
          };

          term.attachCustomKeyEventHandler((e) => {
            const isCtrl = e.ctrlKey || e.metaKey;
            if (isCtrl && e.key === "c" && term.hasSelection() && e.type === "keydown") {
              navigator.clipboard.writeText(term.getSelection()).catch(() => {});
              return false;
            }
            return true;
          });

          const pasteFromClipboard = () => {
            navigator.clipboard
              .readText()
              .then((text) => {
                if (ws.readyState === WebSocket.OPEN && text) {
                  ws.send(JSON.stringify({ type: "input", data: text }));
                }
              })
              .catch(() => {});
          };

          const handlePaste = (e) => {
            e.preventDefault();
            const pasted = e.clipboardData?.getData("text");
            if (pasted && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "input", data: pasted }));
            } else {
              pasteFromClipboard();
            }
          };

          const handleKeyDown = (e) => {
            const isCtrl = e.ctrlKey || e.metaKey;
            if (isCtrl && e.key === "v") {
              e.preventDefault();
              pasteFromClipboard();
              return false;
            }
            return true;
          };

          const handleContextMenu = (e) => {
            e.preventDefault();
            if (term.hasSelection()) {
              navigator.clipboard.writeText(term.getSelection()).catch(() => {});
              term.clearSelection();
            } else {
              pasteFromClipboard();
            }
          };

          const terminalElement = terminalRef.current;
          terminalElement.addEventListener("paste", handlePaste);
          terminalElement.addEventListener("keydown", handleKeyDown);
          terminalElement.addEventListener("contextmenu", handleContextMenu);

          // Fires whenever the terminal's own DOM box changes size —
          // covers both the drag-resize handle and window resizes.
          // Doesn't fire while `display: none` (minimized), which is
          // why toggleMinimize() calls fitAddon.fit() manually on
          // restore.
          resizeObserver = new ResizeObserver(() => {
            try {
              fitAddon.fit();
            } catch (e) {
              // ignore transient layout thrash
            }
          });
          resizeObserver.observe(terminalElement);

          term.onResize(sendResize);

          ws.onopen = () => {
            setConnected(true);
            sendResize();
          };

          ws.onclose = (event) => {
            setConnected(false);
            term.writeln(`\r\n\x1b[31mConnection closed (code: ${event.code}).\x1b[0m`);
          };

          ws.onerror = () => {
            setConnected(false);
            term.writeln("\r\n\x1b[31mError connecting to terminal.\x1b[0m");
          };

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === "output") {
                term.write(data.data);
              }
            } catch (e) {
              console.error("WebSocket message error:", e);
            }
          };

          term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "input", data }));
            }
          });

          const handleClick = () => term.focus();
          terminalElement.addEventListener("click", handleClick);

          term._cleanup = () => {
            resizeObserver?.disconnect();
            terminalElement.removeEventListener("click", handleClick);
            terminalElement.removeEventListener("paste", handlePaste);
            terminalElement.removeEventListener("keydown", handleKeyDown);
            terminalElement.removeEventListener("contextmenu", handleContextMenu);
            if (ws.readyState === WebSocket.OPEN) ws.close();
          };
        });
      });
    });

    return () => {
      disposed = true;
      if (termRef.current) {
        termRef.current._cleanup?.();
        termRef.current.dispose();
        termRef.current = null;
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [projectId]);

  const handleClear = () => termRef.current?.clear();

  return (
    <div
      className="flex flex-col w-full"
      style={{
        background: "#1e1e1e",
        height: isMinimized ? HEADER_HEIGHT : height,
        transition: isDragging ? "none" : "height 150ms ease",
        overflow: "hidden",
      }}
    >
      {/* ─── Drag handle: grabbing and dragging up expands the panel,
          dragging down shrinks it toward the bottom of the screen ─── */}
      {!isMinimized && (
        <div
          onMouseDown={handleDragStart}
          onDoubleClick={resetHeight}
          className="w-full shrink-0"
          style={{ height: 4, cursor: "row-resize" }}
          title="Drag to resize · double-click to reset"
        />
      )}

      <div
        className="flex items-center justify-between px-3 py-1.5 shrink-0"
        style={{ background: "#252526", borderBottom: "1px solid #1e1e1e" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono" style={{ color: "#cccccc" }}>
            bash — patch/
          </span>
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: connected ? "#0dbc79" : "#f14c4c" }}
            title={connected ? "Connected" : "Disconnected"}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMinimize}
            className="text-xs hover:opacity-80"
            style={{ color: "#cccccc" }}
            title={isMinimized ? "Expand terminal" : "Minimize terminal"}
          >
            {isMinimized ? "▸" : "▾"}
          </button>
          <button
            onClick={handleClear}
            className="text-xs hover:opacity-80"
            style={{ color: "#cccccc" }}
            title="Clear terminal"
          >
            ⟲
          </button>
          <button
            onClick={onClose}
            className="text-xs hover:text-red-400"
            style={{ color: "#cccccc" }}
            title="Close terminal"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Always mounted (keeps xterm's DOM node alive across
          minimize toggles) — only visually hidden when minimized. */}
      <div
        ref={terminalRef}
        className="flex-1 min-h-0 px-1 py-1"
        style={{ background: "#1e1e1e", display: isMinimized ? "none" : "block" }}
      />
    </div>
  );
}