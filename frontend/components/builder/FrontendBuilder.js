"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // <-- add this import
import toast from "react-hot-toast";
import { useConfirm } from "../../hooks/useConfirm";
import PagesDesigner from "./PagesDesigner";
import NavigationDesigner from "./NavigationDesigner";
import ThemeDesigner from "./ThemeDesigner";

export default function FrontendBuilder({
  projectId,
  blueprint,
  onUpdateBlueprint,
  onGenerate,
  generating,
  onBack,
  onClose,
}) {
  const router = useRouter(); // <-- instantiate
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState("pages");
  const [frontendData, setFrontendData] = useState({});

  useEffect(() => {
    if (blueprint?.data?.frontend) {
      setFrontendData(blueprint.data.frontend);
    } else {
      const models = blueprint?.data?.models || [];
      const defaultPages = models.map((m) => m.name);
      setFrontendData({
        enabled: true,
        framework: "react",
        pages: {
          enabled: defaultPages,
          custom: [],
          settings: {},
        },
        navigation: [
          { label: "Dashboard", path: "/" },
          ...defaultPages.map((name) => ({
            label: name,
            path: `/${name.toLowerCase()}`,
          })),
        ],
        theme: {
          primaryColor: "#3b82f6",
          secondaryColor: "#8b5cf6",
          darkMode: true,
        },
        layout: "sidebar",
      });
    }
  }, [blueprint]);

  const updateFrontendData = (newData) => {
    setFrontendData(newData);
    const updatedBlueprint = {
      ...blueprint,
      data: {
        ...blueprint.data,
        frontend: newData,
      },
    };
    onUpdateBlueprint(updatedBlueprint);
  };

  const handleGenerate = async () => {
    if (onGenerate) {
      await onGenerate("frontend");
    }
  };

  const tabs = [
    { id: "pages", label: "Pages", icon: "pages" },
    { id: "navigation", label: "Navigation", icon: "menu" },
    { id: "theme", label: "Theme", icon: "palette" },
  ];

  return (
    <div className="h-full flex flex-col bg-surface/30 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-all font-medium"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back
        </button>
        <span className="text-sm text-on-surface-variant font-medium">Frontend Builder</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              // ─── REPLACED window.open with router.push ──────────
              router.push(`/project/${projectId}/visual-builder`);
            }}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant hover:text-secondary hover:bg-surface-container-highest transition-all font-medium"
            title="Open the drag-and-drop Visual Builder"
          >
            <span className="material-symbols-outlined text-sm">dashboard_customize</span>
            Visual Builder
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-secondary text-on-secondary hover:shadow-[0_0_20px_rgba(78,223,145,0.3)] transition-all font-medium disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-sm">rocket_launch</span>
            {generating ? "Generating…" : "Generate Frontend"}
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

      <div className="flex border-b border-white/5 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all border-b-2 ${
              activeTab === tab.id
                ? "border-secondary text-secondary"
                : "border-transparent text-on-surface-variant hover:text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-surface/10">
        {activeTab === "pages" && (
          <PagesDesigner
            models={blueprint?.data?.models || []}
            frontendData={frontendData}
            onUpdate={updateFrontendData}
          />
        )}

        {activeTab === "navigation" && (
          <NavigationDesigner
            models={blueprint?.data?.models || []}
            frontendData={frontendData}
            onUpdate={updateFrontendData}
          />
        )}

        {activeTab === "theme" && (
          <ThemeDesigner
            frontendData={frontendData}
            onUpdate={updateFrontendData}
          />
        )}
      </div>
    </div>
  );
}