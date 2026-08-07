import { useEffect, useState } from "react";

// Displays the current page title, time, date, and optional actions.
export default function Header({ title, actions }) {
  const [now, setNow] = useState(new Date());

  // Keep the operator clock current while the application is open.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <header className="h-16 bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between px-6">

      {/* Current page title */}
      <div>
        <h1 className="text-xl font-bold text-[var(--text-h)]">
          {title}
        </h1>
      </div>

      {/* Clock, page actions, and operator badge */}
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-[var(--text-h)]">
            {timeStr}
          </p>
          <p className="text-xs text-[var(--text)]">
            {dateStr}
          </p>
        </div>

        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}

        <div className="w-9 h-9 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-sm font-bold">
          A
        </div>
      </div>
    </header>
  );
}
