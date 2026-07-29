export default function PlayerTable({ players }) {
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
                <td colSpan={5} className="text-center py-12 text-[var(--text)]">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">👥</span>
                    <p className="text-sm font-medium">No players registered</p>
                    <p className="text-xs">Add players from the Queue page</p>
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
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-full bg-[var(--primary)] text-white text-sm flex items-center justify-center font-medium">
                        {player.name.charAt(0)}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-h)]">{player.name}</p>
                        <p className="text-xs text-[var(--text)]">ID: {player.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] text-sm font-bold">
                      {player.matchesPlayed}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                        player.status === "Active"
                          ? "bg-[var(--success-light)] text-[var(--success)]"
                          : "bg-[var(--surface-hover)] text-[var(--text)]"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          player.status === "Waiting" ? "bg-[var(--success)]" : "bg-[var(--text)]"
                        }`}
                      />
                      {player.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button className="px-3 py-1.5 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] text-xs font-semibold hover:opacity-80 transition-opacity">
                      Edit
                    </button>
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

