export default function PublicDisplay({ courts, queueNext }) {
  const activeCourts = courts.filter((c) => c.status === "playing");

  return (
    <div className="min-h-full bg-[var(--bg)] text-[var(--text)] p-5 flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏸</span>
          <h1 className="text-3xl font-bold text-[var(--text-h)]">
            Badminton Queue
          </h1>
        </div>

        <div className="text-right">
          <p className="text-4xl font-bold font-mono text-[var(--text-h)]">
            {new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="text-lg text-[var(--text)]">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>


      <div className="grid grid-cols-3 gap-4 flex-1">

        {/* Current Matches */}
        <div className="col-span-2 space-y-3">

          <h2 className="text-xl font-semibold uppercase tracking-wide text-[var(--text-h)]">
            Currently Playing
          </h2>

          {activeCourts.length === 0 ? (
            <div className="flex items-center justify-center h-56 rounded-2xl bg-[var(--surface)] border border-dashed border-[var(--border)]">
              <div className="text-center">
                <p className="text-5xl mb-2">🏸</p>
                <p className="text-xl text-[var(--text)]">
                  No active matches
                </p>
                <p className="text-sm opacity-60">
                  Waiting for players...
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {activeCourts.map((court) => (
                <div
                  key={court.id}
                  className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-[var(--shadow)]"
                >

                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold text-[var(--text-h)]">
                      {court.name}
                    </h3>

                    <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--success-light)] text-[var(--success)] text-sm font-semibold">
                      <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
                      LIVE
                    </span>
                  </div>


                  <div className="space-y-2">
                    {court.players?.map((player, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 bg-[var(--surface-hover)] rounded-xl p-2.5"
                      >
                        <span className="w-9 h-9 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold">
                          {player.charAt(0)}
                        </span>

                        <span className="text-lg font-medium text-[var(--text-h)]">
                          {player}
                        </span>
                      </div>
                    ))}
                  </div>


                  <div className="mt-3 flex items-center gap-2 text-[var(--text)]">
                    <span>⏱️</span>
                    <span className="font-mono font-bold">
                      00:00
                    </span>
                  </div>

                </div>
              ))}
            </div>
          )}

        </div>


        {/* Queue */}
        <div className="space-y-3">

          <h2 className="text-xl font-semibold uppercase tracking-wide text-[var(--text-h)]">
            Next Up
          </h2>

          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 shadow-[var(--shadow)]">

            {queueNext.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-[var(--text)]">
                  Queue is empty
                </p>
              </div>
            ) : (
              <div className="space-y-2">

                {queueNext.slice(0, 8).map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 bg-[var(--surface-hover)] rounded-xl p-3"
                  >

                    <span className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold">
                      {index + 1}
                    </span>

                    <div>
                      <p className="font-medium text-[var(--text-h)]">
                        {player.name}
                      </p>

                      <p className="text-xs text-[var(--text)]">
                        {player.timeJoined}
                      </p>
                    </div>

                  </div>
                ))}

                {queueNext.length > 8 && (
                  <p className="text-center text-sm text-[var(--text)]">
                    +{queueNext.length - 8} more
                  </p>
                )}

              </div>
            )}

          </div>

        </div>

      </div>


      <div className="border-t border-[var(--border)] pt-2 text-center text-sm text-[var(--text)] opacity-70">
        Press F11 for full screen mode
      </div>

    </div>
  );
}