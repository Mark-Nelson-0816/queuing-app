const navItems = [
  // { id: "dashboard", label: "Dashboard", icon: "" },
  { id: "queue", label: "Queue", icon: "" },
  { id: "courts", label: "Courts", icon: "" },
  { id: "players", label: "Players", icon: "" },
  { id: "public", label: "Public Display", icon: "" },
  // { id: "settings", label: "Settings", icon: "" },
];

export default function Sidebar({ activePage, onNavigate, collapsed, onToggle }) {
  return (
    <aside
      className={`h-screen bg-[var(--surface)] border-r border-[var(--border)] flex flex-col transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo / Brand */}
      <div className="h-16 flex items-center px-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3 min-w-0">
          {!collapsed && (
            <span className="font-bold text-lg text-[var(--text-h)] whitespace-nowrap truncate">
              Badminton Queue
            </span>
          )}
        </div>
        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className="ml-auto p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text)] transition-colors flex-shrink-0"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-[var(--primary)] text-white shadow-md"
                  : "text-[var(--text)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-h)]"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-[var(--border)] p-4">
        {!collapsed && (
          <div className="text-xs text-[var(--text)]">
            <p className="font-medium text-[var(--text-h)]">Badminton Queue</p>
            <p>v1.0.0</p>
          </div>
        )}
      </div>
    </aside>
  );
}

