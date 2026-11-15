export default function Breadcrumb({ items, onNavigate }) {
  return (
    <div className="flex items-center gap-1 text-xs px-4 py-1.5 border-b border-white/5 bg-surface/10">
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && (
            <span className="text-on-surface-variant/40 material-symbols-outlined text-sm">
              chevron_right
            </span>
          )}
          {index < items.length - 1 ? (
            <button
              onClick={() => onNavigate(index)}
              className="text-on-surface-variant hover:text-secondary transition-colors cursor-pointer font-medium"
            >
              {item}
            </button>
          ) : (
            <span className="text-on-surface font-semibold">{item}</span>
          )}
        </span>
      ))}
    </div>
  );
}