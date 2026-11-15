"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useConfirm } from "../../hooks/useConfirm";

export default function PagesDesigner({ models, frontendData, onUpdate }) {
  const { confirm, ConfirmDialog } = useConfirm();
  const enabledPages = frontendData?.pages?.enabled || [];
  const customPages = frontendData?.pages?.custom || [];
  const pageSettings = frontendData?.pages?.settings || {};

  const [newCustomPage, setNewCustomPage] = useState({ name: "", path: "" });
  const [activeTab, setActiveTab] = useState("model");

  // ─── Toggle model page ──────────────────────────────────────────────
  const toggleModelPage = (modelName) => {
    const newEnabled = enabledPages.includes(modelName)
      ? enabledPages.filter((m) => m !== modelName)
      : [...enabledPages, modelName];

    // Update navigation. Only model entries are rebuilt — custom pages and
    // any other links must survive toggling a model page (they used to be
    // silently dropped on every click).
    const currentNav = frontendData.navigation || [];
    const modelPaths = new Set(models.map((m) => `/${m.name.toLowerCase()}`));

    const newNav = currentNav.filter((item) => !modelPaths.has(item.path));

    for (const model of newEnabled) {
      const path = `/${model.toLowerCase()}`;
      if (!newNav.some((item) => item.path === path)) {
        newNav.push({ label: model, path });
      }
    }

    onUpdate({
      ...frontendData,
      pages: {
        ...frontendData.pages,
        enabled: newEnabled,
      },
      navigation: newNav,
    });
  };

  // ─── Toggle page setting ────────────────────────────────────────────
  const toggleSetting = (modelName, setting) => {
    const currentSettings = pageSettings[modelName] || {
      list: true,
      create: true,
      edit: true,
      delete: true,
      showInNav: true,
    };
    const newSettings = {
      ...currentSettings,
      [setting]: !currentSettings[setting],
    };
    onUpdate({
      ...frontendData,
      pages: {
        ...frontendData.pages,
        settings: {
          ...pageSettings,
          [modelName]: newSettings,
        },
      },
    });
  };

  // ─── Add custom page ────────────────────────────────────────────────
  const addCustomPage = () => {
    if (!newCustomPage.name.trim() || !newCustomPage.path.trim()) {
      toast.error("Name and path are required.");
      return;
    }
    if (!newCustomPage.path.startsWith("/")) {
      newCustomPage.path = "/" + newCustomPage.path;
    }
    // Remove duplicate slashes
    const path = newCustomPage.path.replace(/\/+/g, "/");
    if (customPages.some((p) => p.path === path)) {
      toast.error("A page with this path already exists.");
      return;
    }
    const newCustom = [...customPages, { name: newCustomPage.name.trim(), path }];
    // Also add to navigation
    const newNav = [...(frontendData.navigation || [])];
    if (!newNav.some((item) => item.path === path)) {
      newNav.push({ label: newCustomPage.name.trim(), path });
    }
    onUpdate({
      ...frontendData,
      pages: {
        ...frontendData.pages,
        custom: newCustom,
      },
      navigation: newNav,
    });
    setNewCustomPage({ name: "", path: "" });
    toast.success("Custom page added");
  };

  const removeCustomPage = async (index) => {
    const confirmed = await confirm({
      title: "Remove custom page?",
      message: `Remove "${customPages[index].name}" from the project?`,
      confirmText: "Remove",
      variant: "warning",
    });
    if (!confirmed) return;
    const newCustom = customPages.filter((_, i) => i !== index);
    const removedPath = customPages[index].path;
    const newNav = (frontendData.navigation || []).filter(
      (item) => item.path !== removedPath
    );
    onUpdate({
      ...frontendData,
      pages: {
        ...frontendData.pages,
        custom: newCustom,
      },
      navigation: newNav,
    });
  };

  const allModels = models.map((m) => m.name);

  return (
    <div>
      {ConfirmDialog}
      <h3 className="font-headline-lg text-headline-lg text-on-surface mb-4">
        Pages
      </h3>
      <p className="font-body-md text-body-md text-on-surface-variant mb-6">
        Select which model pages to include and configure custom pages.
      </p>

      {/* ─── Tabs ────────────────────────────────────────────────────── */}
      <div className="flex border-b border-white/5 mb-6">
        <button
          onClick={() => setActiveTab("model")}
          className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
            activeTab === "model"
              ? "border-secondary text-secondary"
              : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          Model Pages
        </button>
        <button
          onClick={() => setActiveTab("custom")}
          className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
            activeTab === "custom"
              ? "border-secondary text-secondary"
              : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          Custom Pages
        </button>
      </div>

      {/* ─── Model Pages ────────────────────────────────────────────── */}
      {activeTab === "model" && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allModels.map((model) => {
              const isEnabled = enabledPages.includes(model);
              const settings = pageSettings[model] || {
                list: true,
                create: true,
                edit: true,
                delete: true,
                showInNav: true,
              };
              return (
                <div
                  key={model}
                  className={`glass-card rounded-xl p-4 transition-all ${
                    isEnabled
                      ? "border-secondary/40 bg-secondary/5"
                      : "border-white/5 hover:bg-surface-container/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-on-surface">
                        {model}
                      </h4>
                      <p className="text-xs text-on-surface-variant/60">
                        {isEnabled ? "Enabled" : "Disabled"}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleModelPage(model)}
                      className="text-2xl"
                    >
                      <span
                        className={`material-symbols-outlined ${
                          isEnabled ? "text-secondary" : "text-on-surface-variant/30"
                        }`}
                      >
                        {isEnabled ? "check_circle" : "radio_button_unchecked"}
                      </span>
                    </button>
                  </div>
                  {isEnabled && (
                    <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
                      <div className="flex flex-wrap gap-2">
                        <label className="flex items-center gap-1 text-xs text-on-surface-variant cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.list}
                            onChange={() => toggleSetting(model, "list")}
                            className="accent-secondary w-3 h-3"
                          />
                          List
                        </label>
                        <label className="flex items-center gap-1 text-xs text-on-surface-variant cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.create}
                            onChange={() => toggleSetting(model, "create")}
                            className="accent-secondary w-3 h-3"
                          />
                          Create
                        </label>
                        <label className="flex items-center gap-1 text-xs text-on-surface-variant cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.edit}
                            onChange={() => toggleSetting(model, "edit")}
                            className="accent-secondary w-3 h-3"
                          />
                          Edit
                        </label>
                        <label className="flex items-center gap-1 text-xs text-on-surface-variant cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.delete}
                            onChange={() => toggleSetting(model, "delete")}
                            className="accent-secondary w-3 h-3"
                          />
                          Delete
                        </label>
                      </div>
                      <label className="flex items-center gap-1 text-xs text-on-surface-variant cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.showInNav}
                          onChange={() => toggleSetting(model, "showInNav")}
                          className="accent-secondary w-3 h-3"
                        />
                        Show in Navigation
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Custom Pages ────────────────────────────────────────────── */}
      {activeTab === "custom" && (
        <div>
          <div className="mb-4">
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Page Name"
                value={newCustomPage.name}
                onChange={(e) =>
                  setNewCustomPage({ ...newCustomPage, name: e.target.value })
                }
                className="flex-1 min-w-[120px] bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
              />
              <input
                type="text"
                placeholder="Path (e.g., /about)"
                value={newCustomPage.path}
                onChange={(e) =>
                  setNewCustomPage({ ...newCustomPage, path: e.target.value })
                }
                className="flex-1 min-w-[120px] bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
              />
              <button
                onClick={addCustomPage}
                className="px-4 py-2 bg-secondary text-on-secondary text-sm font-bold rounded-xl hover:shadow-[0_0_20px_rgba(78,223,145,0.3)] transition-all"
              >
                Add
              </button>
            </div>
          </div>

          {customPages.length === 0 && (
            <p className="text-sm text-on-surface-variant/60">No custom pages yet.</p>
          )}

          <div className="space-y-2">
            {customPages.map((page, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-surface-container-low/50 rounded-xl p-3 border border-white/5"
              >
                <div>
                  <span className="font-medium text-on-surface">{page.name}</span>
                  <span className="ml-2 text-xs text-on-surface-variant/60 font-mono">
                    {page.path}
                  </span>
                </div>
                <button
                  onClick={() => removeCustomPage(index)}
                  className="text-on-surface-variant hover:text-error transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}