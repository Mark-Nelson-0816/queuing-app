import { useState } from "react";

export default function CourtCard({
  court,
  onEndMatch,
  onRemoveCourt
}) {


  const isAvailable = court.status === "available";
  const [requeuePlayers, setRequeuePlayers] = useState(true);


  return (

    <div
      className="
      bg-[var(--surface)]
      rounded-2xl
      border
      border-[var(--border)]
      p-5
      flex
      flex-col
      "
    >



      <div className="flex items-center justify-between mb-4">

        <h3 className="text-lg font-bold text-[var(--text-h)]">
          {court.name}
        </h3>


        <span
          className={`
          inline-flex items-center gap-1.5
          px-3 py-1
          rounded-full
          text-xs font-semibold

          ${
            isAvailable
            ? "bg-[var(--success-light)] text-[var(--success)]"
            : "bg-[var(--primary-light)] text-[var(--primary)]"
          }

          `}
        >

          <span
            className={`
            w-2 h-2 rounded-full

            ${
              isAvailable
              ? "bg-[var(--success)]"
              : "bg-[var(--primary)]"
            }

            `}
          />

          {court.status}

        </span>


      </div>



      {
        court.players && court.players.length > 0 ? (
          <div className="flex-1 space-y-2 mb-4">
            <p className="text-xs font-medium text-[var(--text)] uppercase">
              Players
            </p>

            <div className="flex flex-col gap-2">
              {
                court.players.map((player,index)=>(
                  <span
                    key={index}
                    className="
                    inline-flex items-center gap-2
                    px-3 py-1.5
                    bg-[var(--surface-hover)]
                    rounded-lg
                    text-sm
                    "
                  >
                    <span
                      className="
                      w-6 h-6
                      rounded-full
                      bg-[var(--primary)]
                      text-white
                      flex items-center justify-center
                      text-xs
                      "
                    >
                      {player.charAt(0)}
                    </span>

                    {player}
                  </span>
                ))
              }
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center mb-4 text-sm text-[var(--text)]">
            No players assigned
          </div>
        )
      }





{
        !isAvailable &&

        <div className="space-y-2 mb-2">
          <button

            onClick={() => onEndMatch?.(court.id, requeuePlayers)}

            className="
            w-full
            py-2
            rounded-xl
            bg-red-500/80
            text-white
            text-sm
            font-semibold
            "
          >

            End Match

          </button>

          <label className="flex items-center gap-2 text-xs text-[var(--text)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={requeuePlayers}
              onChange={(e) => setRequeuePlayers(e.target.checked)}
              className="rounded"
            />
            Requeue players after match
          </label>
        </div>

      }



      <button

        onClick={() => onRemoveCourt?.(court.id)}

        className="
        w-full
        py-2
        rounded-xl
        bg-red-500/80
        text-white
        text-sm
        font-semibold
        "

      >

        Remove Court

      </button>



    </div>

  );

}