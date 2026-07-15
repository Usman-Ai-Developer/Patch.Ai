// frontend/app/page.js

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Dashboard from "../components/Dashboard";
import NewChatScreen from "../components/NewChatScreen";
import LandingPage from "../components/LandingPage";
import { SkeletonDashboard } from "../components/Skeleton";
import { listProjects, createProject } from "../lib/api";
import { isAuthenticated } from "../lib/auth";
import toast from "react-hot-toast";

export default function Home() {
  return (
    <Suspense fallback={<SkeletonDashboard />}>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState(null);
  const [showNew, setShowNew] = useState(searchParams.get("new") === "1");
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const authenticated = isAuthenticated();
    setLoggedIn(authenticated);
    setAuthChecked(true);
    if (!authenticated) return;
    refresh();
  }, []);

  async function refresh() {
    try {
      const data = await listProjects();
      setProjects(data);
    } catch (e) {
      toast.error("Failed to load projects");
      setProjects([]);
    }
  }

  async function handleCreate({ name, message, zipFile, looseFiles }) {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await createProject({ name, message, zipFile, looseFiles });
      toast.success("Project created");
      router.push(`/project/${res.project.id}`);
    } catch (e) {
      setCreateError(e.message);
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  }

  if (!authChecked) {
    return <SkeletonDashboard />;
  }

  if (!loggedIn) {
    return <LandingPage />;
  }

  if (projects === null) {
    return <SkeletonDashboard />;
  }

  if (showNew || projects.length === 0) {
    return (
      <div>
        {projects.length > 0 && (
          <button
            onClick={() => setShowNew(false)}
            className="absolute top-6 left-6 text-xs text-subtext hover:text-text"
          >
            ← back
          </button>
        )}
        <NewChatScreen onCreate={handleCreate} error={createError} busy={creating} />
      </div>
    );
  }

  return (
    <Dashboard
      projects={projects}
      onOpen={(id) => router.push(`/project/${id}`)}
      onNew={() => setShowNew(true)}
      onProjectDeleted={(id) => {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        toast.success("Project deleted");
      }}
      loading={false}
    />
  );
}