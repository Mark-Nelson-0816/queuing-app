import {
  Archive,
  Check,
  Database,
  Download,
  FileText,
  Info,
  LayoutGrid,
  ListOrdered,
  Monitor,
  Moon,
  Palette,
  Play,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  Sun,
  Trophy,
  Upload,
  UserCheck,
  Users,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  version as reactVersion,
} from "react";
import ConfirmDialog from "../components/ConfirmDialog";

const DEFAULT_SETTINGS = {
  theme: "light",
  defaultMatchType: "doubles",
  autoRequeue: "true",
  defaultTournamentMatchType: "doubles",
  defaultTournamentCategory: "no_gender",
};

const EMPTY_STATS = {
  registeredToday: null,
  totalProfiles: null,
  courts: null,
  activeQueueMatches: null,
  matchesPlaying: null,
  activeTournament: null,
};

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  if (theme === "system") {
    root.classList.add(
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light",
    );
    return;
  }
  root.classList.add(theme === "dark" ? "dark" : "light");
}

function Card({ title, description, icon: Icon, children, footer, className = "" }) {
  return (
    <section className={`flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] ${className}`}>
      <header className="flex items-start gap-3 border-b border-[var(--border)] px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-[var(--text-h)]">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-[var(--text)]">{description}</p>}
        </div>
      </header>
      <div className="flex-1 px-5 py-4">{children}</div>
      {footer && <footer className="border-t border-[var(--border)] bg-[var(--surface-hover)]/40 px-5 py-2.5 text-xs text-[var(--text)]">{footer}</footer>}
    </section>
  );
}

function Stat({ label, value, icon: Icon, tone = "primary" }) {
  const tones = {
    primary: "bg-[var(--primary-light)] text-[var(--primary)]",
    success: "bg-[var(--success-light)] text-[var(--success)]",
    warning: "bg-[var(--warning-light)] text-[var(--warning)]",
    danger: "bg-[var(--danger-light)] text-[var(--danger)]",
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow)]">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={18} /></span>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none text-[var(--text-h)]">{value ?? "—"}</p>
        <p className="mt-1 truncate text-xs text-[var(--text)]">{label}</p>
      </div>
    </div>
  );
}

function ThemeOption({ label, icon: Icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${active ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-hover)]"}`}
    >
      <Icon size={16} />
      <span>{label}</span>
      {active && <Check size={14} />}
    </button>
  );
}

function SegmentedControl({ label, hint, value, options, onChange }) {
  return (
    <div className="py-3">
      <p className="text-sm font-medium text-[var(--text-h)]">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--text)]">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-1 rounded-xl bg-[var(--surface-hover)] p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${value === option.value ? "bg-[var(--primary)] text-white shadow-sm" : "text-[var(--text)] hover:text-[var(--text-h)]"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text-h)]">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-[var(--text)]">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
      >
        <span className={`h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function ComingSoonRow({ label, hint, icon: Icon = Shield }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 opacity-60">
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 shrink-0 text-[var(--text)]" size={16} />
        <div>
          <p className="text-sm font-medium text-[var(--text-h)]">{label}</p>
          {hint && <p className="mt-0.5 text-xs text-[var(--text)]">{hint}</p>}
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-[var(--surface-hover)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text)]">Coming Soon</span>
    </div>
  );
}

function InfoItem({ label, value, wide = false }) {
  return (
    <div className={`rounded-xl bg-[var(--surface-hover)] px-3 py-2.5 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text)]">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-[var(--text-h)]">{value || "Unavailable"}</dd>
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [applicationInfo, setApplicationInfo] = useState(null);
  const [savedKey, setSavedKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const loadDashboard = useCallback(async () => {
    const applicationInfoRequest = typeof window.api.getApplicationInfo === "function"
      ? window.api.getApplicationInfo()
      : Promise.reject(new Error("Application metadata requires an app restart."));
    const results = await Promise.allSettled([
      window.api.getSettings(),
      window.api.getPlayerManagementData(),
      window.api.getCourts(),
      window.api.getRotationMatches(),
      window.api.getLatestTournament(),
      applicationInfoRequest,
    ]);
    const [settingsResult, playersResult, courtsResult, rotationResult, tournamentResult, infoResult] = results;

    if (settingsResult.status === "fulfilled") {
      setSettings({ ...DEFAULT_SETTINGS, ...settingsResult.value });
    }

    const playerSummary = playersResult.status === "fulfilled" && playersResult.value?.success
      ? playersResult.value.data.summary
      : null;
    const courts = courtsResult.status === "fulfilled" && Array.isArray(courtsResult.value)
      ? courtsResult.value
      : null;
    const rotationSummary = rotationResult.status === "fulfilled" && rotationResult.value?.success
      ? rotationResult.value.data.summary
      : null;
    const tournamentLoaded = tournamentResult.status === "fulfilled"
      && tournamentResult.value?.success;
    const tournament = tournamentLoaded
      ? tournamentResult.value.data?.tournament
      : null;

    setStats({
      registeredToday: playerSummary?.registeredToday ?? null,
      totalProfiles: playerSummary?.totalProfiles ?? null,
      courts: courts?.length ?? null,
      activeQueueMatches: rotationSummary
        ? rotationSummary.waiting + rotationSummary.incomplete + rotationSummary.playing
        : null,
      matchesPlaying: courts
        ? courts.filter((court) => court.status === "playing" && court.activeMatch).length
        : null,
      activeTournament: tournamentLoaded
        ? (tournament?.status === "ongoing" ? 1 : 0)
        : null,
    });

    if (infoResult.status === "fulfilled") setApplicationInfo(infoResult.value);
    const requiredFailed = settingsResult.status === "rejected"
      || playersResult.status === "rejected"
      || !playersResult.value?.success
      || courtsResult.status === "rejected"
      || !Array.isArray(courtsResult.value)
      || rotationResult.status === "rejected"
      || !rotationResult.value?.success;
    setError(requiredFailed ? "Some Settings information could not be loaded." : "");
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadDashboard, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadDashboard]);

  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== "system") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => applyTheme("system");
    media.addEventListener("change", handleSystemThemeChange);
    return () => media.removeEventListener("change", handleSystemThemeChange);
  }, [settings.theme]);

  async function handleSettingChange(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
    setError("");
    if (key === "theme") applyTheme(value);
    try {
      const result = await window.api.updateSetting(key, value);
      if (!result?.success) throw new Error("The preference could not be saved.");
      setSavedKey(key);
      window.setTimeout(() => setSavedKey(""), 1500);
    } catch (settingError) {
      setError(settingError instanceof Error ? settingError.message : "The preference could not be saved.");
    }
  }

  function handleTournamentMatchType(value) {
    handleSettingChange("defaultTournamentMatchType", value);
    if (value === "singles" && settings.defaultTournamentCategory === "mixed") {
      handleSettingChange("defaultTournamentCategory", "no_gender");
    }
  }

  async function handleReset() {
    if (isResetting) return;
    setIsResetting(true);
    setError("");
    try {
      const result = await window.api.resetAllData();
      if (!result?.success) throw new Error("Application data could not be reset.");
      setShowResetConfirm(false);
      setMessage("Application data was reset successfully.");
      await loadDashboard();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Application data could not be reset.");
    } finally {
      setIsResetting(false);
    }
  }

  const savedMessage = savedKey ? "Saved automatically ✓" : "Changes are saved automatically.";
  const appInfo = applicationInfo || {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-h)]">Application Settings</h1>
          <p className="mt-1 text-sm text-[var(--text)]">Preferences, operational defaults, application information, and data management.</p>
        </div>
        <span className="flex items-center gap-2 rounded-xl bg-[var(--primary-light)] px-3 py-2 text-sm font-semibold text-[var(--primary)]"><SlidersHorizontal size={16} /> Desktop Configuration</span>
      </div>

      {error && <div role="alert" className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-light)] px-4 py-3 text-sm text-[var(--danger)]">{error}</div>}
      {message && <div className="flex items-center gap-2 rounded-xl border border-[var(--success)]/30 bg-[var(--success-light)] px-4 py-3 text-sm text-[var(--success)]"><Check size={16} />{message}</div>}

      <section aria-label="Application overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Registered Players Today" value={stats.registeredToday} icon={UserCheck} />
        <Stat label="Total Player Profiles" value={stats.totalProfiles} icon={Users} tone="success" />
        <Stat label="Courts" value={stats.courts} icon={LayoutGrid} tone="warning" />
        <Stat label="Active Queue Matches" value={stats.activeQueueMatches} icon={ListOrdered} tone="warning" />
        <Stat label="Matches Playing" value={stats.matchesPlaying} icon={Play} tone="danger" />
        <Stat label="Active Tournament" value={stats.activeTournament} icon={Trophy} />
      </section>

      <div className="grid items-stretch gap-5 xl:grid-cols-2">
        <Card title="Application" description="Choose how the desktop application looks." icon={Palette} footer={savedKey === "theme" ? "Theme saved ✓" : savedMessage}>
          <div className="flex gap-2">
            <ThemeOption label="Light" icon={Sun} active={settings.theme === "light"} onClick={() => handleSettingChange("theme", "light")} />
            <ThemeOption label="Dark" icon={Moon} active={settings.theme === "dark"} onClick={() => handleSettingChange("theme", "dark")} />
            <ThemeOption label="System" icon={Monitor} active={settings.theme === "system"} onClick={() => handleSettingChange("theme", "system")} />
          </div>
        </Card>

        <Card title="Queue Preferences" description="Defaults used by Rotation Queue operations." icon={ListOrdered} footer={savedMessage}>
          <div className="divide-y divide-[var(--border)]">
            <SegmentedControl label="Default Match Type" hint="Used when Rotation Queue has no saved session draft." value={settings.defaultMatchType} options={[{ value: "singles", label: "Singles" }, { value: "doubles", label: "Doubles" }]} onChange={(value) => handleSettingChange("defaultMatchType", value)} />
            <Toggle checked={settings.autoRequeue !== "false"} onChange={(value) => handleSettingChange("autoRequeue", String(value))} label="Auto Requeue Players" hint="Return players to availability after a completed Rotation match." />
            <ComingSoonRow label="Confirm Before Ending Match" hint="Confirmation is currently always shown." />
            <ComingSoonRow label="Confirm Before Removing Player" hint="Player removal confirmation is currently always shown." />
          </div>
        </Card>

        <Card title="Round Robin Defaults" description="Starting options for newly created tournaments." icon={Trophy} footer={savedMessage}>
          <div className="divide-y divide-[var(--border)]">
            <SegmentedControl label="Default Match Type" value={settings.defaultTournamentMatchType} options={[{ value: "singles", label: "Singles" }, { value: "doubles", label: "Doubles" }]} onChange={handleTournamentMatchType} />
            <SegmentedControl label="Default Category" value={settings.defaultTournamentCategory} options={[{ value: "mens", label: "Men's" }, { value: "womens", label: "Women's" }, { value: "mixed", label: "Mixed", disabled: settings.defaultTournamentMatchType === "singles" }, { value: "no_gender", label: "No Gender" }]} onChange={(value) => handleSettingChange("defaultTournamentCategory", value)} />
            <div className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium text-[var(--text-h)]">Shuffle Players Before Team Creation</p><p className="mt-0.5 text-xs text-[var(--text)]">Built into the current tournament team generator.</p></div><span className="rounded-full bg-[var(--success-light)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--success)]">Always On</span></div>
            <ComingSoonRow label="Auto Generate Teams" hint="Tournament generation still requires an operator action." />
          </div>
        </Card>

        <Card title="Player Management" description="Session cleanup and history utilities." icon={Users}>
          <div className="divide-y divide-[var(--border)]">
            <ComingSoonRow label="Clear Today's Registered Players" hint="Players and statistics are unchanged." icon={UserCheck} />
            <ComingSoonRow label="Reset Today's Queue" hint="No queue records are changed from this page." icon={RotateCcw} />
            <ComingSoonRow label="Archive Finished Matches" hint="Finished match history remains available." icon={Archive} />
          </div>
        </Card>

        <Card title="Database Management" description="Backup, restore, export, or reset local data." icon={Database}>
          <div className="divide-y divide-[var(--border)]">
            <ComingSoonRow label="Backup Database" icon={Download} />
            <ComingSoonRow label="Restore Database" icon={Upload} />
            <ComingSoonRow label="Export Player Profiles" icon={FileText} />
            <div className="flex items-center justify-between gap-4 py-3">
              <div><p className="text-sm font-medium text-[var(--text-h)]">Reset Application Data</p><p className="mt-0.5 text-xs text-[var(--text)]">Deletes players, matches, tournaments, queue data, and courts before restoring the default courts.</p></div>
              <button type="button" onClick={() => setShowResetConfirm(true)} className="shrink-0 rounded-xl bg-[var(--danger)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"><RotateCcw className="mr-1 inline h-3.5 w-3.5" /> Reset Data</button>
            </div>
          </div>
        </Card>

        <Card title="About" description="Application, runtime, and local database information." icon={Info}>
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-lg font-bold text-white">BQ</span>
            <div><p className="font-semibold text-[var(--text-h)]">{appInfo.applicationName || "Badminton Queue"}</p><p className="text-xs text-[var(--text)]">Queue, court, player, and tournament management.</p></div>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2">
            <InfoItem label="Version" value={appInfo.version} />
            <InfoItem label="Electron" value={appInfo.electronVersion} />
            <InfoItem label="React" value={reactVersion} />
            <InfoItem label="SQLite Engine" value={appInfo.sqliteVersion ? `SQLite ${appInfo.sqliteVersion}` : ""} />
            <InfoItem label="Schema Version" value={appInfo.schemaVersion === 0 ? "Unversioned (0)" : String(appInfo.schemaVersion || "")} />
            <InfoItem label="Platform" value={appInfo.platform} />
            <InfoItem label="Developer" value={appInfo.developer} />
            <InfoItem label="Database Location" value={appInfo.databaseLocation} wide />
          </dl>
        </Card>
      </div>

      <ConfirmDialog open={showResetConfirm} title="Reset Application Data" message="Delete all application data and restore the default courts? This action cannot be undone." confirmLabel={isResetting ? "Resetting..." : "Delete Everything"} variant="danger" confirmDisabled={isResetting} onConfirm={handleReset} onCancel={() => !isResetting && setShowResetConfirm(false)} />
    </div>
  );
}
