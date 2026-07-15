// frontend/lib/api.js

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "./auth";

/**
 * Parse response body as JSON if possible; otherwise return text.
 */
async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return await response.text();
    }
  }
  return await response.text();
}

async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { ...options.headers };

  // Only set Content-Type to JSON if body is NOT FormData
  const isFormData = options.body instanceof FormData;
  if (!isFormData && !options.headers?.["Content-Type"]) {
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

  // Handle 401 with token refresh
  if (response.status === 401 && token) {
    try {
      const refresh = getRefreshToken();
      if (refresh) {
        const refreshRes = await fetch(`${API_BASE}/api/token/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh }),
        });
        if (refreshRes.ok) {
          const { access } = await refreshRes.json();
          setTokens(access, refresh);
          headers.Authorization = `Bearer ${access}`;
          const retry = await fetch(url, {
            ...options,
            headers,
          });
          if (!retry.ok) {
            const errorBody = await parseResponse(retry);
            throw new Error(
              typeof errorBody === "string" ? errorBody : JSON.stringify(errorBody)
            );
          }
          return parseResponse(retry);
        } else {
          clearTokens();
          window.location.href = "/login";
          throw new Error("Session expired. Please log in again.");
        }
      }
    } catch (e) {
      clearTokens();
      window.location.href = "/login";
      throw e;
    }
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
    throw new Error(message);
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

export function createProject({ message, zipFile, looseFiles }) {
  const formData = new FormData();
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

export function downloadProject(id) {
  window.open(`${API_BASE}/api/projects/${id}/download/`);
}

// ----- Files -----
export function getFileTree(projectId) {
  return apiFetch(`/api/projects/${projectId}/files/`);
}

export function getFileContent(projectId, path) {
  return apiFetch(`/api/projects/${projectId}/file-content/?path=${encodeURIComponent(path)}`);
}

export function downloadFile(projectId, path) {
  window.open(
    `${API_BASE}/api/projects/${projectId}/files/download/?path=${encodeURIComponent(path)}`
  );
}

export function deleteFile(projectId, path) {
  return apiFetch(
    `/api/projects/${projectId}/files/delete/?path=${encodeURIComponent(path)}`,
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