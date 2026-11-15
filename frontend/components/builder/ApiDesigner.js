"use client";

import { useState } from "react";
import toast from "react-hot-toast";

const PERMISSION_CHOICES = [
  { value: "AllowAny", label: "Public (AllowAny)" },
  { value: "IsAuthenticated", label: "Authenticated Users" },
  { value: "IsAdminUser", label: "Admin Only" },
  { value: "IsOwner", label: "Owner Only" },
];

const PAGINATION_CHOICES = [
  { value: "None", label: "None" },
  { value: "PageNumberPagination", label: "Page Number" },
  { value: "LimitOffsetPagination", label: "Limit Offset" },
  { value: "CursorPagination", label: "Cursor" },
];

const SERIALIZER_CHOICES = [
  { value: "simple", label: "Simple" },
  { value: "nested", label: "Nested" },
];

function getDefaultApiSettings() {
  return {
    enabled: true,
    permissions: "IsAuthenticated",
    pagination: { type: "PageNumberPagination", page_size: 20 },
    filter_fields: [],
    search_fields: [],
    ordering_fields: "__all__",
    serializer_type: "simple",
  };
}

export default function ApiDesigner({
  appName,
  models,
  blueprintData,
  onUpdateBlueprint,
  onSave,
  onBack,
  onClose,
}) {
  const [saving, setSaving] = useState(false);

  const updateModelApi = (modelIndex, newApi) => {
    // `models` is already filtered to this app by BuilderPanel. Spreading it
    // back into blueprintData.models replaced the whole list, deleting every
    // other app's models (and their generated code). Merge instead.
    const target = models[modelIndex];
    const updatedModels = (blueprintData.models || []).map((m) =>
      m === target || (m.name === target.name && m.app_name === appName)
        ? { ...m, api: newApi }
        : m
    );
    onUpdateBlueprint({
      ...blueprintData,
      models: updatedModels,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave();
      toast.success("API settings saved successfully!");
    } catch (err) {
      toast.error("Failed to save API settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface/30 backdrop-blur-sm">
      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-all font-medium"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back
        </button>
        <span className="text-sm text-on-surface-variant font-medium">API Designer – {appName}</span>
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
            const api = model.api || getDefaultApiSettings();
            const fields = model.fields || [];

            const updateApi = (key, value) => {
              const newApi = { ...api, [key]: value };
              updateModelApi(idx, newApi);
            };

            const updatePagination = (key, value) => {
              const newPagination = { ...api.pagination, [key]: value };
              updateApi('pagination', newPagination);
            };

            const toggleArrayField = (fieldName, arrayKey) => {
              const current = api[arrayKey] || [];
              const newArray = current.includes(fieldName)
                ? current.filter(f => f !== fieldName)
                : [...current, fieldName];
              updateApi(arrayKey, newArray);
            };

            return (
              <div
                key={idx}
                className="glass-card rounded-2xl p-5 hover:border-secondary/40 transition-all"
              >
                {/* ─── Model header ────────────────────────────── */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary text-xl">api</span>
                    <h4 className="font-headline-lg text-headline-lg text-on-surface">{model.name}</h4>
                    <span className="text-xs text-on-surface-variant/60">{fields.length} fields</span>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                    <span className="text-xs font-label-caps uppercase tracking-widest">Enable API</span>
                    <input
                      type="checkbox"
                      checked={api.enabled !== false}
                      onChange={(e) => updateApi('enabled', e.target.checked)}
                      className="accent-secondary w-4 h-4"
                    />
                  </label>
                </div>

                {/* ─── Settings grid ────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Permissions */}
                  <div>
                    <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1.5">
                      Permissions
                    </label>
                    <select
                      value={api.permissions || "IsAuthenticated"}
                      onChange={(e) => updateApi('permissions', e.target.value)}
                      disabled={!api.enabled}
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all disabled:opacity-40"
                    >
                      {PERMISSION_CHOICES.map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Pagination */}
                  <div>
                    <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1.5">
                      Pagination
                    </label>
                    <select
                      value={api.pagination?.type || "PageNumberPagination"}
                      onChange={(e) => updatePagination('type', e.target.value)}
                      disabled={!api.enabled}
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all disabled:opacity-40"
                    >
                      {PAGINATION_CHOICES.map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                    {api.pagination?.type !== "None" && (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-xs text-on-surface-variant">Page Size</label>
                        <input
                          type="number"
                          min="1"
                          value={api.pagination?.page_size || 20}
                          onChange={(e) => updatePagination('page_size', parseInt(e.target.value) || 20)}
                          disabled={!api.enabled}
                          className="w-20 bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all disabled:opacity-40"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* ─── Filter Fields ────────────────────────────── */}
                <div className="mb-4">
                  <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1.5">
                    Filter Fields
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {fields.length === 0 ? (
                      <span className="text-xs text-on-surface-variant/50">No fields to filter</span>
                    ) : (
                      fields.map((field) => {
                        const id = `filter_${idx}_${field.name}`;
                        return (
                          <label key={field.name} htmlFor={id} className="flex items-center gap-1.5 text-sm text-on-surface-variant cursor-pointer">
                            <input
                              id={id}
                              type="checkbox"
                              checked={(api.filter_fields || []).includes(field.name)}
                              onChange={() => toggleArrayField(field.name, 'filter_fields')}
                              disabled={!api.enabled}
                              className="accent-secondary w-4 h-4"
                            />
                            <span className="text-on-surface">{field.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ─── Search Fields ────────────────────────────── */}
                <div className="mb-4">
                  <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1.5">
                    Search Fields
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {fields.filter(f => ['CharField', 'TextField', 'EmailField', 'URLField'].includes(f.type)).length === 0 ? (
                      <span className="text-xs text-on-surface-variant/50">No text fields available</span>
                    ) : (
                      fields
                        .filter(f => ['CharField', 'TextField', 'EmailField', 'URLField'].includes(f.type))
                        .map((field) => {
                          const id = `search_${idx}_${field.name}`;
                          return (
                            <label key={field.name} htmlFor={id} className="flex items-center gap-1.5 text-sm text-on-surface-variant cursor-pointer">
                              <input
                                id={id}
                                type="checkbox"
                                checked={(api.search_fields || []).includes(field.name)}
                                onChange={() => toggleArrayField(field.name, 'search_fields')}
                                disabled={!api.enabled}
                                className="accent-secondary w-4 h-4"
                              />
                              <span className="text-on-surface">{field.name}</span>
                            </label>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* ─── Ordering ──────────────────────────────────── */}
                <div className="mb-4">
                  <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1.5">
                    Ordering
                  </label>
                  <div className="flex items-center gap-4 mb-2">
                    <label className="flex items-center gap-1.5 text-sm text-on-surface-variant cursor-pointer">
                      <input
                        type="radio"
                        checked={api.ordering_fields === "__all__"}
                        onChange={() => updateApi('ordering_fields', "__all__")}
                        disabled={!api.enabled}
                        className="accent-secondary"
                      />
                      Allow all fields
                    </label>
                    <label className="flex items-center gap-1.5 text-sm text-on-surface-variant cursor-pointer">
                      <input
                        type="radio"
                        checked={api.ordering_fields !== "__all__"}
                        onChange={() => updateApi('ordering_fields', [])}
                        disabled={!api.enabled}
                        className="accent-secondary"
                      />
                      Select specific
                    </label>
                  </div>
                  {api.ordering_fields !== "__all__" && (
                    <div className="flex flex-wrap gap-3">
                      {fields.map((field) => {
                        const id = `ordering_${idx}_${field.name}`;
                        return (
                          <label key={field.name} htmlFor={id} className="flex items-center gap-1.5 text-sm text-on-surface-variant cursor-pointer">
                            <input
                              id={id}
                              type="checkbox"
                              checked={(api.ordering_fields || []).includes(field.name)}
                              onChange={() => toggleArrayField(field.name, 'ordering_fields')}
                              disabled={!api.enabled}
                              className="accent-secondary w-4 h-4"
                            />
                            <span className="text-on-surface">{field.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ─── Serializer Type ───────────────────────────── */}
                <div>
                  <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1.5">
                    Serializer Type
                  </label>
                  <select
                    value={api.serializer_type || "simple"}
                    onChange={(e) => updateApi('serializer_type', e.target.value)}
                    disabled={!api.enabled}
                    className="w-full md:w-64 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all disabled:opacity-40"
                  >
                    {SERIALIZER_CHOICES.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}