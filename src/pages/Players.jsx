import {
  Activity,
  CircleCheckBig,
  Gamepad2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import AllPlayersTable from "../components/players/AllPlayersTable";
import PlayerProfileModal from "../components/players/PlayerProfileModal";
import RegisterPlayerToday from "../components/players/RegisterPlayerToday";
import RegisteredPlayersTable from "../components/players/RegisteredPlayersTable";
import ConfirmDialog from "../components/ConfirmDialog";

const EMPTY_DATA = {
  profiles: [],
  todayPlayers: [],
  summary: {
    totalProfiles: 0,
    registeredToday: 0,
    activeToday: 0,
    availableToday: 0,
    assignedToday: 0,
    playingToday: 0,
    doneToday: 0,
    completedRotationMatchesToday: 0,
  },
};

function SummaryCard({ icon: Icon, label, value, detail, tone = "primary" }) {
  const toneClasses = {
    primary: "bg-[var(--primary-light)] text-[var(--primary)]",
    success: "bg-[var(--success-light)] text-[var(--success)]",
    warning: "bg-[var(--warning-light)] text-[var(--warning)]",
    danger: "bg-[var(--danger-light)] text-[var(--danger)]",
  };
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text)]">{label}</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-h)]">{value}</p>
        </div>
        <span className={`rounded-lg p-2 ${toneClasses[tone]}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-1.5 text-xs text-[var(--text)]">{detail}</p>
    </div>
  );
}

export default function Players() {
  const [data, setData] = useState(EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [profileModal, setProfileModal] = useState(null);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [doneTarget, setDoneTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busyPlayerId, setBusyPlayerId] = useState(null);
  const actionRef = useRef(false);

  const loadData = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setIsLoading(true);
    try {
      const result = await window.api.getPlayerManagementData();
      if (!result?.success) throw new Error(result?.message || "Failed to load Player Management.");
      setData(result.data);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Player Management.");
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    window.api.getPlayerManagementData()
      .then((result) => {
        if (!isCurrent) return;
        if (!result?.success) {
          throw new Error(result?.message || "Failed to load Player Management.");
        }
        setData(result.data);
        setError("");
      })
      .catch((loadError) => {
        if (!isCurrent) return;
        setError(loadError instanceof Error
          ? loadError.message
          : "Failed to load Player Management.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  const runPlayerAction = async (player, action, successMessage) => {
    if (actionRef.current) return false;
    actionRef.current = true;
    setBusyPlayerId(player.id);
    setError("");
    setNotice("");
    try {
      const result = await action();
      if (!result?.success) {
        setError(result?.message || "The player action could not be completed.");
        return false;
      }
      await loadData({ quiet: true });
      setNotice(successMessage);
      return true;
    } catch (actionError) {
      setError(actionError instanceof Error
        ? actionError.message
        : "The player action could not be completed.");
      return false;
    } finally {
      actionRef.current = false;
      setBusyPlayerId(null);
    }
  };

  const registerPlayer = (player) => runPlayerAction(
    player,
    () => window.api.registerPlayer(player.id),
    `${player.name} is ${player.todayRegistration?.isDone ? "active again" : "registered for today"}.`,
  );

  const confirmMarkDone = async () => {
    const player = doneTarget;
    if (!player) return;
    const completed = await runPlayerAction(
      player,
      () => window.api.removeRegisteredPlayer(player.id),
      `${player.name} is marked done for today.`,
    );
    if (completed) setDoneTarget(null);
  };

  const confirmDelete = async () => {
    const player = deleteTarget;
    if (!player) return;
    const completed = await runPlayerAction(
      player,
      () => window.api.deletePlayerProfile(player.id),
      `${player.name}'s profile was deleted.`,
    );
    if (completed) setDeleteTarget(null);
  };

  const summary = data.summary;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-h)]">Player Management</h1>
          <p className="mt-1 text-sm text-[var(--text)]">
            Manage permanent profiles and the players participating today.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setRegisterModalOpen(true)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text-h)] shadow-sm hover:bg-[var(--surface-hover)]">
            <UserCheck className="mr-2 inline h-4 w-4" /> Register Existing
          </button>
          <button type="button" onClick={() => setProfileModal({ mode: "add", player: null })} className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)]">
            <UserPlus className="mr-2 inline h-4 w-4" /> Add New Player
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-light)] p-4 text-sm text-[var(--danger)]">
          <p>{error}</p>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error" className="font-bold">×</button>
        </div>
      )}
      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[var(--success)]/30 bg-[var(--success-light)] p-4 text-sm text-[var(--success)]">
          <p>{notice}</p>
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss message" className="font-bold">×</button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard icon={Users} label="Total Profiles" value={summary.totalProfiles} detail="Permanent player records" />
        <SummaryCard icon={UserCheck} label="Registered Today" value={summary.registeredToday} detail={`${summary.activeToday} active · ${summary.doneToday} done`} tone="success" />
        <SummaryCard icon={CircleCheckBig} label="Available Today" value={summary.availableToday} detail={`${summary.assignedToday} assigned to waiting matches`} tone="warning" />
        <SummaryCard icon={Activity} label="Currently Playing" value={summary.playingToday} detail="Across active match sources" tone="danger" />
        <SummaryCard icon={Gamepad2} label="Matches Today" value={summary.completedRotationMatchesToday} detail="Completed rotation matches" />
      </div>

      <RegisteredPlayersTable
        players={data.todayPlayers}
        isLoading={isLoading}
        busyPlayerId={busyPlayerId}
        onMarkDone={setDoneTarget}
        onReactivate={registerPlayer}
        onOpenRegister={() => setRegisterModalOpen(true)}
        onOpenAdd={() => setProfileModal({ mode: "add", player: null })}
      />

      <AllPlayersTable
        profiles={data.profiles}
        isLoading={isLoading}
        busyPlayerId={busyPlayerId}
        onRegister={registerPlayer}
        onEdit={(player) => setProfileModal({ mode: "edit", player })}
        onDelete={setDeleteTarget}
        onOpenAdd={() => setProfileModal({ mode: "add", player: null })}
      />

      {profileModal && (
        <PlayerProfileModal
          key={`${profileModal.mode}-${profileModal.player?.id || "new"}`}
          open
          mode={profileModal.mode}
          player={profileModal.player}
          onClose={() => setProfileModal(null)}
          onSaved={async () => {
            await loadData({ quiet: true });
            setNotice(profileModal.mode === "edit"
              ? "Player profile updated."
              : "New player profile added.");
          }}
        />
      )}

      {registerModalOpen && (
        <RegisterPlayerToday
          key="register-player-today"
          open
          profiles={data.profiles}
          onClose={() => setRegisterModalOpen(false)}
          onRegistered={async (player) => {
            await loadData({ quiet: true });
            setNotice(`${player.name} is registered for today.`);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(doneTarget)}
        title="Mark Player Done"
        message={doneTarget
          ? `Mark ${doneTarget.name} done for today? They can be reactivated later.`
          : "Mark this player done for today?"}
        confirmLabel={busyPlayerId === doneTarget?.id ? "Working..." : "Mark Done"}
        variant="primary"
        confirmDisabled={busyPlayerId === doneTarget?.id}
        onConfirm={confirmMarkDone}
        onCancel={() => !busyPlayerId && setDoneTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Player Profile"
        message={deleteTarget
          ? `Permanently delete ${deleteTarget.name}? Profiles with match or teammate-lock history are protected.`
          : "Permanently delete this player profile?"}
        confirmLabel={busyPlayerId === deleteTarget?.id ? "Deleting..." : "Delete Profile"}
        variant="danger"
        confirmDisabled={busyPlayerId === deleteTarget?.id}
        onConfirm={confirmDelete}
        onCancel={() => !busyPlayerId && setDeleteTarget(null)}
      />
    </div>
  );
}
