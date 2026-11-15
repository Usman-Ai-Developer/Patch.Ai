"use client";

import { useEffect, useRef } from "react";

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger", // 'danger' | 'warning' | 'info'
}) {
  const dialogRef = useRef(null);

  // ─── Close on Escape ────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const variantColors = {
    danger: {
      bg: "bg-error-container/10",
      border: "border-error/20",
      text: "text-error",
      button: "bg-error text-on-error hover:shadow-[0_0_30px_rgba(255,180,171,0.3)]",
    },
    warning: {
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
      text: "text-yellow-500",
      button: "bg-yellow-500 text-black hover:shadow-[0_0_30px_rgba(255,200,0,0.3)]",
    },
    info: {
      bg: "bg-secondary/10",
      border: "border-secondary/20",
      text: "text-secondary",
      button: "bg-secondary text-on-secondary hover:shadow-[0_0_30px_rgba(78,223,145,0.3)]",
    },
  };

  const colors = variantColors[variant] || variantColors.info;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="glass-card rounded-[28px] max-w-md w-full p-lg md:p-xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Icon ────────────────────────────────────────────────── */}
        <div className={`w-14 h-14 rounded-full ${colors.bg} border ${colors.border} flex items-center justify-center mx-auto mb-md`}>
          {variant === "danger" && (
            <span className="material-symbols-outlined text-3xl text-error">warning</span>
          )}
          {variant === "warning" && (
            <span className="material-symbols-outlined text-3xl text-yellow-500">warning</span>
          )}
          {variant === "info" && (
            <span className="material-symbols-outlined text-3xl text-secondary">info</span>
          )}
        </div>

        <h3 className="font-headline-lg text-headline-lg text-center text-text mb-sm">{title}</h3>
        <p className="font-body-md text-body-md text-on-surface-variant text-center mb-lg">{message}</p>

        <div className="flex flex-col sm:flex-row gap-md justify-center">
          <button
            onClick={onClose}
            className="px-3xl py-sm rounded-xl border border-outline-variant text-on-surface-variant hover:text-on-surface transition-colors font-body-md text-body-md"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-3xl py-sm rounded-xl font-bold transition-all ${colors.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}