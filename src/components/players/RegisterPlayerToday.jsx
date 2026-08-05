'use client';
import { useState, useEffect } from "react";

export default function RegisterPlayerToday({refreshData, setRefreshData}) {
  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState([]);
  const [registeringId, setRegisteringId] = useState(null);

  const handleSearchPlayers = async (searchText) => {
    try {
      const data = await window.api.searchPlayers(searchText);
      setPlayers(data);
      
    } catch (error) {
      console.error(error);
    }
  };

  const handleRegisterPlayer = async (id)=>{
    try{
      setRegisteringId(id);

      await window.api.registerPlayer(id);

    }catch(error){
      console.error(error);
    }finally{
      setRegisteringId(null);
      setRefreshData(!refreshData);
    }
  }

  useEffect(()=>{
    if(search.trim() === '') {
      setPlayers([]);
      return;
    }
    
    handleSearchPlayers(search);
  },[refreshData]);


  useEffect(() => {
    if(search.trim() === '') {
      setPlayers([]);
      return;
    }

    const timeout = setTimeout(() => {
      handleSearchPlayers(search);
    }, 300); 

    return () => clearTimeout(timeout);
  }, [search]);

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm w-full max-h-[600px]">
      <h2 className="mb-5 text-xl font-semibold">
        Register Player Today
      </h2>

      <input
        placeholder="Search player..."
        className="mb-5 w-full rounded-lg border p-2"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex flex-col gap-2 px-2 overflow-y-auto max-h-[430px]">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div>
              <p className="font-medium">{player.name}</p>
              <p className="text-sm text-gray-500">
                {player.level === "beginner" && "Beginner"}
                {player.level === "intermediate" && "Intermediate"}
                {player.level === "upper_intermediate" && "Upper Intermediate"}
                {player.level === "advanced" && "Advanced"}
              </p>

              <p className="text-sm text-gray-500">
                {[
                  player.prefer_mens && "Men's",
                  player.prefer_womens && "Women's",
                  player.prefer_mixed && "Mixed",
                  player.prefer_no_gender && "No Gender",
                ]
                  .filter(Boolean)
                  .join(" | ")}
              </p>
            </div>

            <button
              onClick={()=>handleRegisterPlayer(player.id)}
              disabled={!player.can_register}
              className={`rounded-lg px-4 py-2 text-white ${
                player.can_register
                  ? "bg-green-600 hover:bg-green-700"
                  : "cursor-not-allowed bg-gray-400"
              }`}
            >
              {registeringId === player.id
                ? "Registering..."
                : !player.can_register ? "Registered" : "Register"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}