import { useState, useEffect } from "react";
import RegisteredPlayers from '../components/tournament/RegisteredPlayers';
import TournamentOptions from '../components/tournament/TournamentOptions';
import Matches from '../components/tournament/Matches';


export default function Tournament() {
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [matchType, setMatchType] = useState('doubles');
  const [category, setCategory] = useState('mens');

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">

        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold">0</p>
          <p className="text-sm text-[var(--text)]">Total Matches</p>
        </div>
        
        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold text-[var(--warning)]">0</p>
          <p className="text-sm text-[var(--text)]">Pending</p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold text-[var(--primary)]">0</p>
          <p className="text-sm text-[var(--text)]">Playing</p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold text-[var(--success)]">0</p>
          <p className="text-sm text-[var(--text)]">Completed</p>
        </div>

      </div>

      {/* Configuration + Players */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Tournament Configuration */}
        <TournamentOptions
        matchType={matchType}
        category={category}
        setCategory={setCategory}
        setMatchType={setMatchType}/>

        {/* Registered Players */}

        <RegisteredPlayers
        selectedPlayers={selectedPlayers}
        setSelectedPlayers={setSelectedPlayers}
        />

      </div>

      {/* Tournament Matches */}

      <Matches/>

    </div>
  );
}