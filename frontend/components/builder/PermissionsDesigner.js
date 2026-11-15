"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useConfirm } from "../../hooks/useConfirm";

const PERMISSION_ACTIONS = [
  { value: "create", label: "Create", icon: "add" },
  { value: "read", label: "Read", icon: "visibility" },
  { value: "update", label: "Update", icon: "edit" },
  { value: "delete", label: "Delete", icon: "delete" },
];

function getDefaultPermissions() {
  return {
    enabled: false,
    roles: [
      { name: "Admin", permissions: ["create", "read", "update", "delete"] },
      { name: "Editor", permissions: ["create", "read", "update"] },
      { name: "Viewer", permissions: ["read"] },
    ],
  };
}

export default function PermissionsDesigner({
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

  const updateModelPermissions = (modelIndex, newPermissions) => {
    // Same merge rule as ApiDesigner/AdminDesigner: `models` is only this
    // app's slice of blueprintData.models.
    const target = models[modelIndex];
    const updatedModels = (blueprintData.models || []).map((m) =>
      m === target || (m.name === target.name && m.app_name === appName)
        ? { ...m, permissions: newPermissions }
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
      toast.success("Permissions settings saved!");
    } catch (err) {
      console.error("[PermissionsDesigner] Save error:", err);
      toast.error("Failed to save permissions settings: " + err.message);
    } finally {
      setSaving(false);
    }
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
          Back to Features
        </button>
        <span className="text-sm text-on-surface-variant font-medium">Permissions Designer – {appName}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-secondary text-on-secondary hover:shadow-[0_0_20px_rgba(78,223,145,0.3)] transition-all font-medium disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-sm">save</span>
            {saving ? "Saving…" : "Save Permissions"}
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
            const defaultPerms = getDefaultPermissions();
            const perms = model.permissions
              ? { ...defaultPerms, ...model.permissions }
              : defaultPerms;
            const { enabled, roles } = perms;

            const updatePermissions = (key, value) => {
              const newPerms = { ...perms, [key]: value };
              updateModelPermissions(idx, newPerms);
            };

            const updateRolePermissions = (roleIndex, field, value) => {
              const newRoles = [...roles];
              if (field === "name") {
                newRoles[roleIndex] = { ...newRoles[roleIndex], name: value };
              } else if (field === "permissions") {
                newRoles[roleIndex] = { ...newRoles[roleIndex], permissions: value };
              }
              updatePermissions("roles", newRoles);
            };

            const toggleRolePermission = (roleIndex, action) => {
              const role = roles[roleIndex];
              const current = role.permissions || [];
              const newPermissions = current.includes(action)
                ? current.filter(p => p !== action)
                : [...current, action];
              updateRolePermissions(roleIndex, "permissions", newPermissions);
            };

            const addRole = () => {
              const newRoles = [...roles, { name: "New Role", permissions: [] }];
              updatePermissions("roles", newRoles);
            };

            const removeRole = async (roleIndex) => {
              const roleName = roles[roleIndex]?.name || "Unnamed";
              const confirmed = await confirm({
                title: `Remove "${roleName}"?`,
                message: "This role will be removed from the permissions configuration.",
                confirmText: "Remove Role",
                variant: "warning",
              });
              if (!confirmed) return;
              const newRoles = roles.filter((_, i) => i !== roleIndex);
              updatePermissions("roles", newRoles);
            };

            return (
              <div
                key={idx}
                className="glass-card rounded-2xl p-5 hover:border-secondary/40 transition-all"
              >
                {/* ─── Model header ────────────────────────────── */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary text-xl">lock</span>
                    <h4 className="font-headline-lg text-headline-lg text-on-surface">{model.name}</h4>
                    <span className="text-xs text-on-surface-variant/60">{model.fields?.length || 0} fields</span>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                    <span className="text-xs font-label-caps uppercase tracking-widest">Enable Permissions</span>
                    <input
                      type="checkbox"
                      checked={enabled !== false}
                      onChange={(e) => updatePermissions("enabled", e.target.checked)}
                      className="accent-secondary w-4 h-4"
                    />
                  </label>
                </div>

                {/* ─── Roles ────────────────────────────────────── */}
                <div className={enabled ? "opacity-100" : "opacity-40"}>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant">
                      Roles and Permissions
                    </label>
                    <button
                      onClick={addRole}
                      disabled={!enabled}
                      className="flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 transition-all font-medium disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Add Role
                    </button>
                  </div>

                  <div className="space-y-3">
                    {roles.map((role, roleIdx) => (
                      <div key={roleIdx} className="bg-surface-container-low/50 rounded-xl p-3 border border-white/5">
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="text"
                            value={role.name}
                            onChange={(e) => updateRolePermissions(roleIdx, "name", e.target.value)}
                            disabled={!enabled}
                            className="flex-1 bg-transparent border-b border-white/10 text-sm text-on-surface py-1 outline-none focus:border-secondary transition-all disabled:opacity-40"
                            placeholder="Role name"
                          />
                          <button
                            onClick={() => removeRole(roleIdx)}
                            disabled={!enabled}
                            className="text-on-surface-variant hover:text-error transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {PERMISSION_ACTIONS.map((action) => {
                            const id = `perm_${idx}_${roleIdx}_${action.value}`;
                            return (
                              <label
                                key={action.value}
                                htmlFor={id}
                                className="flex items-center gap-1.5 text-sm text-on-surface-variant cursor-pointer"
                              >
                                <input
                                  id={id}
                                  type="checkbox"
                                  checked={(role.permissions || []).includes(action.value)}
                                  onChange={() => toggleRolePermission(roleIdx, action.value)}
                                  disabled={!enabled}
                                  className="accent-secondary w-4 h-4"
                                />
                                <span className="material-symbols-outlined text-sm">{action.icon}</span>
                                <span className="text-on-surface">{action.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}