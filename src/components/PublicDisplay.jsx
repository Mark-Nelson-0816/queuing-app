import { useEffect } from "react";

const demoCourts = [
  { id: 1, name: "Court 1", status: "playing", players: ["Alex", "Sam", "Jordan", "Casey"] },
  { id: 2, name: "Court 2", status: "playing", players: ["Riley", "Morgan"] },
  { id: 3, name: "Court 3", status: "playing", players: ["Taylor", "Drew", "Quinn", "Avery"] },
  { id: 4, name: "Court 4", status: "playing", players: ["Jamie", "Skyler"] },
  { id: 5, name: "Court 5", status: "playing", players: ["Reese", "Kai", "Rowan", "Emerson"] },
  { id: 6, name: "Court 6", status: "playing", players: ["Blake", "Sage"] },
];

const demoQueue = [
  { id: 1, name: "Chris P.", timeJoined: "5:02 PM" },
  { id: 2, name: "Devon L.", timeJoined: "5:05 PM" },
  { id: 3, name: "Harper W.", timeJoined: "5:07 PM" },
  { id: 4, name: "Peyton K.", timeJoined: "5:09 PM" },
];

const COURT_COLS = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

export default function PublicDisplay({ courts = demoCourts, queueNext = demoQueue }) {
  
  const activeCourts = courts;
  
  
  
  

  
  
  
  
  const courtColCount =
    activeCourts.length <= 1 ? 1 : activeCourts.length <= 4 ? 2 : 3;
  const courtGridCols = COURT_COLS[courtColCount];

  
  const dense = activeCourts.length > 4;

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        window.location.reload();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)] p-5 flex flex-col gap-4">

      <div className="shrink-0 flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-3">
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

      <div className="grid grid-cols-4 gap-4 flex-1 min-h-0">

        <div className="col-span-3 min-h-0 flex flex-col gap-3">
          <h2 className="shrink-0 text-xl font-semibold uppercase tracking-wide text-[var(--text-h)]">
            Currently Playing
          </h2>

          {activeCourts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center rounded-2xl bg-[var(--surface)] border border-dashed border-[var(--border)]">
              <div className="text-center">
                <p className="text-5xl mb-2">🏸</p>
                <p className="text-xl text-[var(--text)]">No active matches</p>
                <p className="text-sm opacity-60">Waiting for players...</p>
              </div>
            </div>
          ) : (
            <div
              className={`flex-1 min-h-0 grid ${courtGridCols} auto-rows-fr gap-3`}
            >
              {activeCourts.map((court) => (
                <div
                  key={court.id}
                  className={`min-h-0 flex flex-col bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow)] ${
                    dense ? "p-3" : "p-4"
                  }`}
                >
                  <div
                    className={`shrink-0 flex items-center justify-between ${
                      dense ? "mb-2" : "mb-3"
                    }`}
                  >
                    <h3
                      className={`font-bold text-[var(--text-h)] truncate ${
                        dense ? "text-base" : "text-xl"
                      }`}
                    >
                      {court.name}
                    </h3>

                    <span
                      className={`shrink-0 flex items-center gap-2 rounded-full bg-[var(--success-light)] text-[var(--success)] font-semibold ${
                        dense ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
                      LIVE
                    </span>
                  </div>

<div
                    className={`flex-1 min-h-0 grid gap-1.5 content-center ${
                      court.players?.length > 2 ? "grid-cols-1" : "grid-cols-1"
                    }`}
                  >
                    {court.players?.length === 2 ? (

                      <>
                        <div className="flex items-center gap-2 bg-[var(--surface-hover)] rounded-xl overflow-hidden p-2.5">
                          <span
                            className={`shrink-0 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold ${
                              dense ? "w-6 h-6 text-xs" : "w-9 h-9"
                            }`}
                          >
                            {court.players[0].charAt(0)}
                          </span>
                          <span
                            className={`font-medium text-[var(--text-h)] truncate ${
                              dense ? "text-lg" : "text-2xl"
                            }`}
                          >
                            {court.players[0]}
                          </span>
                        </div>

                        <p
                          className={`text-center font-bold opacity-40 ${
                            dense ? "text-xs" : "text-sm"
                          }`}
                        >
                          VS
                        </p>

                        <div className="flex items-center gap-2 bg-[var(--surface-hover)] rounded-xl overflow-hidden p-2.5">
                          <span
                            className={`shrink-0 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold ${
                              dense ? "w-6 h-6 text-xs" : "w-9 h-9"
                            }`}
                          >
                            {court.players[1].charAt(0)}
                          </span>
                          <span
                            className={`font-medium text-[var(--text-h)] truncate ${
                              dense ? "text-lg" : "text-2xl"
                            }`}
                          >
                            {court.players[1]}
                          </span>
                        </div>
                      </>
                    ) : court.players?.length === 4 ? (
                      <div className="space-y-2">
                        {/* Team 1 */}
                        <div className="bg-[var(--primary-light)]/30 rounded-xl p-2">
                          <p className={`font-semibold text-[var(--primary)] text-center mb-1 ${dense ? 'text-[10px]' : 'text-xs'}`}>Team 1</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {court.players.slice(0, 2).map((player, index) => (
                              <div key={index} className="flex items-center gap-1.5 bg-[var(--surface-hover)] rounded-lg overflow-hidden p-1.5">
                                <span className={`shrink-0 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold ${dense ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-sm'}`}>
                                  {player.charAt(0)}
                                </span>
                                <span className={`font-medium text-[var(--text-h)] truncate ${dense ? 'text-sm' : 'text-lg'}`}>
                                  {player}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* VS */}
                        <p className={`text-center font-bold opacity-40 ${dense ? 'text-xs' : 'text-sm'}`}>VS</p>
                        {/* Team 2 */}
                        <div className="bg-[var(--warning-light)]/30 rounded-xl p-2">
                          <p className={`font-semibold text-[var(--warning)] text-center mb-1 ${dense ? 'text-[10px]' : 'text-xs'}`}>Team 2</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {court.players.slice(2, 4).map((player, index) => (
                              <div key={index} className="flex items-center gap-1.5 bg-[var(--surface-hover)] rounded-lg overflow-hidden p-1.5">
                                <span className={`shrink-0 rounded-full bg-[var(--warning)] text-white flex items-center justify-center font-bold ${dense ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-sm'}`}>
                                  {player.charAt(0)}
                                </span>
                                <span className={`font-medium text-[var(--text-h)] truncate ${dense ? 'text-sm' : 'text-lg'}`}>
                                  {player}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      court.players?.map((player, index) => (
                        <div
                          key={index}
                          className={`flex items-center gap-2 bg-[var(--surface-hover)] rounded-xl overflow-hidden ${
                            dense ? "p-1.5" : "p-2.5"
                          }`}
                        >
                          <span
                            className={`shrink-0 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold ${
                              dense ? "w-6 h-6 text-xs" : "w-9 h-9"
                            }`}
                          >
                            {player.charAt(0)}
                          </span>

                          <span
                            className={`font-medium text-[var(--text-h)] truncate ${
                              dense ? "text-lg" : "text-2xl"
                            }`}
                          >
                            {player}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex flex-col gap-3">
          <h2 className="shrink-0 text-xl font-semibold uppercase tracking-wide text-[var(--text-h)]">
            Next Up
          </h2>

          <div className="flex-1 min-h-0 bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 shadow-[var(--shadow)] flex flex-col">
            {queueNext.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-[var(--text)]">Queue is empty</p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col gap-2">
                {queueNext.slice(0, 6).map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 bg-[var(--surface-hover)] rounded-xl p-3 shrink-0"
                  >
                    <span className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold shrink-0">
                      {index + 1}
                    </span>

                    <div className="min-w-0">
                      <p className="font-medium text-[var(--text-h)] truncate">
                        {player.name}
                      </p>
                      <p className="text-xs text-[var(--text)]">
                        {player.timeJoined}
                      </p>
                    </div>
                  </div>
                ))}

                {queueNext.length > 7 && (
                  <p className="text-center text-sm text-[var(--text)] mt-auto">
                    +{queueNext.length - 7} more
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}