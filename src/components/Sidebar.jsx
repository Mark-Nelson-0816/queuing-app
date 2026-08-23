import {
  Activity,
  LayoutGrid,
  ListOrdered,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Trophy,
  UsersRound,
} from "lucide-react";

const navItems = [
  { id: "players", label: "Players", icon: UsersRound },
  { id: "queue", label: "Rotation Queue", icon: ListOrdered },
  { id: "tournament", label: "Tournament", icon: Trophy },
  { id: "courts", label: "Courts", icon: LayoutGrid },
  { id: "public", label: "Public Display", icon: Monitor },
  { id: "settings", label: "Settings", icon: Settings },
];

// Displays collapsible application navigation.
export default function Sidebar({ activePage, onNavigate, collapsed, onToggle }) {
  return (
    <aside
      className={`relative z-20 flex h-screen shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-200 ${
        collapsed ? "w-[4.5rem]" : "w-60"
      }`}
    >
      {/* Application name and collapse control */}
      <div className={`flex h-16 shrink-0 items-center border-b border-[var(--border)] ${collapsed ? "justify-center px-2" : "px-4"}`}>
        {collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary-light)] text-[var(--primary)] transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
            title="Expand sidebar"
            aria-label="Expand sidebar"
            aria-expanded="false"
          >
            <PanelLeftOpen aria-hidden="true" className="h-5 w-5" />
          </button>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
                <Activity aria-hidden="true" className="h-5 w-5" />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-semibold text-[var(--text-h)]">Badminton Queue</p>
                <p className="truncate text-[11px] text-[var(--text)]">Management System</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-h)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              aria-expanded="true"
            >
              <PanelLeftClose aria-hidden="true" className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Main navigation links */}
      <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex h-11 w-full items-center rounded-lg border text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] ${
                collapsed ? "justify-center px-2" : "gap-3 px-3"
              } ${
                isActive
                  ? "border-[var(--primary)]/15 bg-[var(--primary-light)] font-semibold text-[var(--primary)]"
                  : "border-transparent font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-h)]"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Application version */}
      <div className={`shrink-0 border-t border-[var(--border)] ${collapsed ? "px-2 py-3 text-center" : "px-4 py-3"}`}>
        <p className="text-[11px] font-medium text-[var(--text)]" title="Badminton Queue v1.0.0">
          {collapsed ? "v1" : "Badminton Queue v1.0.0"}
        </p>
      </div>
    </aside>
  );
}

