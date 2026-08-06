import { useState, useEffect } from "react";
import EditPlayer from "./EditPlayer";
import ConfirmDialog from "../ConfirmDialog";

export default function AllPlayersTable({searchInput}) {
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const getPlayersProfile = async () => {
    const players = await window.api.getPlayersProfile(searchInput);
    setPlayers(players);
  }

  const handleDeletePlayerProfile = async (id) =>{
    await window.api.deletePlayerProfile(id);
    setShowDeleteModal(false);
  }

  useEffect(() => {
    getPlayersProfile(searchInput);
  }, [searchInput, showEditModal, showDeleteModal]);

  return (
    <>
      <div className="bg-white p-6">

        <table className="w-full border-collapse">

          <thead>

            <tr className="border-b bg-gray-100">

              <th className="p-3 text-center">Name</th>
              <th className="p-3 text-center">Level</th>
              <th className="p-3 text-center">Preference</th>
              <th className="p-3 text-center">Total Matches</th>
              <th className="p-3 text-center">W/L</th>
              <th className="p-3 text-center">Contact</th>
              <th className="p-3 text-center">Action</th>

            </tr>

          </thead>

          <tbody>
            {players && players.length > 0 ? players.map((player)=>(
              <tr key={player.id} className="border-b hover:bg-gray-50">

                <td className="p-3 font-medium text-center">
                  {player.name}
                </td>

                <td className="p-3 text-center">
                  {player.level === "beginner" && "Beginner"}
                  {player.level === "intermediate" && "Intermediate"}
                  {player.level === "upper_intermediate" && "Upper Intermediate"}
                  {player.level === "advanced" && "Advanced"}
                </td>

                <td className="p-3 text-center">
                  {[
                    player.prefer_mens && "Men's",
                    player.prefer_womens && "Women's",
                    player.prefer_mixed && "Mixed",
                    player.prefer_no_gender && "No Gender",
                  ]
                    .filter(Boolean)
                    .join(" | ")}
                </td>

                <td className="p-3 text-center">
                  {player.total_matches_played}
                </td>

                <td className="p-3 text-center">
                  {`${player.total_wins} / ${player.total_losses}`}
                </td>

                <td className="p-3 text-center">
                  {player.contact_number}
                </td>

                <td className="p-3">

                  <div className="flex justify-center gap-2">

                    <button
                      className="rounded-lg bg-yellow-500 px-3 py-1 text-sm text-white hover:bg-yellow-600"
                      onClick={()=>{
                        setSelectedPlayer(player);
                        setShowEditModal(true);
                      }}
                    >
                      Edit
                    </button>

                    <button
                      className="rounded-lg bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                      onClick={()=>{
                        setShowDeleteModal(true);
                        setSelectedPlayer(player);
                      }}
                    >
                      Delete
                    </button>

                  </div>

                </td>

              </tr>
            )) : (
              <tr>
                <td colSpan='7'>No player found.</td>
              </tr>
            )}


          </tbody>

        </table>

      </div>

      <EditPlayer
        open={showEditModal}
        onClose={()=>setShowEditModal(false)}
        player={selectedPlayer}
      />

      
      <ConfirmDialog
              open={showDeleteModal}
              title="Delete this player profile permanently."
              message={`Do you want to delete ${selectedPlayer.name} profile permanently?`}
              confirmLabel="Delete"
              variant="danger"
              onConfirm={() => handleDeletePlayerProfile(selectedPlayer.id)}
              onCancel={() => setShowDeleteModal(false)}
            />
    </>
  );
}