'use client';
import {useState, useEffect} from 'react';
import ConfirmDialog from "../ConfirmDialog";

export default function RegisteredPlayersTodayList({searchInput, refreshData, setRefreshData}) {

  const [players, setPlayers] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState({});

  const getRegisteredPlayers = async () => {
    try {
      const data = await window.api.getRegisteredPlayersToday();
      setPlayers(data);
      
    } catch (error) {
      console.error(error);
    }finally{
      setRefreshData(!refreshData);
    }
  };
  
  useEffect(()=>{
    getRegisteredPlayers();
  },[refreshData]);

  const handleRemovePlayer = async (id) => {
    try {
      await window.api.removeRegisteredPlayer(id);
      await getRegisteredPlayers();
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error(error);
    }
  };

  const filteredPlayers = players.filter((player) =>
    player.name.toLowerCase().includes(searchInput.toLowerCase())
  );

  return (
    <div className="bg-white p-6">
      
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b bg-gray-100 text-left">
            <th className="p-3">Player</th>
            <th className="p-3">Level</th>
            <th className="p-3">Status</th>
            <th className="p-3">Matches Today</th>
            <th className="p-3 text-center">Action</th>
          </tr>
        </thead>

        <tbody>
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map((player) => (
              <tr key={player.id} className="border-b">
                <td className="p-3">{player.name}</td>

                <td className="p-3">
                  {player.level === "beginner" && "Beginner"}
                  {player.level === "intermediate" && "Intermediate"}
                  {player.level === "upper_intermediate" && "Upper Intermediate"}
                  {player.level === "advanced" && "Advanced"}
                </td>

                <td className="p-3">
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-sm text-blue-700">
                    {player.status}
                  </span>
                </td>

                <td className="p-3">{player.match_count}</td>

                <td className="p-3 text-center">
                  <button
                    className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                    onClick={() => {
                      setSelectedPlayer(player);
                      setShowDeleteConfirm(true);
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="p-5 text-center text-gray-500">
                No registered players.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <ConfirmDialog
              open={showDeleteConfirm}
              title="Remove this player."
              message={`Do you want to remove ${selectedPlayer.name} from registration today?`}
              confirmLabel="Remove"
              variant="danger"
              onConfirm={() => handleRemovePlayer(selectedPlayer.id)}
              onCancel={() => setShowDeleteConfirm(false)}
            />
    </div>
  );
}