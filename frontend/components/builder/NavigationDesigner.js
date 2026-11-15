"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useConfirm } from "../../hooks/useConfirm";

export default function NavigationDesigner({ models, frontendData, onUpdate }) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemPath, setNewItemPath] = useState("");

  const navigation = frontendData.navigation || [];

  const moveItem = (index, direction) => {
    const newNav = [...navigation];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newNav.length) return;
    [newNav[index], newNav[targetIndex]] = [newNav[targetIndex], newNav[index]];
    onUpdate({
      ...frontendData,
      navigation: newNav,
    });
  };

  const removeItem = async (index) => {
    const confirmed = await confirm({
      title: "Remove navigation item?",
      message: `Remove "${navigation[index].label}" from navigation?`,
      confirmText: "Remove",
      variant: "warning",
    });
    if (!confirmed) return;
    const newNav = navigation.filter((_, i) => i !== index);
    onUpdate({
      ...frontendData,
      navigation: newNav,
    });
  };

  const addCustomItem = () => {
    if (!newItemLabel.trim() || !newItemPath.trim()) {
      toast.error("Label and path are required.");
      return;
    }
    const newNav = [
      ...navigation,
      { label: newItemLabel.trim(), path: newItemPath.trim() },
    ];
    onUpdate({
      ...frontendData,
      navigation: newNav,
    });
    setNewItemLabel("");
    setNewItemPath("");
    toast.success("Navigation item added");
  };

  const updateLabel = (index, newLabel) => {
    const newNav = [...navigation];
    newNav[index] = { ...newNav[index], label: newLabel };
    onUpdate({
      ...frontendData,
      navigation: newNav,
    });
  };

  return (
    <div>
      {ConfirmDialog}
      <h3 className="font-headline-lg text-headline-lg text-on-surface mb-4">
        Navigation
      </h3>
      <p className="font-body-md text-body-md text-on-surface-variant mb-6">
        Order and customize the navigation items. Dashboard is always first.
      </p>

      <div className="space-y-3">
        {navigation.map((item, index) => (
          <div
            key={item.path}
            className="flex items-center gap-3 bg-surface-container-low/50 rounded-xl p-3 border border-white/5"
          >
            <span className="text-on-surface-variant/40 text-sm">
              {index + 1}
            </span>
            <input
              type="text"
              value={item.label}
              onChange={(e) => updateLabel(index, e.target.value)}
              className="flex-1 bg-transparent text-sm text-on-surface outline-none border-b border-white/10 focus:border-secondary transition-all"
            />
            <span className="text-xs text-on-surface-variant/40 font-mono">
              {item.path}
            </span>
            <button
              onClick={() => moveItem(index, -1)}
              disabled={index === 0}
              className="text-on-surface-variant hover:text-primary transition-colors disabled:opacity-20"
            >
              <span className="material-symbols-outlined text-sm">arrow_upward</span>
            </button>
            <button
              onClick={() => moveItem(index, 1)}
              disabled={index === navigation.length - 1}
              className="text-on-surface-variant hover:text-primary transition-colors disabled:opacity-20"
            >
              <span className="material-symbols-outlined text-sm">arrow_downward</span>
            </button>
            <button
              onClick={() => removeItem(index)}
              className="text-on-surface-variant hover:text-error transition-colors"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-white/5">
        <h4 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-on-surface mb-3">
          Add Custom Link
        </h4>
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Label"
            value={newItemLabel}
            onChange={(e) => setNewItemLabel(e.target.value)}
            className="flex-1 min-w-[120px] bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
          />
          <input
            type="text"
            placeholder="Path (e.g., /about)"
            value={newItemPath}
            onChange={(e) => setNewItemPath(e.target.value)}
            className="flex-1 min-w-[120px] bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
          />
          <button
            onClick={addCustomItem}
            className="px-4 py-2 bg-secondary text-on-secondary text-sm font-bold rounded-xl hover:shadow-[0_0_20px_rgba(78,223,145,0.3)] transition-all"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}