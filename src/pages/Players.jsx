
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

// Displays one Player Management summary statistic.
function SummaryCard({ label, value }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow)]">
      <div className="flex flex-col items-center justify-center">
          <p className="whitespace-nowrap text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--text)] xl:text-xs">{label}</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-h)]">{value}</p>
      </div>
    </div>
  );
}

// Manages player profiles and today's registered players.
export default function Players() {
  const [data, setData] = useState(EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [profileModal, setProfileModal] = useState(null);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [doneTarget, setDoneTarget] = useState(null);
  const [showMarkAllDoneConfirm, setShowMarkAllDoneConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busyPlayerId, setBusyPlayerId] = useState(null);
  const [isMarkingAllDone, setIsMarkingAllDone] = useState(false);
  const actionRef = useRef(false);

  // Load complete Player Management data from the backend.
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

  // Load Player Management data when the page opens.
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

  // Run one protected player action and refresh the page data.
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

  // Register or reactivate one player for today.
  const registerPlayer = (player) => runPlayerAction(
    player,
    () => window.api.registerPlayer(player.id),
    `${player.name} is ${player.todayRegistration?.isDone ? "active again" : "registered for today"}.`,
  );

  // Confirm that a player has finished for today.
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

  // Marks all eligible daily players done with one backend request and one refresh.
  const confirmMarkAllDone = async () => {
    if (actionRef.current || isMarkingAllDone) return;
    actionRef.current = true;
    setIsMarkingAllDone(true);
    setError("");
    setNotice("");
    try {
      const result = await window.api.markAllRegisteredPlayersDone();
      if (!result?.success) {
        throw new Error(result?.message || "Today's players could not be marked done.");
      }
      const { markedDone, skipped } = result.data;
      await loadData({ quiet: true });
      setShowMarkAllDoneConfirm(false);
      setNotice(`Marked done: ${markedDone}. Skipped: ${skipped}.`);
    } catch (actionError) {
      setError(actionError instanceof Error
        ? actionError.message
        : "Today's players could not be marked done.");
    } finally {
      actionRef.current = false;
      setIsMarkingAllDone(false);
    }
  };

  // Permanently delete an eligible player profile.
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
    <div className="min-w-0 space-y-3 sm:space-y-4">

      {/* Primary actions */}
      {/* <div className="flex flex-wrap justify-end">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setRegisterModalOpen(true)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text-h)] shadow-sm hover:bg-[var(--surface-hover)]">
             Register Existing
          </button>
          <button type="button" onClick={() => setProfileModal({ mode: "add", player: null })} className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)]">
             Add New Player
          </button>
        </div>
      </div> */}

      {/* Action feedback */}
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

      {/* Player summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label="Total Profiles" value={summary.totalProfiles} detail="Permanent player records" />
        <SummaryCard label="Registered Today" value={summary.registeredToday} detail={`${summary.activeToday} active · ${summary.doneToday} done`} tone="success" />
        <SummaryCard label="Available Today" value={summary.availableToday} detail={`${summary.assignedToday} assigned to waiting matches`} tone="warning" />
        <SummaryCard label="Currently Playing" value={summary.playingToday} detail="Across active match sources" tone="danger" />
        <SummaryCard  label="Matches Today" value={summary.completedRotationMatchesToday} detail="Completed rotation matches" />
      </div>

      {/* Players registered today */}
      <RegisteredPlayersTable
        players={data.todayPlayers}
        isLoading={isLoading}
        busyPlayerId={busyPlayerId}
        onMarkDone={setDoneTarget}
        onReactivate={registerPlayer}
        onOpenRegister={() => setRegisterModalOpen(true)}
        onOpenAdd={() => setProfileModal({ mode: "add", player: null })}
        onMarkAllDone={() => setShowMarkAllDoneConfirm(true)}
        isMarkingAllDone={isMarkingAllDone}
      />

      {/* Permanent player profiles */}
      <AllPlayersTable
        profiles={data.profiles}
        isLoading={isLoading}
        busyPlayerId={busyPlayerId}
        onRegister={registerPlayer}
        onEdit={(player) => setProfileModal({ mode: "edit", player })}
        onDelete={setDeleteTarget}
        onOpenAdd={() => setProfileModal({ mode: "add", player: null })}
      />

      {/* Add or edit profile modal */}
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

      {/* Register existing profile modal */}
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

      {/* Mark-done confirmation */}
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

      {/* Bulk mark-done confirmation */}
      <ConfirmDialog
        open={showMarkAllDoneConfirm}
        title="Mark All Players Done?"
        message="This will mark all eligible players registered today as done for the day. Players assigned to a waiting Rotation match or currently playing will be skipped until their match is resolved."
        confirmLabel={isMarkingAllDone ? "Working..." : "Mark All Done"}
        variant="primary"
        confirmDisabled={isMarkingAllDone}
        onConfirm={confirmMarkAllDone}
        onCancel={() => !isMarkingAllDone && setShowMarkAllDoneConfirm(false)}
      />

      {/* Profile deletion confirmation */}
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
