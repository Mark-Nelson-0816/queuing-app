import {
  Check,
  Database,
  Download,
  Info,
  LayoutGrid,
  ListOrdered,
  Monitor,
  Moon,
  Palette,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
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

// Applies the selected light, dark, or system theme immediately.
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

// Displays one grouped Settings section.
function Card({ title, description, icon: Icon, children, footer, className = "" }) {
  return (
    <section className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] ${className}`}>
      <header className="flex min-w-0 items-start gap-3 border-b border-[var(--border)] px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-[var(--text-h)]">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-[var(--text)]">{description}</p>}
        </div>
      </header>
      <div className="min-w-0 px-5 py-4">{children}</div>
      {footer && <footer className="break-words border-t border-[var(--border)] bg-[var(--surface-hover)]/40 px-5 py-2.5 text-xs text-[var(--text)]">{footer}</footer>}
    </section>
  );
}

// Displays one live application statistic.
function Stat({ label, value, icon: Icon, tone = "primary" }) {
  const tones = {
    primary: "bg-[var(--primary-light)] text-[var(--primary)]",
    success: "bg-[var(--success-light)] text-[var(--success)]",
    warning: "bg-[var(--warning-light)] text-[var(--warning)]",
    danger: "bg-[var(--danger-light)] text-[var(--danger)]",
  };
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow)]">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={18} /></span>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none text-[var(--text-h)]">{value ?? "—"}</p>
        <p className="mt-1 truncate text-xs text-[var(--text)]" title={label}>{label}</p>
      </div>
    </div>
  );
}

// Displays one selectable theme option.
function ThemeOption({ label, icon: Icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${active ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-hover)]"}`}
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate">{label}</span>
      {active && <Check size={14} className="shrink-0" />}
    </button>
  );
}

// Displays a compact group of mutually exclusive settings.
function SegmentedControl({ label, hint, value, options, onChange }) {
  const optionGrid = options.length === 4
    ? "grid-cols-2 2xl:grid-cols-4"
    : "grid-cols-2";

  return (
    <div className="py-3">
      <p className="text-sm font-medium text-[var(--text-h)]">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--text)]">{hint}</p>}
      <div className={`mt-2 grid gap-1 rounded-xl bg-[var(--surface-hover)] p-1 ${optionGrid}`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={`min-w-0 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors sm:px-3 disabled:cursor-not-allowed disabled:opacity-40 ${value === option.value ? "bg-[var(--primary)] text-white shadow-sm" : "text-[var(--text)] hover:text-[var(--text-h)]"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Displays an accessible on-or-off setting.
function Toggle({ checked, onChange, label, hint }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 py-3 sm:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text-h)]">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-[var(--text)]">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors sm:mt-0 ${checked ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
      >
        <span className={`h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

// Displays one application information value.
function InfoItem({ label, value, wide = false }) {
  return (
    <div className={`min-w-0 rounded-xl bg-[var(--surface-hover)] px-3 py-2.5 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text)]">{label}</dt>
      <dd className={`mt-0.5 break-words font-medium text-[var(--text-h)] ${wide ? "font-mono text-xs [overflow-wrap:anywhere]" : "text-sm"}`}>{value || "Unavailable"}</dd>
    </div>
  );
}

// Manages application preferences, metadata, and data reset controls.
export default function Settings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [applicationInfo, setApplicationInfo] = useState(null);
  const [savedKey, setSavedKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showBackupConfirm, setShowBackupConfirm] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const backupActionRef = useRef(false);
  const clearHistoryActionRef = useRef(false);

  // Load settings, live statistics, and application metadata together.
  const loadDashboard = useCallback(async () => {
    const applicationInfoRequest = typeof window.api.getApplicationInfo === "function"
      ? window.api.getApplicationInfo()
      : Promise.reject(new Error("Application metadata requires an app restart."));
    const results = await Promise.allSettled([
      window.api.getSettings(),
      window.api.getPlayerManagementData(),
      window.api.getCourts(),
      window.api.getRotationMatches(),
      window.api.listTournaments(),
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
      && tournamentResult.value?.success
      && Array.isArray(tournamentResult.value.data);

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
        ? tournamentResult.value.data.filter((event) => event.status === "ongoing").length
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

  // Load the Settings dashboard after the page mounts.
  useEffect(() => {
    const initialLoad = window.setTimeout(loadDashboard, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadDashboard]);

  // Apply theme changes and follow system-theme updates when selected.
  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== "system") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    // Reapply the system theme when the operating-system preference changes.
    const handleSystemThemeChange = () => applyTheme("system");
    media.addEventListener("change", handleSystemThemeChange);
    return () => media.removeEventListener("change", handleSystemThemeChange);
  }, [settings.theme]);

  // Save one setting and update its control immediately.
  async function handleSettingChange(key, value) {
    const previousValue = settings[key];
    setSettings((current) => ({ ...current, [key]: value }));
    setError("");
    if (key === "theme") applyTheme(value);
    try {
      const result = await window.api.updateSetting(key, value);
      if (!result?.success) throw new Error("The preference could not be saved.");
      setSavedKey(key);
      window.setTimeout(() => setSavedKey(""), 1500);
    } catch (settingError) {
      // Keep the visible control aligned with the persisted preference on failure.
      setSettings((current) => (
        current[key] === value ? { ...current, [key]: previousValue } : current
      ));
      if (key === "theme") applyTheme(previousValue);
      setError(settingError instanceof Error ? settingError.message : "The preference could not be saved.");
    }
  }

  // Keep Tournament default category valid when Singles is selected.
  function handleTournamentMatchType(value) {
    handleSettingChange("defaultTournamentMatchType", value);
    if (value === "singles" && settings.defaultTournamentCategory === "mixed") {
      handleSettingChange("defaultTournamentCategory", "no_gender");
    }
  }

  // Reset application data after confirmation and reload live statistics.
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

  // Opens the native Save dialog and creates a consistent copy of the live database.
  async function handleBackup() {
    if (backupActionRef.current || isBackingUp) return;
    backupActionRef.current = true;
    setIsBackingUp(true);
    setError("");
    setMessage("");
    try {
      const result = await window.api.backupDatabase();
      if (!result?.success) throw new Error(result?.message || "The database backup failed.");
      setShowBackupConfirm(false);
      if (!result.data?.cancelled) {
        setMessage(`Database backup created: ${result.data.fileName}.`);
      }
    } catch (backupError) {
      setError(backupError instanceof Error ? backupError.message : "The database backup failed.");
    } finally {
      backupActionRef.current = false;
      setIsBackingUp(false);
    }
  }

  // Deletes only completed Rotation history older than the seven-day retention window.
  async function handleClearOldHistory() {
    if (clearHistoryActionRef.current || isClearingHistory) return;
    clearHistoryActionRef.current = true;
    setIsClearingHistory(true);
    setError("");
    setMessage("");
    try {
      const result = await window.api.clearOldRotationHistory();
      if (!result?.success) throw new Error(result?.message || "Old Rotation history could not be cleared.");
      const deleted = Number(result.data?.deletedMatches || 0);
      setShowClearHistoryConfirm(false);
      setMessage(deleted > 0
        ? `Deleted ${deleted} old Rotation match${deleted === 1 ? "" : "es"}. Recent 7-day history was kept.`
        : "No old Rotation history to clear.");
      await loadDashboard();
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : "Old Rotation history could not be cleared.");
    } finally {
      clearHistoryActionRef.current = false;
      setIsClearingHistory(false);
    }
  }

  const savedMessage = savedKey ? "Saved automatically ✓" : "Changes are saved automatically.";
  const appInfo = applicationInfo || {};

  return (
    <div className="min-w-0 space-y-5">
      {/* Settings heading */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-[var(--text-h)]">Application Settings</h1>
          <p className="mt-1 text-sm text-[var(--text)]">Preferences, operational defaults, application information, and data management.</p>
        </div>
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-[var(--primary-light)] px-3 py-2 text-sm font-semibold text-[var(--primary)]"><SlidersHorizontal size={16} /> Desktop Configuration</span>
      </div>

      {/* Settings feedback */}
      {error && <div role="alert" className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-light)] px-4 py-3 text-sm text-[var(--danger)]">{error}</div>}
      {message && <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--success)]/30 bg-[var(--success-light)] px-4 py-3 text-sm text-[var(--success)]"><Check size={16} className="shrink-0" /><span className="min-w-0 break-words">{message}</span></div>}

      {/* Live application overview */}
      <section aria-label="Application overview" className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        <Stat label="Registered Players Today" value={stats.registeredToday} icon={UserCheck} />
        <Stat label="Total Player Profiles" value={stats.totalProfiles} icon={Users} tone="success" />
        <Stat label="Courts" value={stats.courts} icon={LayoutGrid} tone="warning" />
        <Stat label="Active Queue Matches" value={stats.activeQueueMatches} icon={ListOrdered} tone="warning" />
        <Stat label="Matches Playing" value={stats.matchesPlaying} icon={Play} tone="danger" />
        <Stat label="Active Tournament" value={stats.activeTournament} icon={Trophy} />
      </section>

      {/* Settings sections */}
      <div className="grid items-start gap-5 2xl:grid-cols-2">
        <Card title="Application" description="Choose how the desktop application looks." icon={Palette} footer={savedKey === "theme" ? "Theme saved ✓" : savedMessage}>
          <div className="flex min-w-0 gap-2">
            <ThemeOption label="Light" icon={Sun} active={settings.theme === "light"} onClick={() => handleSettingChange("theme", "light")} />
            <ThemeOption label="Dark" icon={Moon} active={settings.theme === "dark"} onClick={() => handleSettingChange("theme", "dark")} />
            <ThemeOption label="System" icon={Monitor} active={settings.theme === "system"} onClick={() => handleSettingChange("theme", "system")} />
          </div>
        </Card>

        <Card title="Queue Preferences" description="Defaults used by Rotation Queue operations." icon={ListOrdered} footer={savedMessage}>
          <div className="divide-y divide-[var(--border)]">
            <SegmentedControl label="Default Match Type" hint="Used when Rotation Queue has no saved session draft." value={settings.defaultMatchType} options={[{ value: "singles", label: "Singles" }, { value: "doubles", label: "Doubles" }]} onChange={(value) => handleSettingChange("defaultMatchType", value)} />
            <Toggle checked={settings.autoRequeue !== "false"} onChange={(value) => handleSettingChange("autoRequeue", String(value))} label="Auto Requeue Players" hint="Return players to availability after a completed Rotation match." />
          </div>
        </Card>

        <Card title="Tournament Defaults" description="Starting options for newly created Tournaments." icon={Trophy} footer={savedMessage}>
          <div className="divide-y divide-[var(--border)]">
            <SegmentedControl label="Default Match Type" value={settings.defaultTournamentMatchType} options={[{ value: "singles", label: "Singles" }, { value: "doubles", label: "Doubles" }]} onChange={handleTournamentMatchType} />
            <SegmentedControl label="Default Category" value={settings.defaultTournamentCategory} options={[{ value: "mens", label: "Men's" }, { value: "womens", label: "Women's" }, { value: "mixed", label: "Mixed", disabled: settings.defaultTournamentMatchType === "singles" }, { value: "no_gender", label: "No Gender" }]} onChange={(value) => handleSettingChange("defaultTournamentCategory", value)} />
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-medium text-[var(--text-h)]">Shuffle Players Before Team Creation</p><p className="mt-0.5 text-xs text-[var(--text)]">Built into the current Tournament team generator.</p></div><span className="shrink-0 whitespace-nowrap rounded-full bg-[var(--success-light)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--success)]">Always On</span></div>
          </div>
        </Card>

        <Card title="Database Management" description="Back up or maintain local application data." icon={Database}>
          <div className="divide-y divide-[var(--border)]">
            <div className="flex min-w-0 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><p className="text-sm font-medium text-[var(--text-h)]">Backup Database</p><p className="mt-0.5 text-xs text-[var(--text)]">Save a consistent copy of player, Rotation, Tournament, court, and settings data.</p></div>
              <button type="button" onClick={() => setShowBackupConfirm(true)} disabled={isBackingUp} className="shrink-0 self-start whitespace-nowrap rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-h)] hover:bg-[var(--surface-hover)] disabled:opacity-50 sm:self-center"><Download className="mr-1 inline h-3.5 w-3.5" /> Backup</button>
            </div>
            
            {/* No need for this feature */}
            {/* <div className="flex items-center justify-between gap-4 py-3">
              <div><p className="text-sm font-medium text-[var(--text-h)]">Clear Old Rotation History</p><p className="mt-0.5 text-xs text-[var(--text)]">Delete completed Rotation records older than the current 7-day retention window.</p></div>
              <button type="button" onClick={() => setShowClearHistoryConfirm(true)} disabled={isClearingHistory} className="shrink-0 rounded-xl border border-[var(--danger)]/40 px-3 py-2 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger-light)] disabled:opacity-50"><Trash2 className="mr-1 inline h-3.5 w-3.5" /> Clear History</button>
            </div> */}

            <div className="flex min-w-0 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><p className="text-sm font-medium text-[var(--text-h)]">Reset Application Data</p><p className="mt-0.5 text-xs text-[var(--text)]">Deletes players, matches, tournaments, queue data, and courts before restoring the default courts.</p></div>
              <button type="button" onClick={() => setShowResetConfirm(true)} className="shrink-0 self-start whitespace-nowrap rounded-xl bg-[var(--danger)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 sm:self-center"><RotateCcw className="mr-1 inline h-3.5 w-3.5" /> Reset Data</button>
            </div>
          </div>
        </Card>

        <Card title="About" description="Application, runtime, and local database information." icon={Info} className="2xl:col-span-2">
          <div className="mb-4 flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-lg font-bold text-white">BQ</span>
            <div className="min-w-0"><p className="truncate font-semibold text-[var(--text-h)]">{appInfo.applicationName || "Badminton Queue"}</p><p className="text-xs text-[var(--text)]">Queue, court, player, and Tournament management.</p></div>
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

      {/* Destructive reset confirmation */}
      <ConfirmDialog open={showBackupConfirm} title="Backup Database" message="Create a backup copy of the current Badminton Queuing App database. The backup includes player profiles, Tournament data, Rotation history, courts, settings, and other stored records." confirmLabel={isBackingUp ? "Creating..." : "Create Backup"} variant="primary" confirmDisabled={isBackingUp} onConfirm={handleBackup} onCancel={() => !isBackingUp && setShowBackupConfirm(false)} />
      <ConfirmDialog open={showClearHistoryConfirm} title="Clear Old Rotation History?" message="This permanently deletes finished or cancelled Rotation matches older than the last 7 days. Recent history, active matches, player statistics, daily statistics, profiles, and Tournament records will be kept. This action cannot be undone." confirmLabel={isClearingHistory ? "Clearing..." : "Clear Old History"} variant="danger" confirmDisabled={isClearingHistory} onConfirm={handleClearOldHistory} onCancel={() => !isClearingHistory && setShowClearHistoryConfirm(false)} />
      <ConfirmDialog open={showResetConfirm} title="Reset Application Data" message="Delete all application data and restore the default courts? This action cannot be undone." confirmLabel={isResetting ? "Resetting..." : "Delete Everything"} variant="danger" confirmDisabled={isResetting} onConfirm={handleReset} onCancel={() => !isResetting && setShowResetConfirm(false)} />
    </div>
  );
}
