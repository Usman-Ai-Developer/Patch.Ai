"use client";

import { useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";

export function useConfirm() {
  const [state, setState] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "danger",
    resolve: null,
  });

  const confirm = (options) => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title: options?.title || "Are you sure?",
        message: options?.message || "This action cannot be undone.",
        confirmText: options?.confirmText || "Confirm",
        cancelText: options?.cancelText || "Cancel",
        variant: options?.variant || "danger",
        resolve,
      });
    });
  };

  const handleConfirm = () => {
    state.resolve(true);
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleCancel = () => {
    state.resolve(false);
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  const ConfirmDialogComponent = (
    <ConfirmDialog
      isOpen={state.isOpen}
      onClose={handleCancel}
      onConfirm={handleConfirm}
      title={state.title}
      message={state.message}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      variant={state.variant}
    />
  );

  return { confirm, ConfirmDialog: ConfirmDialogComponent };
}