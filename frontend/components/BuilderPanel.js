"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  getBlueprint,
  updateBlueprint,
  generateProject,
  getAppsStructure,
  createApp,
  startProject,
  deleteApp,
  createSuperuser,
  enableAuth,
  getFileTree,
} from "../lib/api";
import { useConfirm } from "../hooks/useConfirm";

import BuilderHome from "./builder/BuilderHome";
import AppList from "./builder/AppList";
import AppDetails from "./builder/AppDetails";
import ModelDesigner from "./builder/ModelDesigner";
import Breadcrumb from "./builder/BreadCrumb";
import StartProjectModal from "./builder/StartProjectModal";
import NewAppModal from "./builder/NewAppModal";
import SuperuserModal from "./builder/SuperuserModal";
import FrontendExplorer from "./builder/FrontendExplorer";
import FrontendBuilder from "./builder/FrontendBuilder"; // NEW

// ─── Designers ──────────────────────────────────────────────────────
import ApiDesigner from "./builder/ApiDesigner";
import AdminDesigner from "./builder/AdminDesigner";
import PermissionsDesigner from "./builder/PermissionsDesigner";
import WorkflowsDesigner from "./builder/WorkflowsDesigner";
import AiActionsDesigner from "./builder/AiActionsDesigner";

function isNotFoundError(err) {
  const status = err?.status ?? err?.statusCode ?? err?.response?.status ?? err?.cause?.status;
  if (status === 404) return true;
  return typeof err?.message === "string" && /not\s*found/i.test(err.message);
}

function isValidAppName(name) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

// Normalize path for Windows compatibility
function normalizePath(path) {
  return path.replace(/\\/g, '/');
}

// Check if a file path is inside the frontend/ directory
function isFrontendPath(path) {
  if (!path) return false;
  const normalized = normalizePath(path);
  return normalized.startsWith('frontend/') || normalized.includes('/frontend/');
}

export default function BuilderPanel({
  projectId,
  projectName: parentProjectName,
  onClose,
  onProjectStarted,
  onSelectFile,
  onRefreshWorkspace,
}) {
  const { confirm, ConfirmDialog } = useConfirm();

  const [blueprint, setBlueprint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [designerModels, setDesignerModels] = useState([]);

  // ─── Navigation state ──────────────────────────────────────────────
  const [view, setView] = useState('home');
  const [currentApp, setCurrentApp] = useState(null);
  const [currentFeature, setCurrentFeature] = useState(null);

  // ─── Modals ──────────────────────────────────────────────────────
  const [showStartModal, setShowStartModal] = useState(false);
  const [showNewAppModal, setShowNewAppModal] = useState(false);
  const [showSuperuserModal, setShowSuperuserModal] = useState(false);

  // ─── Frontend state ──────────────────────────────────────────────
  const [frontendExists, setFrontendExists] = useState(false);
  const [frontendStack, setFrontendStack] = useState("react");

  const [newAppName, setNewAppName] = useState("");
  const [creatingApp, setCreatingApp] = useState(false);
  const [startFramework, setStartFramework] = useState("drf");
  const [startProjectName, setStartProjectName] = useState("");
  const [startAppName, setStartAppName] = useState("");
  const [startingProject, setStartingProject] = useState(false);
  const [superuserData, setSuperuserData] = useState({
    username: "",
    email: "",
    password: "",
    password2: "",
  });
  const [creatingSuperuser, setCreatingSuperuser] = useState(false);
  const [enablingAuth, setEnablingAuth] = useState(false);

  // ─── Check frontend existence ──────────────────────────────────────
  const checkFrontendExists = async () => {
    try {
      const tree = await getFileTree(projectId);
      const hasFrontend = tree.some(f => isFrontendPath(f.path));
      setFrontendExists(hasFrontend);
      return hasFrontend;
    } catch (err) {
      console.error("Failed to check frontend:", err);
      return false;
    }
  };

  // ─── Fetch data ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        const blueprintData = await getBlueprint(projectId);
        setBlueprint(blueprintData);
        if (blueprintData) {
          const appsData = await getAppsStructure(projectId);
          setApps(appsData);
          await checkFrontendExists();
        }
      } catch (err) {
        if (isNotFoundError(err)) {
          setBlueprint(null);
          setApps([]);
        } else {
          console.error(err);
          toast.error("Failed to load builder data");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  useEffect(() => {
    if (blueprint && currentApp) {
      const allModels = blueprint.data.models || [];
      const filtered = allModels.filter((m) => m.app_name === currentApp);
      setDesignerModels(filtered);
    } else {
      setDesignerModels([]);
    }
  }, [blueprint, currentApp]);

  // ─── Actions ──────────────────────────────────────────────────────
  const saveBlueprint = async () => {
    setSaving(true);
    try {
      const updated = await updateBlueprint(projectId, blueprint.data);
      setBlueprint(updated);
      toast.success("Blueprint saved");
      return updated;
    } catch (err) {
      toast.error("Failed to save blueprint");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async (target = 'both') => {
    setGenerating(true);
    try {
      // Save blueprint first
      const savedBlueprint = await saveBlueprint();
      setBlueprint(savedBlueprint);

      // Generate with target
      await generateProject(projectId, target);
      toast.success("Code generated successfully!");

      // Refresh apps
      const appsData = await getAppsStructure(projectId);
      setApps(appsData);

      // Check frontend existence
      const hasFrontend = await checkFrontendExists();
      setFrontendExists(hasFrontend);

      // If target includes frontend and frontend now exists, navigate to frontend builder
      if ((target === 'frontend' || target === 'both') && hasFrontend) {
        setView('frontend-builder');
      }

      if (onProjectStarted) onProjectStarted();
      if (onRefreshWorkspace) onRefreshWorkspace();
    } catch (err) {
      toast.error(err.message || "Failed to generate code");
    } finally {
      setGenerating(false);
    }
  };

  const handleRefreshApps = async () => {
    try {
      const appsData = await getAppsStructure(projectId);
      setApps(appsData);
      await checkFrontendExists();
      toast.success("App list refreshed");
      if (onRefreshWorkspace) onRefreshWorkspace();
    } catch (err) {
      toast.error("Failed to refresh apps");
    }
  };

  // ─── Frontend handler ──────────────────────────────────────────────
  const handleFrontendClick = async () => {
    const hasFrontend = await checkFrontendExists();
    if (hasFrontend) {
      setView('frontend-builder');
    } else {
      setView('frontend-setup');
    }
  };

  // ─── Navigation handlers ──────────────────────────────────────────
  const goToHome = () => {
    setView('home');
    setCurrentApp(null);
    setCurrentFeature(null);
  };

  const selectBackend = () => {
    setView('apps');
  };

  const selectFrontend = () => {
    handleFrontendClick();
  };

  const selectApp = (appName) => {
    setCurrentApp(appName);
    setView('app-details');
  };

  const selectFeature = (feature) => {
    if (feature === 'models') {
      setView('designer');
      setCurrentFeature('models');
    } else if (feature === 'apis') {
      setView('designer');
      setCurrentFeature('apis');
    } else if (feature === 'admin') {
      setView('designer');
      setCurrentFeature('admin');
    } else if (feature === 'permissions') {
      setView('designer');
      setCurrentFeature('permissions');
    } else if (feature === 'workflows') {
      setView('designer');
      setCurrentFeature('workflows');
    } else if (feature === 'ai-actions') {
      setView('designer');
      setCurrentFeature('ai-actions');
    } else {
      toast(`"${feature}" feature coming soon!`, { icon: '🚧' });
    }
  };

  const navigateBreadcrumb = (index) => {
    if (index === 0) goToHome();
    else if (index === 1 && (view === 'app-details' || view === 'designer')) {
      setView('apps');
    } else if (index === 2 && view === 'designer') {
      setView('app-details');
    }
  };

  // ─── Model CRUD ──────────────────────────────────────────────────
  const addModel = () => {
    if (!currentApp) return;
    const newModel = {
      name: "NewModel",
      app_name: currentApp,
      fields: [],
      relationships: [],
      permissions: [],
      filter_fields: [],
      search_fields: [],
      ordering_fields: [],
      admin: { list_display: [], search_fields: [] },
    };
    const updatedModels = [...blueprint.data.models, newModel];
    setBlueprint({
      ...blueprint,
      data: { ...blueprint.data, models: updatedModels },
    });
  };

  const updateModel = (index, updatedModel) => {
    const filtered = blueprint.data.models.filter((m) => m.app_name === currentApp);
    if (index >= filtered.length) return;
    const modelToUpdate = filtered[index];
    const globalIndex = blueprint.data.models.indexOf(modelToUpdate);
    if (globalIndex === -1) return;
    const newModels = [...blueprint.data.models];
    newModels[globalIndex] = updatedModel;
    setBlueprint({
      ...blueprint,
      data: { ...blueprint.data, models: newModels },
    });
  };

  const deleteModel = (filteredIndex) => {
    const filtered = blueprint.data.models.filter((m) => m.app_name === currentApp);
    if (filteredIndex >= filtered.length) return;
    const modelToDelete = filtered[filteredIndex];
    const globalIndex = blueprint.data.models.indexOf(modelToDelete);
    if (globalIndex === -1) return;
    const newModels = blueprint.data.models.filter((_, i) => i !== globalIndex);
    setBlueprint({
      ...blueprint,
      data: { ...blueprint.data, models: newModels },
    });
  };

  const addField = (filteredIndex) => {
    const filtered = blueprint.data.models.filter((m) => m.app_name === currentApp);
    if (filteredIndex >= filtered.length) return;
    const model = filtered[filteredIndex];
    const newField = { name: "new_field", type: "CharField", options: {} };
    const updatedModel = { ...model, fields: [...model.fields, newField] };
    updateModel(filteredIndex, updatedModel);
  };

  const updateField = (filteredIndex, fieldIndex, updatedField) => {
    const filtered = blueprint.data.models.filter((m) => m.app_name === currentApp);
    if (filteredIndex >= filtered.length) return;
    const model = filtered[filteredIndex];
    const fields = [...model.fields];
    fields[fieldIndex] = updatedField;
    const updatedModel = { ...model, fields };
    updateModel(filteredIndex, updatedModel);
  };

  const deleteField = (filteredIndex, fieldIndex) => {
    const filtered = blueprint.data.models.filter((m) => m.app_name === currentApp);
    if (filteredIndex >= filtered.length) return;
    const model = filtered[filteredIndex];
    const fields = model.fields.filter((_, i) => i !== fieldIndex);
    const updatedModel = { ...model, fields };
    updateModel(filteredIndex, updatedModel);
  };

  // ─── Other handlers ──────────────────────────────────────────────
  const handleStartProject = async () => {
    if (startAppName && !isValidAppName(startAppName)) {
      toast.error(
        "App name must be a valid Python identifier (letters, underscores, digits – no spaces or special chars)."
      );
      return;
    }
    setStartingProject(true);
    try {
      const result = await startProject(
        projectId,
        startFramework,
        startProjectName.trim() || undefined,
        startAppName.trim() || undefined
      );
      setBlueprint(result);
      toast.success("Project started!");
      setShowStartModal(false);
      setStartProjectName("");
      setStartAppName("");
      const appsData = await getAppsStructure(projectId);
      setApps(appsData);
      if (onProjectStarted) onProjectStarted();
      if (onRefreshWorkspace) onRefreshWorkspace();
    } catch (err) {
      toast.error(err.message || "Failed to start project");
    } finally {
      setStartingProject(false);
    }
  };

  const handleCreateApp = async () => {
    if (!newAppName.trim()) {
      toast.error("App name is required");
      return;
    }
    if (!isValidAppName(newAppName.trim())) {
      toast.error(
        "App name must be a valid Python identifier (letters, underscores, digits – no spaces or special chars)."
      );
      return;
    }
    setCreatingApp(true);
    try {
      await createApp(projectId, newAppName.trim());
      toast.success(`App '${newAppName.trim()}' created`);
      setShowNewAppModal(false);
      setNewAppName("");
      const appsData = await getAppsStructure(projectId);
      setApps(appsData);
      if (onRefreshWorkspace) onRefreshWorkspace();
    } catch (err) {
      toast.error(err.message || "Failed to create app");
    } finally {
      setCreatingApp(false);
    }
  };

  const handleDeleteApp = async (appName) => {
    const confirmed = await confirm({
      title: `Delete "${appName}"?`,
      message: "All files and data associated with this app will be permanently removed. This cannot be undone.",
      confirmText: "Delete App",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await deleteApp(projectId, appName);
      toast.success(`App '${appName}' deleted`);
      const appsData = await getAppsStructure(projectId);
      setApps(appsData);
      if (currentApp === appName) {
        setCurrentApp(null);
        setView('apps');
      }
      if (onRefreshWorkspace) onRefreshWorkspace();
    } catch (err) {
      toast.error(err.message || "Failed to delete app");
    }
  };

  const handleCreateSuperuser = async () => {
    const { username, email, password, password2 } = superuserData;
    if (!username.trim()) {
      toast.error("Username is required.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== password2) {
      toast.error("Passwords do not match.");
      return;
    }
    setCreatingSuperuser(true);
    try {
      await createSuperuser(projectId, username.trim(), email.trim(), password, password2);
      toast.success(`Superuser '${username.trim()}' created!`);
      setShowSuperuserModal(false);
      setSuperuserData({ username: "", email: "", password: "", password2: "" });
    } catch (err) {
      toast.error(err.message || "Failed to create superuser");
    } finally {
      setCreatingSuperuser(false);
    }
  };

  const handleEnableAuth = async () => {
    const confirmed = await confirm({
      title: "🔐 Enable Authentication",
      message:
        "This will generate a custom User model and JWT authentication endpoints.\n\n" +
        "⚠️ WARNING:\n" +
        "• Your current database (db.sqlite3) will be DELETED and recreated.\n" +
        "• ALL existing data will be LOST permanently.\n" +
        "• No backup will be created.\n\n" +
        "Only proceed if you are sure you want to reset your data.",
      confirmText: "Enable Auth & Reset Data",
      variant: "danger",
    });
    if (!confirmed) return;

    setEnablingAuth(true);
    try {
      await enableAuth(projectId);
      toast.success("Authentication enabled successfully!");
      const appsData = await getAppsStructure(projectId);
      setApps(appsData);
      if (onRefreshWorkspace) onRefreshWorkspace();
    } catch (err) {
      toast.error(err.message || "Failed to enable authentication");
    } finally {
      setEnablingAuth(false);
    }
  };

  // ─── Compute roles from blueprint ────────────────────────────────
  const roles = blueprint?.data?.roles || [];

  // ─── Get display name ─────────────────────────────────────────────
  const displayName = blueprint?.data?.project_name || parentProjectName || 'Unnamed';

  // ─── Breadcrumb items ────────────────────────────────────────────
  const getBreadcrumbItems = () => {
    const items = ['Project'];
    if (view === 'apps' || view === 'app-details' || view === 'designer') {
      items.push('Backend');
    }
    if (view === 'frontend' || view === 'frontend-setup' || view === 'frontend-builder') {
      items.push('Frontend');
    }
    if (view === 'app-details' || view === 'designer') {
      items.push(currentApp);
    }
    if (view === 'designer') {
      items.push(currentFeature);
    }
    return items;
  };

  // ─── Render ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-on-surface-variant bg-surface/30 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="w-4 h-4 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin"></span>
          <span className="font-body-md text-body-md">Loading builder…</span>
        </div>
      </div>
    );
  }

  if (!blueprint) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-surface/30 backdrop-blur-sm">
        <div className="text-center">
          <h2 className="font-display-sm text-display-sm text-primary mb-md">Visual Backend Builder</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
            Design your data models and generate a complete backend.
          </p>
          <button
            onClick={() => setShowStartModal(true)}
            className="flex items-center gap-2 bg-secondary text-on-secondary font-bold px-3xl py-md rounded-xl hover:shadow-[0_0_30px_rgba(78,223,145,0.3)] transition-all"
          >
            <span className="material-symbols-outlined text-base">rocket_launch</span>
            Start Project
          </button>
        </div>
        <StartProjectModal
          isOpen={showStartModal}
          onClose={() => setShowStartModal(false)}
          framework={startFramework}
          setFramework={setStartFramework}
          projectName={startProjectName}
          setProjectName={setStartProjectName}
          appName={startAppName}
          setAppName={setStartAppName}
          onSubmit={handleStartProject}
          loading={startingProject}
          isValidAppName={isValidAppName}
        />
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-surface/30 backdrop-blur-sm">
      {ConfirmDialog}

      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-on-surface-variant">
            {blueprint.framework} – {displayName}
          </span>
          <button
            onClick={handleRefreshApps}
            className="text-on-surface-variant hover:text-secondary transition-colors"
            title="Refresh apps"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {view !== 'home' && view !== 'designer' && view !== 'frontend' && view !== 'frontend-setup' && view !== 'frontend-builder' && (
            <>
              <button
                onClick={handleEnableAuth}
                disabled={enablingAuth}
                className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                  enablingAuth
                    ? "opacity-40 cursor-not-allowed bg-surface-container-high text-on-surface-variant"
                    : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                }`}
              >
                <span className="material-symbols-outlined text-sm">lock</span>
                {enablingAuth ? "Enabling…" : "Enable Auth"}
              </button>
              <button
                onClick={() => setShowSuperuserModal(true)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 transition-all font-medium"
              >
                <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                Create Superuser
              </button>
            </>
          )}
          {view !== 'designer' && (
            <button
              onClick={() => {
                let target = 'both';
                if (view === 'apps' || view === 'app-details') target = 'backend';
                else if (view === 'frontend' || view === 'frontend-setup' || view === 'frontend-builder') target = 'frontend';
                handleGenerate(target);
              }}
              disabled={generating}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                generating
                  ? "opacity-40 cursor-not-allowed bg-surface-container-high text-on-surface-variant"
                  : "bg-secondary text-on-secondary hover:shadow-[0_0_20px_rgba(78,223,145,0.3)]"
              }`}
            >
              <span className="material-symbols-outlined text-sm">rocket_launch</span>
              {generating
                ? "Generating…"
                : view === 'frontend' || view === 'frontend-setup' || view === 'frontend-builder'
                ? "Generate Frontend"
                : view === 'apps' || view === 'app-details'
                ? "Generate Backend"
                : "Generate"}
            </button>
          )}
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-error transition-colors"
            title="Close builder"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      </div>

      {/* ─── Breadcrumb ───────────────────────────────────────────── */}
      {view !== 'home' && (
        <Breadcrumb
          items={getBreadcrumbItems()}
          onNavigate={navigateBreadcrumb}
        />
      )}

      {/* ─── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {view === 'home' && (
          <BuilderHome
            onSelectBackend={selectBackend}
            onSelectFrontend={selectFrontend}
            frontendExists={frontendExists}
          />
        )}

        {view === 'apps' && (
          <AppList
            apps={apps}
            onSelectApp={selectApp}
            onNewApp={() => setShowNewAppModal(true)}
          />
        )}

        {view === 'app-details' && (
          <AppDetails
            appName={currentApp}
            onSelectFeature={selectFeature}
            onBack={() => setView('apps')}
            onDeleteApp={handleDeleteApp}
          />
        )}

        {view === 'designer' && currentFeature === 'models' && (
          <ModelDesigner
            appName={currentApp}
            models={designerModels}
            allModels={apps}
            onBack={() => setView('app-details')}
            onClose={onClose}
            onSave={saveBlueprint}
            saving={saving}
            onAddModel={addModel}
            onUpdateModel={updateModel}
            onDeleteModel={deleteModel}
            onAddField={addField}
            onUpdateField={updateField}
            onDeleteField={deleteField}
            onGenerate={() => handleGenerate('backend')}
            generating={generating}
            blueprintData={blueprint?.data}
            onUpdateBlueprintData={(newData) => {
              setBlueprint({
                ...blueprint,
                data: newData,
              });
            }}
          />
        )}

        {view === 'designer' && currentFeature === 'apis' && (
          <ApiDesigner
            appName={currentApp}
            models={designerModels}
            blueprintData={blueprint?.data}
            onUpdateBlueprint={(newData) => {
              setBlueprint({
                ...blueprint,
                data: newData,
              });
            }}
            onSave={saveBlueprint}
            onBack={() => setView('app-details')}
            onClose={onClose}
          />
        )}

        {view === 'designer' && currentFeature === 'admin' && (
          <AdminDesigner
            appName={currentApp}
            models={designerModels}
            blueprintData={blueprint?.data}
            onUpdateBlueprint={(newData) => {
              setBlueprint({
                ...blueprint,
                data: newData,
              });
            }}
            onSave={saveBlueprint}
            onBack={() => setView('app-details')}
            onClose={onClose}
          />
        )}

        {view === 'designer' && currentFeature === 'permissions' && (
          <PermissionsDesigner
            appName={currentApp}
            models={designerModels}
            roles={roles}
            blueprintData={blueprint?.data}
            onUpdateBlueprint={(newData) => {
              setBlueprint({
                ...blueprint,
                data: newData,
              });
            }}
            onSave={saveBlueprint}
            onBack={() => setView('app-details')}
            onClose={onClose}
          />
        )}

        {view === 'designer' && currentFeature === 'workflows' && (
          <WorkflowsDesigner
            appName={currentApp}
            onBack={() => setView('app-details')}
            onClose={onClose}
          />
        )}

        {view === 'designer' && currentFeature === 'ai-actions' && (
          <AiActionsDesigner
            appName={currentApp}
            onBack={() => setView('app-details')}
            onClose={onClose}
          />
        )}

        {view === 'frontend' && (
          <FrontendExplorer
            projectId={projectId}
            onBack={() => setView('home')}
            onClose={onClose}
            onRefresh={async () => {
              await checkFrontendExists();
            }}
          />
        )}

        {view === 'frontend-builder' && (
          <FrontendBuilder
            projectId={projectId}
            blueprint={blueprint}
            onUpdateBlueprint={(updated) => setBlueprint(updated)}
            onGenerate={handleGenerate}
            generating={generating}
            onBack={() => setView('home')}
            onClose={onClose}
          />
        )}

        {view === 'frontend-setup' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface/10">
            <h3 className="font-headline-lg text-headline-lg text-on-surface mb-4">Generate Frontend</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-6">
              Choose a frontend framework to generate for your project.
            </p>
            <div className="flex items-center gap-4">
              <select
                value={frontendStack}
                onChange={(e) => setFrontendStack(e.target.value)}
                className="bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
              >
                <option value="react">React</option>
                <option value="vue">Vue</option>
                <option value="nextjs">Next.js</option>
                <option value="svelte">Svelte</option>
              </select>
              <button
                onClick={() => handleGenerate('frontend')}
                disabled={generating}
                className="flex items-center gap-2 px-6 py-2 bg-secondary text-on-secondary rounded-xl font-semibold hover:shadow-[0_0_30px_rgba(78,223,145,0.3)] transition-all disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-sm">rocket_launch</span>
                {generating ? "Generating…" : "Generate Frontend"}
              </button>
              <button
                onClick={async () => {
                  const hasFrontend = await checkFrontendExists();
                  if (hasFrontend) {
                    setView('frontend-builder');
                  } else {
                    toast("No frontend files found. Generate one first.", { icon: 'ℹ️' });
                  }
                }}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-all font-medium"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                Refresh
              </button>
            </div>
            <button
              onClick={() => setView('home')}
              className="mt-6 text-sm text-on-surface-variant hover:text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* ─── Modals ────────────────────────────────────────────────── */}
      <NewAppModal
        isOpen={showNewAppModal}
        onClose={() => setShowNewAppModal(false)}
        appName={newAppName}
        setAppName={setNewAppName}
        onSubmit={handleCreateApp}
        loading={creatingApp}
        isValidAppName={isValidAppName}
      />

      <SuperuserModal
        isOpen={showSuperuserModal}
        onClose={() => setShowSuperuserModal(false)}
        data={superuserData}
        setData={setSuperuserData}
        onSubmit={handleCreateSuperuser}
        loading={creatingSuperuser}
      />
    </div>
  );
}