from ....helpers import pluralize

def _ts_type(field):
    """Map Django field type to TypeScript type."""
    field_type = field.get('type', 'CharField')
    options = field.get('options', {})
    is_null = options.get('null', False) or options.get('blank', False)

    mapping = {
        'CharField': 'string',
        'TextField': 'string',
        'EmailField': 'string',
        'URLField': 'string',
        'PasswordField': 'string',
        'IntegerField': 'number',
        'FloatField': 'number',
        'DecimalField': 'number',
        'BooleanField': 'boolean',
        'DateField': 'string',
        'DateTimeField': 'string',
        'ForeignKey': 'number',
        'ManyToManyField': 'number[]',
        'OneToOneField': 'number',
        'ImageField': 'string',
        'FileField': 'string',
        'JSONField': 'any',
    }
    ts_type = mapping.get(field_type, 'any')
    return ts_type + (' | null' if is_null else '')


def write_api_client(api_dir, models, app_name):
    imports = [
        'import axios from "axios";',
        'import type { AxiosRequestConfig } from "axios";',
        '',
        'const api = axios.create({',
        '  baseURL: "/api",',
        '  headers: { "Content-Type": "application/json" },',
        '});',
        '',
        '// Auth interceptor (adds token to every request)',
        'api.interceptors.request.use((config) => {',
        '  const token = localStorage.getItem("access_token");',
        '  if (token) config.headers.Authorization = `Bearer ${token}`;',
        '  return config;',
        '});',
        '',
        '// Response interceptor for token refresh',
        'api.interceptors.response.use(',
        '  (response) => response,',
        '  async (error) => {',
        '    const originalRequest = error.config;',
        '    if (error.response?.status === 401 && !originalRequest._retry) {',
        '      originalRequest._retry = true;',
        '      try {',
        '        const refreshToken = localStorage.getItem("refresh_token");',
        '        if (refreshToken) {',
        '          const response = await axios.post("/api/token/refresh/", { refresh: refreshToken });',
        '          const { access } = response.data;',
        '          localStorage.setItem("access_token", access);',
        '          originalRequest.headers.Authorization = `Bearer ${access}`;',
        '          return api(originalRequest);',
        '        }',
        '      } catch (refreshError) {',
        '        localStorage.removeItem("access_token");',
        '        localStorage.removeItem("refresh_token");',
        '        window.location.href = "/login";',
        '        return Promise.reject(refreshError);',
        '      }',
        '    }',
        '    if (error.response?.status === 401) {',
        '      localStorage.removeItem("access_token");',
        '      localStorage.removeItem("refresh_token");',
        '      window.location.href = "/login";',
        '    }',
        '    return Promise.reject(error);',
        '  }',
        ');',
        '',
        'export default api;',
        '',
    ]

    type_defs = []
    functions = []

    for model in models:
        name = model['name']
        name_lower = name.lower()
        plural = pluralize(name_lower)
        fields = model.get('fields', [])

        # Build TypeScript interface
        fields_ts = []
        for f in fields:
            fname = f['name']
            ftype = _ts_type(f)
            fields_ts.append(f'  {fname}{"?" if ftype.endswith(" | null") else ""}: {ftype};')

        type_defs.append(f'''export interface {name} {{
  id: number;
{chr(10).join(fields_ts)}
}}\n''')

        # API functions (pluralized path)
        functions.append(f'''
export const {name_lower}Api = {{
  list: (params?: Record<string, any>) => api.get<{name}[]>('/{app_name}/{plural}/', {{ params }}),
  create: (data: Partial<{name}>) => api.post<{name}>('/{app_name}/{plural}/', data),
  retrieve: (id: number) => api.get<{name}>(`/{app_name}/{plural}/${{id}}/`),
  update: (id: number, data: Partial<{name}>) => api.patch<{name}>(`/{app_name}/{plural}/${{id}}/`, data),
  delete: (id: number) => api.delete(`/{app_name}/{plural}/${{id}}/`),
}};
''')

    content = '\n'.join(imports + type_defs + functions)
    (api_dir / "client.ts").write_text(content, encoding='utf-8')