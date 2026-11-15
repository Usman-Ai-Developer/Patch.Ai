"use client";

import { useState } from "react";
import { useConfirm } from "../../hooks/useConfirm";

const FIELD_TYPES = [
  "CharField",
  "TextField",
  "IntegerField",
  "FloatField",
  "DecimalField",
  "BooleanField",
  "DateField",
  "DateTimeField",
  "EmailField",
  "URLField",
  "ForeignKey",
  "ManyToManyField",
  "OneToOneField",
  "PasswordField",
];

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

const ON_DELETE_CHOICES = [
  "CASCADE",
  "PROTECT",
  "SET_NULL",
  "SET_DEFAULT",
  "DO_NOTHING",
];

function getDefaultApiSettings() {
  return {
    enabled: true,
    permissions: "IsAuthenticated",
    pagination: {
      type: "PageNumberPagination",
      page_size: 20,
    },
    filter_fields: [],
    search_fields: [],
    ordering_fields: "__all__",
    serializer_type: "simple",
  };
}

export default function ModelDesigner({
  appName,
  models,
  allModels,
  onBack,
  onClose,
  onSave,
  saving,
  onAddModel,
  onUpdateModel,
  onDeleteModel,
  onAddField,
  onUpdateField,
  onDeleteField,
  onGenerate,
  generating,
  blueprintData,
  onUpdateBlueprintData,
}) {
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const projectSettings = blueprintData?.project_settings || { reset_database_on_conflict: true };

  const handleProjectSettingChange = (key, value) => {
    if (onUpdateBlueprintData) {
      const newData = { ...blueprintData };
      newData.project_settings = { ...projectSettings, [key]: value };
      onUpdateBlueprintData(newData);
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
          Back to Apps
        </button>
        <span className="text-sm text-on-surface-variant font-medium">Model Designer – {appName}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
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

      {/* ─── Project Settings ──────────────────────────────────── */}
      <div className="px-4 py-2 border-b border-white/5">
        <div
          className="flex items-center justify-between cursor-pointer text-xs text-on-surface-variant hover:text-primary transition-colors"
          onClick={() => setShowProjectSettings(!showProjectSettings)}
        >
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">settings</span>
            Project Settings
          </span>
          <span className="material-symbols-outlined text-sm">{showProjectSettings ? "expand_less" : "expand_more"}</span>
        </div>
        {showProjectSettings && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-on-surface-variant">Reset Database on Migration Conflict</label>
              <input
                type="checkbox"
                checked={projectSettings.reset_database_on_conflict ?? true}
                onChange={(e) => handleProjectSettingChange("reset_database_on_conflict", e.target.checked)}
                className="accent-secondary"
              />
            </div>
            <p className="text-[10px] text-on-surface-variant/60">
              When enabled, the builder will automatically delete the database and all migration files
              if a migration conflict is detected, and then retry.
            </p>
          </div>
        )}
      </div>

      {/* ─── Model List ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {models.map((model, idx) => (
          <ModelCard
            key={idx}
            model={model}
            index={idx}
            allModels={allModels}
            onUpdate={(updated) => onUpdateModel(idx, updated)}
            onDelete={() => onDeleteModel(idx)}
            onAddField={() => onAddField(idx)}
            onUpdateField={(fieldIndex, updated) => onUpdateField(idx, fieldIndex, updated)}
            onDeleteField={(fieldIndex) => onDeleteField(idx, fieldIndex)}
          />
        ))}

        <button
          onClick={onAddModel}
          className="w-full border-2 border-dashed border-outline-variant rounded-xl py-4 text-on-surface-variant hover:text-primary hover:border-secondary transition-colors flex items-center justify-center gap-1 font-medium"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add Model
        </button>
      </div>

      {/* ─── Footer ────────────────────────────────────────────────── */}
      <div className="border-t border-white/5 px-4 py-3 flex justify-between shrink-0">
        <div className="text-xs text-on-surface-variant self-center">
          {models.length} model{models.length !== 1 ? "s" : ""} defined in {appName}
        </div>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="flex items-center gap-1 px-6 py-2 bg-secondary text-on-secondary rounded-xl font-semibold hover:shadow-[0_0_30px_rgba(78,223,145,0.3)] transition-all disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-sm">rocket_launch</span>
          {generating ? "Generating…" : "Generate Code"}
        </button>
      </div>
    </div>
  );
}

// ─── Model Card ──────────────────────────────────────────────────────
function ModelCard({ model, index, allModels, onUpdate, onDelete, onAddField, onUpdateField, onDeleteField }) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [apiSettingsOpen, setApiSettingsOpen] = useState(false);
  const [metaSettingsOpen, setMetaSettingsOpen] = useState(false);

  const handleApiChange = (path, value) => {
    const newModel = { ...model };
    const parts = path.split(".");
    let current = newModel;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
    onUpdate(newModel);
  };

  const handleMetaChange = (key, value) => {
    const newMeta = { ...(model.meta || {}), [key]: value };
    const newModel = { ...model, meta: newMeta };
    onUpdate(newModel);
  };

  const api = model.api || getDefaultApiSettings();
  const meta = model.meta || {};

  const hasMetaValues = meta.db_table || meta.verbose_name || meta.verbose_name_plural || 
                        (meta.ordering && meta.ordering.length > 0) || 
                        (meta.unique_together && meta.unique_together.length > 0);

  const handleDeleteModel = async () => {
    const confirmed = await confirm({
      title: `Delete "${model.name}"?`,
      message: "All fields and data associated with this model will be permanently removed.",
      confirmText: "Delete Model",
      variant: "danger",
    });
    if (!confirmed) return;
    onDelete();
  };

  return (
    <div className="glass-card rounded-2xl p-5 hover:border-secondary/40 transition-all">
      {ConfirmDialog}
      {/* ─── Model header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <input
          type="text"
          value={model.name}
          onChange={(e) => onUpdate({ ...model, name: e.target.value })}
          className="bg-transparent border-b border-white/10 text-on-surface font-headline-lg text-headline-lg outline-none focus:border-secondary transition-all w-48"
          placeholder="Model name"
        />
        <button
          onClick={handleDeleteModel}
          className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-error transition-colors font-medium"
        >
          <span className="material-symbols-outlined text-sm">delete</span>
          Delete Model
        </button>
      </div>

      {/* ─── Fields ──────────────────────────────────────────────── */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-label-caps uppercase tracking-widest text-on-surface-variant">Fields</span>
        </div>
        {model.fields.map((field, fieldIndex) => (
          <FieldRow
            key={fieldIndex}
            field={field}
            index={fieldIndex}
            allModels={allModels}
            onUpdate={(updated) => onUpdateField(fieldIndex, updated)}
            onDelete={() => onDeleteField(fieldIndex)}
          />
        ))}
        <button
          onClick={onAddField}
          className="w-full mt-2 py-2 border border-dashed border-outline-variant rounded-lg text-on-surface-variant hover:text-secondary hover:border-secondary transition-colors flex items-center justify-center gap-1 text-sm font-medium"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add Field
        </button>
      </div>

      {/* ─── Model Meta Options ────────────────────────────────── */}
      <div className="mb-3">
        <div
          className="flex items-center justify-between cursor-pointer text-xs text-on-surface-variant hover:text-primary transition-colors py-1"
          onClick={() => setMetaSettingsOpen(!metaSettingsOpen)}
        >
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">article</span>
            Model Meta Options
            {hasMetaValues && <span className="ml-2 text-secondary text-[10px] font-medium">(configured)</span>}
          </span>
          <span className="material-symbols-outlined text-sm">{metaSettingsOpen ? "expand_less" : "expand_more"}</span>
        </div>

        {metaSettingsOpen && (
          <div className="mt-2 space-y-2 border-t border-white/5 pt-3">
            <div>
              <label htmlFor={`db_table_${index}`} className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1">
                Database Table Name
              </label>
              <input
                id={`db_table_${index}`}
                type="text"
                value={meta.db_table || ""}
                onChange={(e) => handleMetaChange("db_table", e.target.value)}
                placeholder="Leave blank for Django default"
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
              />
              <p className="text-[10px] text-on-surface-variant/60 mt-0.5">Custom table name in the database.</p>
            </div>

            <div>
              <label htmlFor={`verbose_name_${index}`} className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1">
                Verbose Name (Singular)
              </label>
              <input
                id={`verbose_name_${index}`}
                type="text"
                value={meta.verbose_name || ""}
                onChange={(e) => handleMetaChange("verbose_name", e.target.value)}
                placeholder="e.g., Blog Post"
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
              />
            </div>

            <div>
              <label htmlFor={`verbose_name_plural_${index}`} className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1">
                Verbose Name (Plural)
              </label>
              <input
                id={`verbose_name_plural_${index}`}
                type="text"
                value={meta.verbose_name_plural || ""}
                onChange={(e) => handleMetaChange("verbose_name_plural", e.target.value)}
                placeholder="e.g., Blog Posts"
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
              />
            </div>

            <div>
              <label htmlFor={`ordering_${index}`} className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1">
                Default Ordering
              </label>
              <input
                id={`ordering_${index}`}
                type="text"
                value={Array.isArray(meta.ordering) ? meta.ordering.join(", ") : ""}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  const arr = val ? val.split(",").map(s => s.trim()).filter(Boolean) : [];
                  handleMetaChange("ordering", arr);
                }}
                placeholder="e.g., -created_at, title"
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
              />
              <p className="text-[10px] text-on-surface-variant/60 mt-0.5">Comma-separated field names. Prefix with '-' for descending.</p>
            </div>

            <div>
              <label htmlFor={`unique_together_${index}`} className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1">
                Unique Together
              </label>
              <input
                id={`unique_together_${index}`}
                type="text"
                value={Array.isArray(meta.unique_together) && meta.unique_together.length > 0 
                  ? meta.unique_together.map(arr => `(${arr.join(", ")})`).join(", ")
                  : ""}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  if (!val) {
                    handleMetaChange("unique_together", []);
                    return;
                  }
                  const groups = val.split(/\)\s*,\s*\(/);
                  const result = groups.map(group => {
                    const clean = group.replace(/^\(/, "").replace(/\)$/, "").trim();
                    return clean.split(",").map(s => s.trim()).filter(Boolean);
                  }).filter(arr => arr.length > 0);
                  handleMetaChange("unique_together", result);
                }}
                placeholder="e.g., (title, category), (slug)"
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
              />
              <p className="text-[10px] text-on-surface-variant/60 mt-0.5">Comma-separated groups of fields that must be unique together.</p>
            </div>
          </div>
        )}
      </div>

      {/* ─── API Settings ────────────────────────────────────────── */}
      <div>
        <div
          className="flex items-center justify-between cursor-pointer text-xs text-on-surface-variant hover:text-primary transition-colors py-1"
          onClick={() => setApiSettingsOpen(!apiSettingsOpen)}
        >
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">api</span>
            API Settings
          </span>
          <span className="material-symbols-outlined text-sm">{apiSettingsOpen ? "expand_less" : "expand_more"}</span>
        </div>

        {apiSettingsOpen && (
          <div className="mt-2 space-y-3 border-t border-white/5 pt-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-on-surface-variant">Enable API</label>
              <input
                type="checkbox"
                checked={api.enabled ?? true}
                onChange={(e) => handleApiChange("api.enabled", e.target.checked)}
                className="accent-secondary"
              />
            </div>

            <div>
              <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1">Permissions</label>
              <select
                value={api.permissions || "IsAuthenticated"}
                onChange={(e) => handleApiChange("api.permissions", e.target.value)}
                disabled={!api.enabled}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all disabled:opacity-40"
              >
                {PERMISSION_CHOICES.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1">Pagination</label>
              <select
                value={api.pagination?.type || "PageNumberPagination"}
                onChange={(e) => handleApiChange("api.pagination.type", e.target.value)}
                disabled={!api.enabled}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all disabled:opacity-40"
              >
                {PAGINATION_CHOICES.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
              {api.pagination?.type !== "None" && (
                <div className="mt-1">
                  <label className="block text-xs text-on-surface-variant">Page Size</label>
                  <input
                    type="number"
                    min="1"
                    value={api.pagination?.page_size ?? 20}
                    onChange={(e) =>
                      handleApiChange("api.pagination.page_size", parseInt(e.target.value) || 20)
                    }
                    className="w-24 bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1">Filter Fields</label>
              <div className="flex flex-wrap gap-1">
                {model.fields.map((field) => {
                  const id = `filter_${index}_${field.name}`;
                  return (
                    <label key={field.name} htmlFor={id} className="flex items-center gap-1 text-xs text-on-surface-variant cursor-pointer">
                      <input
                        id={id}
                        type="checkbox"
                        checked={(api.filter_fields || []).includes(field.name)}
                        onChange={(e) => {
                          const current = api.filter_fields || [];
                          const newFields = e.target.checked
                            ? [...current, field.name]
                            : current.filter((f) => f !== field.name);
                          handleApiChange("api.filter_fields", newFields);
                        }}
                        className="accent-secondary w-3 h-3"
                      />
                      {field.name}
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1">Search Fields</label>
              <div className="flex flex-wrap gap-1">
                {model.fields
                  .filter((f) => ["CharField", "TextField", "EmailField", "URLField"].includes(f.type))
                  .map((field) => {
                    const id = `search_${index}_${field.name}`;
                    return (
                      <label key={field.name} htmlFor={id} className="flex items-center gap-1 text-xs text-on-surface-variant cursor-pointer">
                        <input
                          id={id}
                          type="checkbox"
                          checked={(api.search_fields || []).includes(field.name)}
                          onChange={(e) => {
                            const current = api.search_fields || [];
                            const newFields = e.target.checked
                              ? [...current, field.name]
                              : current.filter((f) => f !== field.name);
                            handleApiChange("api.search_fields", newFields);
                          }}
                          className="accent-secondary w-3 h-3"
                        />
                        {field.name}
                      </label>
                    );
                  })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1">Ordering</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-xs text-on-surface-variant cursor-pointer">
                  <input
                    type="radio"
                    checked={api.ordering_fields === "__all__"}
                    onChange={() => handleApiChange("api.ordering_fields", "__all__")}
                    className="accent-secondary"
                  />
                  Allow all fields
                </label>
                <label className="flex items-center gap-1 text-xs text-on-surface-variant cursor-pointer">
                  <input
                    type="radio"
                    checked={api.ordering_fields !== "__all__"}
                    onChange={() => handleApiChange("api.ordering_fields", [])}
                    className="accent-secondary"
                  />
                  Select specific
                </label>
              </div>
              {api.ordering_fields !== "__all__" && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {model.fields.map((field) => {
                    const id = `ordering_${index}_${field.name}`;
                    return (
                      <label key={field.name} htmlFor={id} className="flex items-center gap-1 text-xs text-on-surface-variant cursor-pointer">
                        <input
                          id={id}
                          type="checkbox"
                          checked={(api.ordering_fields || []).includes(field.name)}
                          onChange={(e) => {
                            const current = api.ordering_fields || [];
                            const newFields = e.target.checked
                              ? [...current, field.name]
                              : current.filter((f) => f !== field.name);
                            handleApiChange("api.ordering_fields", newFields);
                          }}
                          className="accent-secondary w-3 h-3"
                        />
                        {field.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1">Serializer Type</label>
              <select
                value={api.serializer_type || "simple"}
                onChange={(e) => handleApiChange("api.serializer_type", e.target.value)}
                disabled={!api.enabled}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all disabled:opacity-40"
              >
                {SERIALIZER_CHOICES.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Field Row ──────────────────────────────────────────────────────
function FieldRow({ field, index, allModels, onUpdate, onDelete }) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isRequired = !field.options?.null && !field.options?.blank;

  const handleRequiredChange = (checked) => {
    const options = { ...field.options };
    options.null = !checked;
    options.blank = !checked;
    onUpdate({ ...field, options });
  };

  const handleOptionChange = (key, value) => {
    const options = { ...field.options, [key]: value };
    onUpdate({ ...field, options });
  };

  const isRelation = ["ForeignKey", "ManyToManyField", "OneToOneField"].includes(field.type);
  const isDateOrDateTime = ["DateField", "DateTimeField"].includes(field.type);
  const supportsChoices = !isRelation && !isDateOrDateTime;

  const choices = field.options?.choices || [];

  const addChoice = () => {
    const newChoices = [...choices, ['', '']];
    handleOptionChange('choices', newChoices);
  };

  const updateChoice = (idx, fieldType, value) => {
    const newChoices = [...choices];
    newChoices[idx] = fieldType === 'value' ? [value, newChoices[idx][1]] : [newChoices[idx][0], value];
    handleOptionChange('choices', newChoices);
  };

  const removeChoice = (idx) => {
    const newChoices = choices.filter((_, i) => i !== idx);
    handleOptionChange('choices', newChoices);
  };

  const targetModels = [];
  if (allModels) {
    allModels.forEach((app) => {
      app.models.forEach((model) => {
        targetModels.push({
          label: `${app.name}.${model}`,
          value: `${app.name}.${model}`,
        });
      });
    });
  }

  const handleDeleteField = async () => {
    const confirmed = await confirm({
      title: `Delete field "${field.name}"?`,
      message: "This field will be permanently removed from the model.",
      confirmText: "Delete Field",
      variant: "danger",
    });
    if (!confirmed) return;
    onDelete();
  };

  return (
    <>
      {ConfirmDialog}
      <div className="mb-2 bg-surface-container-low/50 rounded-xl p-2 border border-white/5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={field.name}
            onChange={(e) => onUpdate({ ...field, name: e.target.value })}
            className="bg-transparent text-on-surface text-sm outline-none w-24 border-b border-white/10 focus:border-secondary transition-all"
            placeholder="name"
          />
          <select
            value={field.type}
            onChange={(e) => {
              const newType = e.target.value;
              let options = { ...field.options };
              if (!["ForeignKey", "ManyToManyField", "OneToOneField"].includes(newType)) {
                delete options.to;
                delete options.on_delete;
                delete options.related_name;
                delete options.symmetrical;
              }
              if (!["DateField", "DateTimeField"].includes(newType)) {
                delete options.auto_now;
                delete options.auto_now_add;
              }
              onUpdate({ ...field, type: newType, options });
            }}
            className="bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface outline-none focus:border-secondary transition-all"
          >
            {FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={field.options?.max_length || ""}
            onChange={(e) => {
              const options = { ...field.options, max_length: e.target.value || undefined };
              onUpdate({ ...field, options });
            }}
            className="bg-transparent text-on-surface text-sm outline-none w-16 border-b border-white/10 focus:border-secondary transition-all"
            placeholder="max_len"
          />
          <label className="flex items-center gap-1 text-xs text-on-surface-variant whitespace-nowrap cursor-pointer">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => handleRequiredChange(e.target.checked)}
              className="accent-secondary w-3 h-3"
            />
            Required
          </label>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-sm">{showAdvanced ? "expand_less" : "expand_more"}</span>
            Advanced
          </button>
          <button
            onClick={handleDeleteField}
            className="text-on-surface-variant hover:text-error transition-colors ml-auto"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>

        {showAdvanced && (
          <div className="mt-2 pl-2 border-l border-white/5 space-y-2">
            {isRelation && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-on-surface-variant font-medium">Target Model</label>
                  <select
                    value={field.options?.to || ""}
                    onChange={(e) => handleOptionChange("to", e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                  >
                    <option value="">-- Select --</option>
                    {targetModels.map((tm) => (
                      <option key={tm.value} value={tm.value}>
                        {tm.label}
                      </option>
                    ))}
                  </select>
                </div>
                {["ForeignKey", "OneToOneField"].includes(field.type) && (
                  <div>
                    <label className="block text-xs text-on-surface-variant font-medium">On Delete</label>
                    <select
                      value={field.options?.on_delete || "CASCADE"}
                      onChange={(e) => handleOptionChange("on_delete", e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                    >
                      {ON_DELETE_CHOICES.map((choice) => (
                        <option key={choice} value={choice}>
                          {choice}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-on-surface-variant font-medium">Related Name</label>
                  <input
                    type="text"
                    value={field.options?.related_name || ""}
                    onChange={(e) => handleOptionChange("related_name", e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                    placeholder="related_name"
                  />
                </div>
                {field.type === "ManyToManyField" && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-on-surface-variant font-medium">Symmetrical</label>
                    <input
                      type="checkbox"
                      checked={field.options?.symmetrical !== false}
                      onChange={(e) => handleOptionChange("symmetrical", e.target.checked)}
                      className="accent-secondary"
                    />
                  </div>
                )}
              </div>
            )}

            {isDateOrDateTime && (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-on-surface-variant font-medium">Auto Now</label>
                  <input
                    type="checkbox"
                    checked={!!field.options?.auto_now}
                    onChange={(e) => handleOptionChange("auto_now", e.target.checked)}
                    className="accent-secondary"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-on-surface-variant font-medium">Auto Now Add</label>
                  <input
                    type="checkbox"
                    checked={!!field.options?.auto_now_add}
                    onChange={(e) => handleOptionChange("auto_now_add", e.target.checked)}
                    className="accent-secondary"
                  />
                </div>
              </div>
            )}

            {/* ─── Choices ────────────────────────────────────────────── */}
            {supportsChoices && (
              <div className="col-span-2">
                <label className="block text-xs text-on-surface-variant font-medium">Choices</label>
                <div className="space-y-1.5 mt-1">
                  {choices.map((choice, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={choice[0] || ''}
                        onChange={(e) => updateChoice(idx, 'value', e.target.value)}
                        placeholder="Value"
                        className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                      />
                      <input
                        type="text"
                        value={choice[1] || ''}
                        onChange={(e) => updateChoice(idx, 'label', e.target.value)}
                        placeholder="Label"
                        className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                      />
                      <button
                        onClick={() => removeChoice(idx)}
                        className="text-on-surface-variant hover:text-error transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addChoice}
                    className="text-xs text-secondary hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Add choice
                  </button>
                  <p className="text-[10px] text-on-surface-variant/60 mt-0.5">
                    Each choice appears as a dropdown option in the admin and API.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-on-surface-variant font-medium">Unique</label>
                <input
                  type="checkbox"
                  checked={!!field.options?.unique}
                  onChange={(e) => handleOptionChange("unique", e.target.checked)}
                  className="accent-secondary"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-on-surface-variant font-medium">Primary Key</label>
                <input
                  type="checkbox"
                  checked={!!field.options?.primary_key}
                  onChange={(e) => handleOptionChange("primary_key", e.target.checked)}
                  className="accent-secondary"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-on-surface-variant font-medium">DB Index</label>
                <input
                  type="checkbox"
                  checked={!!field.options?.db_index}
                  onChange={(e) => handleOptionChange("db_index", e.target.checked)}
                  className="accent-secondary"
                />
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant font-medium">Default</label>
                <input
                  type="text"
                  value={field.options?.default !== undefined ? String(field.options.default) : ""}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val === "True") val = true;
                    else if (val === "False") val = false;
                    else if (val === "None") val = null;
                    else if (!isNaN(val) && val !== "") val = Number(val);
                    handleOptionChange("default", val);
                  }}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                  placeholder="default"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-on-surface-variant font-medium">Help Text</label>
                <input
                  type="text"
                  value={field.options?.help_text || ""}
                  onChange={(e) => handleOptionChange("help_text", e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                  placeholder="help_text"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}