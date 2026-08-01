import { useEffect, useState } from "react";
import PlayerTable from "../components/PlayerTable";
import ConfirmDialog from "../components/ConfirmDialog";

export default function Players() {

  const [players, setPlayers] = useState([]);
  const [newName, setNewName] = useState("");
  const [newLevel, setNewLevel] = useState("Beginner");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPlayers();
  }, []);

  async function loadPlayers(){
    const data = await window.api.getPlayers();
    setPlayers(data);
  }

  const handleAddPlayer = async () => {
    if (!newName.trim()) return;
    await window.api.addPlayer(newName.trim(), newLevel);
    setNewName("");
    setNewLevel("Beginner");
    await loadPlayers();
  };

  const handleDeletePlayer = async (id) => {
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (deleteTarget === null) return;
    const result = await window.api.deletePlayer(deleteTarget);
    setDeleteTarget(null);
    if (result && result.success === false) {
      setError(result.error || "Cannot delete this player right now.");
      return;
    }
    await loadPlayers();
  };

  const handleUpdatePlayer = async (id, name, level) => {
    await window.api.updatePlayer(id, name, level);
    await loadPlayers();
  };

  return (
    <div className="space-y-6">

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--danger)] text-white px-4 py-3 rounded-xl">
          <p className="text-sm font-medium">{error}</p>
          <button
            onClick={() => setError("")}
            className="text-white/80 hover:text-white text-sm font-semibold shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4">
        <h3 className="font-semibold text-[var(--text-h)] mb-3">Add New Player</h3>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddPlayer(); }}
            placeholder="Enter player name..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-h)] text-sm placeholder:text-[var(--text)]/50 focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
          />
          <select
            value={newLevel}
            onChange={(e) => setNewLevel(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]"
          >
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
          <button
            onClick={handleAddPlayer}
            disabled={!newName.trim()}
            className="px-5 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add Player
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold">
            {players.length}
          </p>
          <p>Total Players</p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold">
            {players.filter(p => p.status === "playing").length}
          </p>
          <p>Playing</p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold">
            {players.reduce(
              (sum,p)=>sum+p.matches_played,
              0
            )}
          </p>
          <p>Total Matches</p>
        </div>
      </div>

      <PlayerTable
        players={players}
        onDeletePlayer={handleDeletePlayer}
        onUpdatePlayer={handleUpdatePlayer}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Player"
        message="Are you sure you want to delete this player?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
