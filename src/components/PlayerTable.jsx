import { useState } from "react";

export default function PlayerTable({ players, onDeletePlayer, onUpdatePlayer }) {
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editLevel, setEditLevel] = useState("");

  const startEdit = (player) => {
    setEditId(player.id);
    setEditName(player.name);
    setEditLevel(player.level);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
    setEditLevel("");
  };

  const saveEdit = async () => {
    if (!editName.trim()) return;
    await onUpdatePlayer?.(editId, editName.trim(), editLevel);
    cancelEdit();
  };

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-hover)]/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
                Player
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
                Matches Played
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
                Status
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {players.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-[var(--text)]">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm font-medium">No players registered</p>
                    <p className="text-xs">Add players using the form above</p>
                  </div>
                </td>
              </tr>
            ) : (
              players.map((player) => (
                <tr
                  key={player.id}
                  className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-hover)]/50 transition-colors"
                >
                  <td className="px-4 py-4">
                    {editId === player.id ? (
                      <div className="flex items-center gap-2">
                        <span className="w-9 h-9 rounded-full bg-[var(--primary)] text-white text-sm flex items-center justify-center font-medium shrink-0">
                          {editName.charAt(0)}
                        </span>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text-h)] w-32 focus:outline-none focus:border-[var(--primary)]"
                          autoFocus
                        />
                        <select
                          value={editLevel}
                          onChange={(e) => setEditLevel(e.target.value)}
                          className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm"
                        >
                          <option value="Beginner">Beginner</option>
                          <option value="Intermediate">Intermediate</option>
                          <option value="Advanced">Advanced</option>
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-[var(--primary)] text-white text-sm flex items-center justify-center font-medium">
                          {player.name.charAt(0)}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-[var(--text-h)]">{player.name}</p>
                          <p className="text-xs text-[var(--text)]">Level: {player.level}</p>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] text-sm font-bold">
                      {player.matches_played || 0}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                        player.status === "waiting"
                          ? "bg-[var(--success-light)] text-[var(--success)]"
                          : player.status === "playing"
                          ? "bg-[var(--primary-light)] text-[var(--primary)]"
                          : "bg-[var(--surface-hover)] text-[var(--text)]"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          player.status === "waiting" || player.status === "playing" ? "bg-current" : "bg-[var(--text)]"
                        }`}
                      />
                      {player.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    {editId === player.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={saveEdit}
                          disabled={!editName.trim()}
                          className="px-3 py-1.5 rounded-lg bg-[var(--success)] text-white text-xs font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1.5 rounded-lg bg-[var(--surface-hover)] text-[var(--text)] text-xs font-semibold hover:opacity-80 transition-opacity"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(player)}
                          className="px-3 py-1.5 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] text-xs font-semibold hover:opacity-80 transition-opacity"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDeletePlayer?.(player.id)}
                          className="px-3 py-1.5 rounded-lg bg-[var(--danger-light)] text-[var(--danger)] text-xs font-semibold hover:opacity-80 transition-opacity"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
