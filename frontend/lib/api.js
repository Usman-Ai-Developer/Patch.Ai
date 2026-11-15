const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "./auth";

/**
 * Parse response body as JSON if possible; otherwise return text.
 */
async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  // Read the body exactly once. The old code called response.json() and then
  // response.text() on failure, which throws because the body is consumed.
  const text = await response.text();
  if (!contentType.includes("application/json")) return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Single-flight refresh. The backend rotates AND blacklists refresh tokens
// (ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION), so two requests that
// hit a 401 at the same time used to each fire their own refresh: the loser
// was blacklisted, got logged out, and was redirected mid-session.
let refreshPromise = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refresh = getRefreshToken();
      if (!refresh) return false;
      try {
        const response = await fetch(`${API_BASE}/api/token/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh }),
        });
        if (!response.ok) return false;
        const data = await response.json();
        if (!data.access) return false;
        // Persist the rotated refresh token, otherwise every refresh after
        // the first fails.
        setTokens(data.access, data.refresh || refresh);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

/**
 * Download a file that requires auth.
 */
async function downloadBlob(endpoint, fallbackFilename) {
  const url = `${API_BASE}${endpoint}`;
  const token = getAccessToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let response = await fetch(url, { headers });

  // Downloads used to skip the refresh path entirely, so any file download
  // failed outright once the 30-minute access token expired.
  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.Authorization = `Bearer ${getAccessToken()}`;
      response = await fetch(url, { headers });
    }
  }

  if (!response.ok) {
    const errorBody = await parseResponse(response);
    const message =
      typeof errorBody === "string"
        ? errorBody
        : errorBody?.detail || errorBody?.error || response.statusText || `HTTP ${response.status}`;
    throw buildError(message, response.status);
  }

  let filename = fallbackFilename;
  const disposition = response.headers.get("content-disposition");
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";\n]+)"?/i);
    if (match?.[1]) filename = decodeURIComponent(match[1]);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { ...options.headers };

  const isFormData = options.body instanceof FormData;
  if (!isFormData && (!options.headers || !options.headers["Content-Type"])) {
    headers["Content-Type"] = "application/json";
  }

  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 with the shared single-flight refresh (see refreshAccessToken).
  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      clearTokens();
      if (typeof window !== "undefined") window.location.href = "/login";
      throw buildError("Session expired. Please log in again.", 401);
    }
    headers.Authorization = `Bearer ${getAccessToken()}`;
    const retry = await fetch(url, {
      ...options,
      headers,
    });
    if (!retry.ok) {
      const errorBody = await parseResponse(retry);
      const message =
        typeof errorBody === "string"
          ? errorBody
          : errorBody?.detail || errorBody?.error || retry.statusText || `HTTP ${retry.status}`;
      throw buildError(message, retry.status);
    }
    return parseResponse(retry);
  }

  if (!response.ok) {
    const errorBody = await parseResponse(response);
    let message;
    if (typeof errorBody === "string") {
      message = errorBody;
    } else if (errorBody.detail) {
      message = errorBody.detail;
    } else if (errorBody.error) {
      message = errorBody.error;
    } else {
      message = response.statusText || `HTTP ${response.status}`;
    }
    throw buildError(message, response.status);
  }

  return parseResponse(response);
}

// ----- Authentication -----
export function login(username, password) {
  return apiFetch("/api/token/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function signup(username, email, password, password2) {
  return apiFetch("/api/signup/", {
    method: "POST",
    body: JSON.stringify({ username, email, password, password2 }),
  });
}

// ----- Projects -----
export function listProjects() {
  return apiFetch("/api/projects/");
}

export function getProject(id) {
  return apiFetch(`/api/projects/${id}/`);
}

export function createProject({ name, message, zipFile, looseFiles }) {
  const formData = new FormData();
  if (name) formData.append("name", name);
  if (message) formData.append("message", message);
  if (zipFile) formData.append("zip", zipFile);
  looseFiles?.forEach((f) => formData.append("files", f));

  return apiFetch("/api/projects/create/", {
    method: "POST",
    body: formData,
  });
}

export function updateProject(id, name) {
  return apiFetch(`/api/projects/${id}/`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export function deleteProject(id) {
  return apiFetch(`/api/projects/${id}/`, {
    method: "DELETE",
  });
}

export function downloadProject(id, projectName) {
  const safeName = (projectName || `project-${id}`).replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || `project-${id}`;
  return downloadBlob(`/api/projects/${id}/download/`, `${safeName}.zip`);
}

// ----- Files -----
export function getFileTree(projectId) {
  return apiFetch(`/api/projects/${projectId}/files/`);
}

export function getFileContent(projectId, path) {
  return apiFetch(`/api/projects/${projectId}/file-content/?path=${encodeURIComponent(path)}`);
}

export function updateFileContent(projectId, path, content) {
  return apiFetch(
    `/api/projects/${projectId}/file-content/update/?path=${encodeURIComponent(path)}`,
    {
      method: "PUT",
      body: JSON.stringify({ content }),
    }
  );
}

export function downloadFile(projectId, path) {
  const filename = path.split("/").pop() || "download";
  return downloadBlob(
    `/api/projects/${projectId}/files/download/?path=${encodeURIComponent(path)}`,
    filename
  );
}

export function deleteFile(projectId, path) {
  return apiFetch(
    `/api/projects/${projectId}/files/delete/?path=${encodeURIComponent(path)}`,
    { method: "DELETE" }
  );
}

export function deleteDirectory(projectId, path) {
  return apiFetch(
    `/api/projects/${projectId}/directories/delete/?path=${encodeURIComponent(path)}`,
    { method: "DELETE" }
  );
}

export function syncProject(projectId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch(`/api/projects/${projectId}/sync/`, {
    method: "POST",
    body: formData,
  });
}

export function refreshFileTree(projectId) {
  return apiFetch(`/api/projects/${projectId}/sync-files/`, {
    method: "POST",
  });
}

// ----- Apply / Reject Operations -----
export function applyOperations(projectId, messageId) {
  return apiFetch(`/api/projects/${projectId}/apply/`, {
    method: "POST",
    body: JSON.stringify({ message_id: messageId }),
  });
}

export function rejectOperations(projectId, messageId) {
  return apiFetch(`/api/projects/${projectId}/reject/`, {
    method: "POST",
    body: JSON.stringify({ message_id: messageId }),
  });
}

// ----- Preview -----
export function startPreview(projectId) {
  return apiFetch(`/api/projects/${projectId}/preview/`);
}

export function getPreviewStatus(projectId) {
  return apiFetch(`/api/projects/${projectId}/preview/status/`);
}

export function stopPreview(projectId) {
  return apiFetch(`/api/projects/${projectId}/preview/stop/`, {
    method: "DELETE",
  });
}

// ----- Chat -----
export function getChatHistory(projectId) {
  return apiFetch(`/api/projects/${projectId}/chat/history/`);
}

export function sendChatMessage(projectId, message) {
  return apiFetch(`/api/projects/${projectId}/chat/`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// ----- Builder -----
export function startProject(projectId, framework, projectName, appName) {
  return apiFetch(`/api/projects/${projectId}/builder/start/`, {
    method: 'POST',
    body: JSON.stringify({ framework, project_name: projectName, app_name: appName }),
  });
}

export function getBlueprint(projectId) {
  return apiFetch(`/api/projects/${projectId}/builder/blueprint/`);
}

export function updateBlueprint(projectId, data) {
  return apiFetch(`/api/projects/${projectId}/builder/blueprint/`, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  });
}

export function generateProject(projectId, target = 'both') {
  return apiFetch(`/api/projects/${projectId}/builder/generate/?target=${target}`, {
    method: 'POST',
  });
}

export function getAppsStructure(projectId) {
  return apiFetch(`/api/projects/${projectId}/builder/apps/`);
}

export function createApp(projectId, appName) {
  return apiFetch(`/api/projects/${projectId}/builder/create-app/`, {
    method: 'POST',
    body: JSON.stringify({ app_name: appName }),
  });
}

export function deleteApp(projectId, appName) {
  return apiFetch(`/api/projects/${projectId}/builder/delete-app/`, {
    method: 'DELETE',
    body: JSON.stringify({ app_name: appName }),
  });
}

export function createSuperuser(projectId, username, email, password, password2) {
  return apiFetch(`/api/projects/${projectId}/builder/create-superuser/`, {
    method: 'POST',
    body: JSON.stringify({ username, email, password, password2 }),
  });
}

export function enableAuth(projectId) {
  return apiFetch(`/api/projects/${projectId}/builder/enable-auth/`, {
    method: 'POST',
  });
}

export function resetDatabase(projectId) {
  return apiFetch(`/api/projects/${projectId}/builder/reset-database/`, {
    method: 'POST',
  });
}

export function renderPageCode(projectId, tree, componentName, asComponent = false) {
  return apiFetch(`/api/projects/${projectId}/builder/render-code/`, {
    method: "POST",
    body: JSON.stringify({ tree, component_name: componentName, as_component: asComponent }),
  });
}