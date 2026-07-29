export default function DashboardCard({ label, value, icon, trend, trendLabel, color = "primary" }) {
  const colorMap = {
    primary: {
      bg: "bg-[var(--primary-light)]",
      text: "text-[var(--primary)]",
      icon: "text-[var(--primary)]",
    },
    success: {
      bg: "bg-[var(--success-light)]",
      text: "text-[var(--success)]",
      icon: "text-[var(--success)]",
    },
    warning: {
      bg: "bg-[var(--warning-light)]",
      text: "text-[var(--warning)]",
      icon: "text-[var(--warning)]",
    },
    danger: {
      bg: "bg-[var(--danger-light)]",
      text: "text-[var(--danger)]",
      icon: "text-[var(--danger)]",
    },
  };

  const colors = colorMap[color] || colorMap.primary;
  const isUp = trend && trend > 0;
  const isDown = trend && trend < 0;

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 hover:shadow-[var(--shadow)] transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[var(--text)]">{label}</p>
          <p className="text-3xl font-bold text-[var(--text-h)]">{value}</p>
          {trend !== undefined && (
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`inline-flex items-center text-xs font-medium ${
                  isUp ? "text-[var(--success)]" : isDown ? "text-[var(--danger)]" : "text-[var(--text)]"
                }`}
              >
                {isUp ? "↑" : isDown ? "↓" : "→"} {Math.abs(trend)}%
              </span>
              {trendLabel && <span className="text-xs text-[var(--text)]">{trendLabel}</span>}
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
          <span className={`text-xl ${colors.icon}`}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

