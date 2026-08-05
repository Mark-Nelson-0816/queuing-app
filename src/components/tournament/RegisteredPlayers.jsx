'use client';
import {useState, useEffect} from 'react';

export default function RegisteredPlayers({selectedPlayers, setSelectedPlayers}){
    const [players, setPlayers] = useState([]);
    const [search, setSearch] = useState("");
    const [selectedPlayersCount, setSelectedPlayersCount] = useState(0);
    const [playerLevelCount, setPlayerLevelCount] = useState([]);

    const getRegisteredPlayersTodayLevelCount = async () => {
        const data = await window.api.getRegisteredPlayersTodayLevelCount();
        setPlayerLevelCount(data);
    }

    const getRegisteredPlayers = async () =>{
        const data = await window.api.getRegisteredPlayersToday();
        setPlayers(data);
    }

    useEffect(()=>{
        getRegisteredPlayers();
        getRegisteredPlayersTodayLevelCount();
    },[]);

    useEffect(()=>{
        setSelectedPlayersCount(selectedPlayers.length);
    },[selectedPlayers]);

    const handleSelectPlayer = (e, player) => {
        if (e.target.checked) {
            setSelectedPlayers(prev => [...prev, player]);
        } else {
            setSelectedPlayers(prev =>
                prev.filter(p => p.id !== player.id)
            );
        }
    };

    const filteredPlayers = players.filter((player) =>
        player.name.toLowerCase().includes(search.toLowerCase())
    );

    const allSelected = filteredPlayers.length > 0 && 
        filteredPlayers.every(player => selectedPlayers.some(p => p.id === player.id));

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedPlayers(filteredPlayers);
        } else {
            setSelectedPlayers([]);
        }
    };

    return(
        <div className="xl:col-span-2 bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden max-h-[600px]">

          <div className="p-4 border-b border-[var(--border)]">

            <div className="flex justify-between items-center mb-4">

              <div>

                <h2 className="font-semibold text-[var(--text-h)]">
                  Registered Players Today
                </h2>

                <p className="text-sm text-[var(--text)]">
                  Select players that will participate.
                </p>

              </div>

              <span className="text-sm">
                Selected: <strong>{selectedPlayersCount}</strong>
              </span>

            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">

            <div className="rounded-xl border p-3 text-center">
                <p className="text-xl font-bold text-green-600">
                {playerLevelCount.beginner}
                </p>
                <p className="text-xs text-[var(--text)]">
                Beginner
                </p>
            </div>

            <div className="rounded-xl border p-3 text-center">
                <p className="text-xl font-bold text-blue-600">
                {playerLevelCount.intermediate}
                </p>
                <p className="text-xs text-[var(--text)]">
                Intermediate
                </p>
            </div>

            <div className="rounded-xl border p-3 text-center">
                <p className="text-xl font-bold text-orange-600">
                {playerLevelCount.upper_intermediate}
                </p>
                <p className="text-xs text-[var(--text)]">
                Upper Intermediate
                </p>
            </div>

            <div className="rounded-xl border p-3 text-center">
                <p className="text-xl font-bold text-red-600">
                {playerLevelCount.advanced}
                </p>
                <p className="text-xs text-[var(--text)]">
                Advanced
                </p>
            </div>

            </div>
            
            <div className="flex gap-3">

              <input
                type="text"
                placeholder="Search player..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 rounded-xl border border-[var(--border)] px-4 py-2 outline-none"
              />

              <label className="flex items-center gap-2 whitespace-nowrap text-sm">
                <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                />

                Select All
            </label>

            </div>

          </div>

          <div className="max-h-[360px] overflow-y-auto divide-y divide-[var(--border)]">


              {filteredPlayers && filteredPlayers.map((player)=>(
                <label
               key={player.id}
                className="flex justify-between items-center p-4 hover:bg-black/5 cursor-pointer"
              >

                <div className="flex items-center gap-3">

                <input
                    type="checkbox"
                    checked={selectedPlayers.some(p => p.id === player.id)}
                    onChange={(e) => handleSelectPlayer(e, player)}
                />

                  <div>

                    <p className="font-medium">
                      {player.name.toUpperCase()}
                    </p>

                    <p className="text-sm text-[var(--text)]">
                        {player.gender.charAt(0).toUpperCase() + player.gender.slice(1).toLowerCase()} 
                        &nbsp; • &nbsp;
                        {player.level === "beginner" && "Beginner"}
                        {player.level === "intermediate" && "Intermediate"}
                        {player.level === "upper_intermediate" && "Upper Intermediate"}
                        {player.level === "advanced" && "Advanced"}
                    </p>

                  </div>

                </div>

              </label>
              ))}


          </div>

        </div>
    )
}