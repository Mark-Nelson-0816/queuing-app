import DashboardCard from "../components/DashboardCard";

const summaryData = [
  { id: 1, label: "Players Waiting", value: 12, icon: "", trend: 8, trendLabel: "vs yesterday", color: "primary" },
  { id: 2, label: "Active Courts", value: 4, icon: "", trend: 0, trendLabel: "vs yesterday", color: "success" },
  { id: 3, label: "Total Players Today", value: 48, icon: "", trend: 12, trendLabel: "vs yesterday", color: "warning" },
  { id: 4, label: "Completed Matches", value: 16, icon: "", trend: -5, trendLabel: "vs yesterday", color: "danger" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryData.map((card) => (
          <DashboardCard key={card.id} {...card} />
        ))}
      </div>

      {/* Quick Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6">
          <h3 className="text-lg font-bold text-[var(--text-h)] mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {[
              { action: "Match started on Court 3", time: "2 min ago", type: "start" },
              { action: "John joined the queue", time: "5 min ago", type: "join" },
              { action: "Match ended on Court 1", time: "8 min ago", type: "end" },
              { action: "Sarah & Mike assigned to Court 2", time: "12 min ago", type: "assign" },
            ].map((activity, idx) => (
              <div key={idx} className="flex items-center gap-3 pb-3 border-b border-[var(--border)] last:border-b-0 last:pb-0">
                <span className="w-2 h-2 rounded-full bg-[var(--primary)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-h)] truncate">{activity.action}</p>
                  <p className="text-xs text-[var(--text)]">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Court Status Overview */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6">
          <h3 className="text-lg font-bold text-[var(--text-h)] mb-4">Court Status</h3>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((num) => (
              <div key={num} className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-hover)]">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-[var(--text-h)]">Court {num}</span>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    num <= 2
                      ? "bg-[var(--primary-light)] text-[var(--primary)]"
                      : "bg-[var(--success-light)] text-[var(--success)]"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${num <= 2 ? "bg-[var(--primary)]" : "bg-[var(--success)]"}`} />
                  {num <= 2 ? "Playing" : "Available"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

