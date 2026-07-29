export default function PublicDisplay({ courts, queueNext }) {
  const activeCourts = courts.filter((c) => c.status === "Playing");

  return (
    <div className="min-h-full bg-[#0f172a] text-white p-8 flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <span className="text-4xl">🏸</span>
          <h1 className="text-4xl font-bold tracking-tight">Badminton Queue</h1>
        </div>
        <div className="text-right">
          <p className="text-5xl font-bold font-mono tabular-nums">
            {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-xl text-white/60">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8 flex-1">
        {/* Left: Currently Playing */}
        <div className="col-span-2 space-y-6">
          <h2 className="text-2xl font-semibold text-white/80 uppercase tracking-wider">Currently Playing</h2>

          {activeCourts.length === 0 ? (
            <div className="flex items-center justify-center h-64 rounded-3xl bg-white/5 border-2 border-dashed border-white/10">
              <div className="text-center">
                <p className="text-6xl mb-4">🏸</p>
                <p className="text-2xl text-white/40 font-medium">No active matches</p>
                <p className="text-lg text-white/30">Waiting for players...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {activeCourts.map((court) => (
                <div
                  key={court.id}
                  className="bg-white/5 rounded-3xl p-6 border border-white/10 backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold">Court {court.number}</h3>
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--success-light)] text-[var(--success)] text-lg font-semibold">
                      <span className="w-3 h-3 rounded-full bg-[var(--success)] animate-pulse" />
                      LIVE
                    </span>
                  </div>
                  <div className="space-y-3">
                    {court.players?.map((player, idx) => (
                      <div key={idx} className="flex items-center gap-4 bg-white/5 rounded-2xl p-4">
                        <span className="w-12 h-12 rounded-full bg-[var(--primary)] text-white text-xl flex items-center justify-center font-bold">
                          {player.charAt(0)}
                        </span>
                        <span className="text-2xl font-medium">{player}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-white/60">
                    <span className="text-2xl">⏱️</span>
                    <span className="text-xl font-mono font-bold">00:00</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Next Players */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-white/80 uppercase tracking-wider">Next Up</h2>

          <div className="bg-white/5 rounded-3xl border border-white/10 p-6 backdrop-blur-sm">
            {queueNext.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-4">📋</p>
                <p className="text-xl text-white/40">Queue is empty</p>
              </div>
            ) : (
              <div className="space-y-3">
                {queueNext.slice(0, 8).map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-4 bg-white/5 rounded-2xl p-4 hover:bg-white/10 transition-colors"
                  >
                    <span className="w-10 h-10 rounded-full bg-[var(--primary)] text-white text-lg flex items-center justify-center font-bold flex-shrink-0">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xl font-medium truncate">{player.name}</p>
                      <p className="text-sm text-white/50">{player.timeJoined}</p>
                    </div>
                  </div>
                ))}
                {queueNext.length > 8 && (
                  <p className="text-center text-white/40 pt-2 text-lg">
                    +{queueNext.length - 8} more
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10 pt-4 text-center text-white/30 text-lg">
        Press F11 for full screen mode
      </div>
    </div>
  );
}

