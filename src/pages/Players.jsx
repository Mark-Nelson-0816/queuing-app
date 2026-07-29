import { useEffect, useState } from "react";
import PlayerTable from "../components/PlayerTable";


export default function Players() {

  const [players, setPlayers] = useState([]);


  useEffect(() => {
    async function loadPlayers(){
      const data = await window.api.getPlayers();
      setPlayers(data);
    }

    loadPlayers();

  }, []);


  return (
    <div className="space-y-6">

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


      <PlayerTable players={players}/>
    </div>
  );
}