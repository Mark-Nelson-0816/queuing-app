import { useEffect, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  Users,
  LayoutGrid,
  ListOrdered,
  Trophy,
  Sun,
  Moon,
  Monitor,
  Palette,
  SlidersHorizontal,
  Database,
  Info,
  Check,
  RotateCcw,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Small presentational building blocks                               */
/* ------------------------------------------------------------------ */

function Card({ title, description, icon: Icon, children, footer }) {
  return (
    <section className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
      <header className="px-6 py-4 border-b border-[var(--border)] flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-[var(--text-h)] leading-tight">{title}</h3>
          {description && (
            <p className="text-sm text-[var(--text)] mt-0.5">{description}</p>
          )}
        </div>
      </header>
      <div className="px-6 py-5">{children}</div>
      {footer && (
        <footer className="px-6 py-3 border-t border-[var(--border)] bg-[var(--surface-hover)]/40 text-xs text-[var(--text)]">
          {footer}
        </footer>
      )}
    </section>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text-h)]">{label}</p>
        {hint && <p className="text-xs text-[var(--text)] mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
          checked ? "bg-[var(--primary)]" : "bg-[var(--border)]"
        }`}
      >
        <span
          className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function ThemeOption({ label, icon: Icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex-1 flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all ${
        active
          ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
          : "border-[var(--border)] text-[var(--text)] hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
      }`}
    >
      {active && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--primary)] text-white flex items-center justify-center">
          <Check size={12} strokeWidth={3} />
        </span>
      )}
      <Icon size={22} />
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

function Stat({ label, value, icon: Icon, color }) {
  const colorMap = {
    primary: "bg-[var(--primary-light)] text-[var(--primary)]",
    success: "bg-[var(--success-light)] text-[var(--success)]",
    warning: "bg-[var(--warning-light)] text-[var(--warning)]",
    danger: "bg-[var(--danger-light)] text-[var(--danger)]",
  };
  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 flex items-center gap-4 hover:shadow-[var(--shadow)] transition-shadow duration-200">
      <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${colorMap[color]}`}>
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-[var(--text-h)] leading-none">{value}</p>
        <p className="text-sm text-[var(--text)] mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Settings page                                                 */
/* ------------------------------------------------------------------ */

const DEFAULT_SETTINGS = {
  theme: "light",
  defaultMatchType: "singles",
  autoRequeue: "true",
};

export default function Settings() {
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [stats, setStats] = useState({ players: 0, courts: 0, queue: 0, matches: 0 });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [savedKey, setSavedKey] = useState("");
  const [version] = useState("1.0.0");

  // Load persisted settings + live overview stats on mount
  useEffect(() => {
    loadSettings();
    loadStats();
  }, []);

  // Keep <html> theme class in sync with the chosen mode
  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  async function loadSettings() {
    try {
      const data = await window.api.getSettings();
      setSettings({
        ...DEFAULT_SETTINGS,
        ...data,
        autoRequeue: data.autoRequeue ?? "true",
      });
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }

  async function loadStats() {
    try {
      const [players, courts, queue, rrMatches] = await Promise.all([
        window.api.getPlayers(),
        window.api.getCourts(),
        window.api.getQueue(),
        window.api.getRRMatches(),
      ]);
      setStats({
        players: players.length,
        courts: courts.length,
        queue: queue.length,
        matches: rrMatches.length,
      });
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(prefersDark ? "dark" : "light");
    } else {
      root.classList.add(theme === "dark" ? "dark" : "light");
    }
  }

  async function handleSettingChange(key, value) {
    const next = { ...settings, [key]: value };
    setSettings(next);

    // System theme resolves immediately so the UI reflects the choice
    if (key === "theme") applyTheme(value);

    try {
      await window.api.updateSetting(key, value);
      setSavedKey(key);
      setTimeout(() => setSavedKey(""), 1500);
    } catch (err) {
      console.error("Failed to save setting:", err);
    }
  }

  async function handleReset() {
    await window.api.resetAllData();
    setShowResetConfirm(false);
    setResetDone(true);
    await loadStats();
    setTimeout(() => setResetDone(false), 3000);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page intro */}
      <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] rounded-2xl p-6 text-white flex items-center justify-between gap-4">
        <div>
          <h2 className="text-white/80 text-xl font-bold leading-tight">Settings</h2>
          <p className="text-white/80 text-sm mt-1">
            Configure appearance, preferences, and manage application data.
          </p>
        </div>
        <span className="hidden sm:flex w-14 h-14 rounded-2xl bg-white/15 items-center justify-center">
          <SlidersHorizontal size={26} />
        </span>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Registered Players" value={stats.players} icon={Users} color="primary" />
        <Stat label="Courts" value={stats.courts} icon={LayoutGrid} color="success" />
        <Stat label="In Queue" value={stats.queue} icon={ListOrdered} color="warning" />
        <Stat label="Round Robin Matches" value={stats.matches} icon={Trophy} color="danger" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appearance */}
        <Card
          title="Appearance"
          description="Choose how the app looks."
          icon={Palette}
          footer={savedKey === "theme" ? "Theme saved ✓" : "Theme preference is saved automatically."}
        >
          <div className="flex gap-3">
            <ThemeOption
              label="Light"
              icon={Sun}
              active={settings.theme === "light"}
              onClick={() => handleSettingChange("theme", "light")}
            />
            <ThemeOption
              label="Dark"
              icon={Moon}
              active={settings.theme === "dark"}
              onClick={() => handleSettingChange("theme", "dark")}
            />
            <ThemeOption
              label="System"
              icon={Monitor}
              active={settings.theme === "system"}
              onClick={() => handleSettingChange("theme", "system")}
            />
          </div>
        </Card>

        {/* Preferences */}
        <Card
          title="Preferences"
          description="Defaults used across the app."
          icon={SlidersHorizontal}
          footer={
            savedKey === "defaultMatchType" || savedKey === "autoRequeue"
              ? "Preferences saved ✓"
              : "Changes are saved automatically."
          }
        >
          <div className="divide-y divide-[var(--border)]">
            <div className="py-3">
              <p className="text-sm font-medium text-[var(--text-h)]">Default Match Type</p>
              <p className="text-xs text-[var(--text)] mt-0.5 mb-2">
                Preselected when starting a match from the queue.
              </p>
              <div className="flex items-center gap-1 bg-[var(--surface-hover)] rounded-xl p-1 w-fit">
                {["singles", "doubles"].map((type) => (
                  <button
                    key={type}
                    onClick={() => handleSettingChange("defaultMatchType", type)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                      settings.defaultMatchType === type
                        ? "bg-[var(--primary)] text-white shadow-sm"
                        : "text-[var(--text)] hover:text-[var(--text-h)]"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <Toggle
              checked={settings.autoRequeue === "true"}
              onChange={(val) => handleSettingChange("autoRequeue", String(val))}
              label="Auto-requeue players"
              hint="Automatically add players back to the queue after a match ends."
            />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Data management */}
        <Card
          title="Data Management"
          description="Clear or reset application data."
          icon={Database}
        >
          <div className="rounded-xl border border-[var(--danger-light)] bg-[var(--danger-light)]/40 p-4">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-lg bg-[var(--danger-light)] text-[var(--danger)] flex items-center justify-center shrink-0">
                <RotateCcw size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-h)]">Reset all data</p>
                <p className="text-xs text-[var(--text)] mt-0.5">
                  Deletes every player, court, queue entry and match — then restores
                  the default courts. This cannot be undone.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="mt-4 w-full py-2.5 rounded-xl bg-[var(--danger)] text-white text-sm font-semibold hover:bg-red-600 transition-colors"
            >
              Reset All Data
            </button>
          </div>

          {resetDone && (
            <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--success-light)] text-[var(--success)] text-sm font-medium">
              <Check size={16} />
              All data has been reset successfully.
            </div>
          )}
        </Card>

        {/* About */}
        <Card
          title="About"
          description="Application information."
          icon={Info}
          footer="Badminton Queue • v1.0.0"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="w-14 h-14 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center text-2xl font-bold shrink-0">
                BQ
              </span>
              <div>
                <p className="text-base font-bold text-[var(--text-h)]">Badminton Queue</p>
                <p className="text-sm text-[var(--text)]">
                  Queue, court &amp; round-robin management.
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--surface-hover)] rounded-xl px-4 py-3">
                <dt className="text-xs font-medium text-[var(--text)] uppercase tracking-wider">Version</dt>
                <dd className="text-sm font-semibold text-[var(--text-h)] mt-0.5">{version}</dd>
              </div>
              <div className="bg-[var(--surface-hover)] rounded-xl px-4 py-3">
                <dt className="text-xs font-medium text-[var(--text)] uppercase tracking-wider">Platform</dt>
                <dd className="text-sm font-semibold text-[var(--text-h)] mt-0.5 capitalize">
                  {navigator.platform || "Desktop"}
                </dd>
              </div>
              <div className="bg-[var(--surface-hover)] rounded-xl px-4 py-3">
                <dt className="text-xs font-medium text-[var(--text)] uppercase tracking-wider">Stack</dt>
                <dd className="text-sm font-semibold text-[var(--text-h)] mt-0.5">
                  Electron + React + SQLite
                </dd>
              </div>
              <div className="bg-[var(--surface-hover)] rounded-xl px-4 py-3">
                <dt className="text-xs font-medium text-[var(--text)] uppercase tracking-wider">DB Engine</dt>
                <dd className="text-sm font-semibold text-[var(--text-h)] mt-0.5">better-sqlite3</dd>
              </div>
            </dl>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={showResetConfirm}
        title="Reset All Data"
        message="Delete all data? This action cannot be undone."
        confirmLabel="Delete Everything"
        variant="danger"
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}

