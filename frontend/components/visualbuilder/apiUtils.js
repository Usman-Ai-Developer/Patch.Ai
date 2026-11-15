// frontend/components/visualbuilder/apiUtils.js
"use client";

// Mirrors backend/builder/helpers.py's pluralize(), which the generated
// project's urls.py writer (backend/builder/services/backend/django/writers/urls.py)
// uses to register each model's ViewSet. Keeping this in sync means the path
// shown/used here always matches what the generated backend actually serves.
export function pluralize(word) {
  if (!word) return word;
  const lower = word.toLowerCase();
  if (lower.endsWith("y") && lower.length > 1 && !"aeiou".includes(lower[lower.length - 2])) {
    return lower.slice(0, -1) + "ies";
  }
  if (/(s|x|z|ch|sh)$/.test(lower)) {
    return lower + "es";
  }
  return lower + "s";
}

// Same defaults as getDefaultApiSettings() in components/builder/ApiDesigner.js.
export function getModelApiSettings(model) {
  return {
    enabled: true,
    permissions: "IsAuthenticated",
    pagination: { type: "PageNumberPagination", page_size: 20 },
    filter_fields: [],
    search_fields: [],
    ordering_fields: "__all__",
    serializer_type: "simple",
    ...(model?.api || {}),
  };
}

export function isModelApiEnabled(model) {
  return getModelApiSettings(model).enabled !== false;
}

// Mounted at /api/<app_name>/ (see writers/sync.py), then routed by a DRF
// DefaultRouter registered with the pluralized, lowercased model name (see
// writers/urls.py): router.register(r'<plural>', <Model>ViewSet, ...).
export function getModelEndpoint(model) {
  if (!model?.app_name || !model?.name) return null;
  return `/api/${model.app_name}/${pluralize(model.name)}/`;
}

// Builds the absolute URL to hit that endpoint on a *running* preview server
// for this project (see backend/preview/views.py PreviewStatusView, which
// returns backend_port once the generated Django app is running).
export function buildLivePreviewUrl(backendPort, endpointPath) {
  if (!backendPort || !endpointPath) return null;
  return `http://localhost:${backendPort}${endpointPath}`;
}
