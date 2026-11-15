"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useConfirm } from "../../hooks/useConfirm";

function getDefaultAdminSettings() {
  return {
    enabled: true,
    list_display: [],
    list_filter: [],
    search_fields: [],
    ordering: [],
    list_editable: [],
    read_only_fields: [],
    list_per_page: 100,
    actions_on_top: true,
    fieldsets: [],
    inlines: [],
  };
}

export default function AdminDesigner({
  appName,
  models,
  blueprintData,
  onUpdateBlueprint,
  onSave,
  onBack,
  onClose,
}) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [saving, setSaving] = useState(false);

  const updateModelAdmin = (modelIndex, newAdmin) => {
    // `models` is the current app's subset; merge into the full list instead
    // of replacing it, otherwise saving admin settings for one app deletes
    // every other app's models from the blueprint.
    const target = models[modelIndex];
    const updatedModels = (blueprintData.models || []).map((m) =>
      m === target || (m.name === target.name && m.app_name === appName)
        ? { ...m, admin: newAdmin }
        : m
    );
    onUpdateBlueprint({
      ...blueprintData,
      models: updatedModels,
    });
  };

  const handleSave = async () => {
    if (!onSave) {
      toast.error("Save function not available");
      return;
    }
    setSaving(true);
    try {
      await onSave();
      toast.success("Admin settings saved!");
    } catch (err) {
      console.error("[AdminDesigner] Save error:", err);
      toast.error("Failed to save admin settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Helper to check if an inline is valid ──────────────────────────
  const isInlineValid = (targetModelName, parentModelName, currentAppName, allModels) => {
    let targetModel = null;
    for (const m of allModels) {
      if (m.name === targetModelName) {
        targetModel = m;
        break;
      }
    }
    if (!targetModel) return { valid: false, reason: "Model not found" };

    if (targetModel.name === parentModelName) {
      return { valid: false, reason: "Self‑referential: a model cannot have an inline to itself." };
    }

    let hasForeignKey = false;
    for (const field of targetModel.fields) {
      if (field.type === 'ForeignKey' || field.type === 'OneToOneField') {
        const to = field.options?.to || '';
        if (to === parentModelName || to === `${currentAppName}.${parentModelName}`) {
          hasForeignKey = true;
          break;
        }
      }
    }

    if (!hasForeignKey) {
      return { valid: false, reason: `The model "${targetModelName}" has no ForeignKey to "${parentModelName}".` };
    }

    return { valid: true, reason: "" };
  };

  // ─── Delete confirmation wrappers ──────────────────────────────────
  const handleRemoveFieldset = async (idx, fsName) => {
    const confirmed = await confirm({
      title: `Remove "${fsName}"?`,
      message: "This fieldset will be removed from the admin configuration.",
      confirmText: "Remove",
      variant: "warning",
    });
    if (!confirmed) return;
    // We'll call the original removeFieldset from the parent context
    // but we need to pass it the index – we'll do it via closure.
    // Actually, we'll implement removeFieldset inside the loop to access the idx.
    // So we'll handle it below.
  };

  // ─── Inline deletion ─────────────────────────────────────────────────
  const handleRemoveInline = async (inlineIdx) => {
    const confirmed = await confirm({
      title: "Remove this inline?",
      message: "This inline configuration will be removed.",
      confirmText: "Remove",
      variant: "warning",
    });
    if (!confirmed) return;
  };

  return (
    <div className="h-full flex flex-col bg-surface/30 backdrop-blur-sm">
      {ConfirmDialog}

      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-all font-medium"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back
        </button>
        <span className="text-sm text-on-surface-variant font-medium">Admin Designer – {appName}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-secondary text-on-secondary hover:shadow-[0_0_20px_rgba(78,223,145,0.3)] transition-all font-medium disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-sm">save</span>
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-error transition-colors"
            title="Close"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      </div>

      {/* ─── Body ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {models.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4">inbox</span>
            <p className="text-on-surface-variant text-lg">No models found</p>
            <p className="text-on-surface-variant/60 text-sm mt-1">
              Add models first in the Model Designer.
            </p>
          </div>
        ) : (
          models.map((model, idx) => {
            const admin = model.admin || getDefaultAdminSettings();
            const fields = model.fields || [];
            const textFields = fields.filter(f =>
              ['CharField', 'TextField', 'EmailField', 'URLField'].includes(f.type)
            );

            const updateAdmin = (key, value) => {
              const newAdmin = { ...admin, [key]: value };
              updateModelAdmin(idx, newAdmin);
            };

            const toggleArrayField = (fieldName, arrayKey) => {
              const current = admin[arrayKey] || [];
              const newArray = current.includes(fieldName)
                ? current.filter(f => f !== fieldName)
                : [...current, fieldName];
              updateAdmin(arrayKey, newArray);
            };

            const addFieldset = () => {
              const newFieldsets = [...(admin.fieldsets || []), { name: "New Section", fields: [] }];
              updateAdmin("fieldsets", newFieldsets);
            };

            const updateFieldset = (fsIndex, key, value) => {
              const newFieldsets = [...(admin.fieldsets || [])];
              newFieldsets[fsIndex] = { ...newFieldsets[fsIndex], [key]: value };
              updateAdmin("fieldsets", newFieldsets);
            };

            const removeFieldset = async (fsIndex, fsName) => {
              const confirmed = await confirm({
                title: `Remove "${fsName}"?`,
                message: "This fieldset will be removed from the admin configuration.",
                confirmText: "Remove",
                variant: "warning",
              });
              if (!confirmed) return;
              const newFieldsets = (admin.fieldsets || []).filter((_, i) => i !== fsIndex);
              updateAdmin("fieldsets", newFieldsets);
            };

            const toggleFieldInFieldset = (fsIndex, fieldName) => {
              const fs = (admin.fieldsets || [])[fsIndex];
              if (!fs) return;
              const currentFields = fs.fields || [];
              const newFields = currentFields.includes(fieldName)
                ? currentFields.filter(f => f !== fieldName)
                : [...currentFields, fieldName];
              updateFieldset(fsIndex, "fields", newFields);
            };

            const addInline = () => {
              const newInlines = [...(admin.inlines || []), { model: "", type: "tabular", extra: 1 }];
              updateAdmin("inlines", newInlines);
            };

            const updateInline = (inlineIndex, key, value) => {
              const newInlines = [...(admin.inlines || [])];
              newInlines[inlineIndex] = { ...newInlines[inlineIndex], [key]: value };
              updateAdmin("inlines", newInlines);
            };

            const removeInline = async (inlineIndex) => {
              const confirmed = await confirm({
                title: "Remove this inline?",
                message: "This inline configuration will be removed.",
                confirmText: "Remove",
                variant: "warning",
              });
              if (!confirmed) return;
              const newInlines = (admin.inlines || []).filter((_, i) => i !== inlineIndex);
              updateAdmin("inlines", newInlines);
            };

            const allModels = [];
            if (blueprintData?.models) {
              blueprintData.models.forEach(m => {
                allModels.push({ label: `${m.app_name}.${m.name}`, value: `${m.app_name}.${m.name}` });
              });
            }

            // ─── Helper to get inline validity ──────────────────────
            const getInlineStatus = (targetName) => {
              if (!targetName) return { valid: false, reason: "" };
              let targetModelName = targetName;
              const parts = targetName.split('.');
              if (parts.length === 2) {
                targetModelName = parts[1];
              }
              return isInlineValid(targetModelName, model.name, appName, blueprintData.models);
            };

            return (
              <div
                key={idx}
                className="glass-card rounded-2xl p-5 hover:border-secondary/40 transition-all"
              >
                {/* ─── Model header ────────────────────────────── */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary text-xl">settings</span>
                    <h4 className="font-headline-lg text-headline-lg text-on-surface">{model.name}</h4>
                    <span className="text-xs text-on-surface-variant/60">{fields.length} fields</span>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                    <span className="text-xs font-label-caps uppercase tracking-widest">Register</span>
                    <input
                      type="checkbox"
                      checked={admin.enabled !== false}
                      onChange={(e) => updateAdmin('enabled', e.target.checked)}
                      className="accent-secondary w-4 h-4"
                    />
                  </label>
                </div>

                {/* ─── Basic Admin Options ────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1.5">
                      List Display
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {fields.length === 0 ? (
                        <span className="text-xs text-on-surface-variant/50">No fields available</span>
                      ) : (
                        fields.map((field) => {
                          const id = `list_display_${idx}_${field.name}`;
                          return (
                            <label key={field.name} htmlFor={id} className="flex items-center gap-1.5 text-sm text-on-surface-variant cursor-pointer">
                              <input
                                id={id}
                                type="checkbox"
                                checked={(admin.list_display || []).includes(field.name)}
                                onChange={() => toggleArrayField(field.name, 'list_display')}
                                disabled={!admin.enabled}
                                className="accent-secondary w-4 h-4"
                              />
                              <span className="text-on-surface">{field.name}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1.5">
                      List Filter
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {fields.length === 0 ? (
                        <span className="text-xs text-on-surface-variant/50">No fields available</span>
                      ) : (
                        fields.map((field) => {
                          const id = `list_filter_${idx}_${field.name}`;
                          return (
                            <label key={field.name} htmlFor={id} className="flex items-center gap-1.5 text-sm text-on-surface-variant cursor-pointer">
                              <input
                                id={id}
                                type="checkbox"
                                checked={(admin.list_filter || []).includes(field.name)}
                                onChange={() => toggleArrayField(field.name, 'list_filter')}
                                disabled={!admin.enabled}
                                className="accent-secondary w-4 h-4"
                              />
                              <span className="text-on-surface">{field.name}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* ─── Search Fields ────────────────────────────── */}
                <div className="mb-4">
                  <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1.5">
                    Search Fields
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {textFields.length === 0 ? (
                      <span className="text-xs text-on-surface-variant/50">No text fields available</span>
                    ) : (
                      textFields.map((field) => {
                        const id = `search_fields_${idx}_${field.name}`;
                        return (
                          <label key={field.name} htmlFor={id} className="flex items-center gap-1.5 text-sm text-on-surface-variant cursor-pointer">
                            <input
                              id={id}
                              type="checkbox"
                              checked={(admin.search_fields || []).includes(field.name)}
                              onChange={() => toggleArrayField(field.name, 'search_fields')}
                              disabled={!admin.enabled}
                              className="accent-secondary w-4 h-4"
                            />
                            <span className="text-on-surface">{field.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ─── Ordering ────────────────────────────────── */}
                <div className="mb-4">
                  <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1.5">
                    Ordering
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {fields.length === 0 ? (
                      <span className="text-xs text-on-surface-variant/50">No fields available</span>
                    ) : (
                      fields.map((field) => {
                        const id = `ordering_${idx}_${field.name}`;
                        return (
                          <label key={field.name} htmlFor={id} className="flex items-center gap-1.5 text-sm text-on-surface-variant cursor-pointer">
                            <input
                              id={id}
                              type="checkbox"
                              checked={(admin.ordering || []).includes(field.name)}
                              onChange={() => toggleArrayField(field.name, 'ordering')}
                              disabled={!admin.enabled}
                              className="accent-secondary w-4 h-4"
                            />
                            <span className="text-on-surface">{field.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ─── Extra options ────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
                  <div>
                    <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1.5">
                      List Per Page
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={admin.list_per_page || 100}
                      onChange={(e) => updateAdmin('list_per_page', parseInt(e.target.value) || 100)}
                      disabled={!admin.enabled}
                      className="w-32 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all disabled:opacity-40"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-sm text-on-surface-variant cursor-pointer">
                      <input
                        type="checkbox"
                        checked={admin.actions_on_top !== false}
                        onChange={(e) => updateAdmin('actions_on_top', e.target.checked)}
                        disabled={!admin.enabled}
                        className="accent-secondary w-4 h-4"
                      />
                      Actions on top
                    </label>
                  </div>
                </div>

                {/* ─── Fieldsets ──────────────────────────────────── */}
                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant">
                      Fieldsets
                    </label>
                    <button
                      onClick={addFieldset}
                      disabled={!admin.enabled}
                      className="flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 transition-all font-medium disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Add Fieldset
                    </button>
                  </div>
                  {(!admin.fieldsets || admin.fieldsets.length === 0) && (
                    <p className="text-xs text-on-surface-variant/50">No fieldsets defined.</p>
                  )}
                  {(admin.fieldsets || []).map((fs, fsIdx) => (
                    <div key={fsIdx} className="bg-surface-container-low/50 rounded-xl p-3 border border-white/5 mb-2">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={fs.name || ""}
                          onChange={(e) => updateFieldset(fsIdx, "name", e.target.value)}
                          placeholder="Fieldset name"
                          disabled={!admin.enabled}
                          className="flex-1 bg-transparent border-b border-white/10 text-sm text-on-surface py-1 outline-none focus:border-secondary transition-all disabled:opacity-40"
                        />
                        <button
                          onClick={() => removeFieldset(fsIdx, fs.name || "Unnamed")}
                          disabled={!admin.enabled}
                          className="text-on-surface-variant hover:text-error transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                      <div>
                        <label className="block text-xs text-on-surface-variant/60 mb-1">Fields</label>
                        <div className="flex flex-wrap gap-3">
                          {fields.map((field) => {
                            const id = `fieldset_${idx}_${fsIdx}_${field.name}`;
                            return (
                              <label key={field.name} htmlFor={id} className="flex items-center gap-1.5 text-sm text-on-surface-variant cursor-pointer">
                                <input
                                  id={id}
                                  type="checkbox"
                                  checked={(fs.fields || []).includes(field.name)}
                                  onChange={() => toggleFieldInFieldset(fsIdx, field.name)}
                                  disabled={!admin.enabled}
                                  className="accent-secondary w-4 h-4"
                                />
                                <span className="text-on-surface">{field.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ─── Inlines ────────────────────────────────────── */}
                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant">
                      Inlines
                    </label>
                    <button
                      onClick={addInline}
                      disabled={!admin.enabled}
                      className="flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 transition-all font-medium disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Add Inline
                    </button>
                  </div>
                  {(!admin.inlines || admin.inlines.length === 0) && (
                    <p className="text-xs text-on-surface-variant/50">No inlines defined.</p>
                  )}
                  {(admin.inlines || []).map((inline, inlineIdx) => {
                    const selectedModel = inline.model || "";
                    const status = getInlineStatus(selectedModel);
                    const isValid = status.valid;
                    const reason = status.reason;

                    return (
                      <div key={inlineIdx} className="bg-surface-container-low/50 rounded-xl p-3 border border-white/5 mb-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedModel}
                            onChange={(e) => updateInline(inlineIdx, "model", e.target.value)}
                            disabled={!admin.enabled}
                            className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all disabled:opacity-40"
                          >
                            <option value="">-- Select model --</option>
                            {allModels.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={inline.type || "tabular"}
                            onChange={(e) => updateInline(inlineIdx, "type", e.target.value)}
                            disabled={!admin.enabled}
                            className="bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all disabled:opacity-40"
                          >
                            <option value="tabular">Tabular</option>
                            <option value="stacked">Stacked</option>
                          </select>
                          <input
                            type="number"
                            min="0"
                            value={inline.extra || 1}
                            onChange={(e) => updateInline(inlineIdx, "extra", parseInt(e.target.value) || 1)}
                            disabled={!admin.enabled}
                            className="w-16 bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all disabled:opacity-40"
                            placeholder="extra"
                          />
                          <button
                            onClick={() => removeInline(inlineIdx)}
                            disabled={!admin.enabled}
                            className="text-on-surface-variant hover:text-error transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                        {selectedModel && !isValid && (
                          <div className="mt-2 flex items-start gap-2 text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg p-2 text-xs">
                            <span className="material-symbols-outlined text-sm">warning</span>
                            <span>{reason}</span>
                          </div>
                        )}
                        {selectedModel && isValid && (
                          <div className="mt-2 flex items-start gap-2 text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg p-2 text-xs">
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                            <span>Valid: this model has a ForeignKey to "{model.name}".</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}