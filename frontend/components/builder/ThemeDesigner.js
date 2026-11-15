"use client";

export default function ThemeDesigner({ frontendData, onUpdate }) {
  const theme = frontendData.theme || {
    primaryColor: "#3b82f6",
    secondaryColor: "#8b5cf6",
    darkMode: true,
  };

  const updateTheme = (key, value) => {
    onUpdate({
      ...frontendData,
      theme: {
        ...theme,
        [key]: value,
      },
    });
  };

  return (
    <div>
      <h3 className="font-headline-lg text-headline-lg text-on-surface mb-4">
        Theme &amp; Styling
      </h3>
      <p className="font-body-md text-body-md text-on-surface-variant mb-6">
        Customize the look and feel of your frontend.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
        <div>
          <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1.5">
            Primary Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={theme.primaryColor}
              onChange={(e) => updateTheme("primaryColor", e.target.value)}
              className="w-12 h-12 rounded-lg border border-outline-variant cursor-pointer"
            />
            <input
              type="text"
              value={theme.primaryColor}
              onChange={(e) => updateTheme("primaryColor", e.target.value)}
              className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1.5">
            Secondary Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={theme.secondaryColor}
              onChange={(e) => updateTheme("secondaryColor", e.target.value)}
              className="w-12 h-12 rounded-lg border border-outline-variant cursor-pointer"
            />
            <input
              type="text"
              value={theme.secondaryColor}
              onChange={(e) => updateTheme("secondaryColor", e.target.value)}
              className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1.5">
            Dark Mode
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => updateTheme("darkMode", !theme.darkMode)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                theme.darkMode
                  ? "bg-secondary text-on-secondary"
                  : "bg-surface-container-high text-on-surface-variant hover:text-primary"
              }`}
            >
              {theme.darkMode ? "Dark (Enabled)" : "Dark (Disabled)"}
            </button>
            <span className="text-xs text-on-surface-variant/60">
              {theme.darkMode ? "Dark theme active" : "Light theme active"}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1.5">
            Layout
          </label>
          <select
            value={frontendData.layout || "sidebar"}
            onChange={(e) =>
              onUpdate({
                ...frontendData,
                layout: e.target.value,
              })
            }
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
          >
            <option value="sidebar">Sidebar</option>
            <option value="topnav">Top Navigation</option>
            <option value="fullwidth">Full Width</option>
          </select>
        </div>
      </div>
    </div>
  );
}