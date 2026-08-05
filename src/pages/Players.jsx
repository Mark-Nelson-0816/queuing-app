import { useEffect, useState } from "react";
import RegisteredPlayerTable from "../components/players/RegisteredPlayersTable";
import AllPlayersTable from "../components/players/AllPlayersTable";
import RegisterPlayerToday from "../components/players/RegisterPlayerToday";
import AddNewPlayer from "../components/players/AddNewPlayer";

export default function Players() {
  
  const [error, setError] = useState('');
  const [tableLoading, setTableLoading] = useState(false);
  const [activeTable, setActiveTable] = useState("registered_today");
  const [search, setSearch] = useState('');
  const [refreshData, setRefreshData] = useState(false);
  const [cards, setCards] = useState([]);

  const getPlayerCards = async ()=>{
    const data = await window.api.getPlayerCards();
    setCards(data);
  }

  useEffect(() => {
    getPlayerCards(); 

  }, [refreshData]);
  
  return (
    <div className="space-y-6">
      {error && (
        <div className='rounded-xl bg-red-500 text-white p-4 flex justify-between'>
          <p>
            {error}
          </p>
          <button className="text-lg" onClick={(e)=>setError('')}>✖</button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold">
            {cards.allPlayers ?? 0}
          </p>
          <p>All Players</p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold">
            {cards.currentPlayers ?? 0}
          </p>
          <p>Current Players</p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold">
            {cards.overallPlayersToday ?? 0}
          </p>
          <p>Overall Players Today</p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold">
            {cards.playing ?? 0}
          </p>
          <p>Playing</p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold">
            {cards.totalMatches ?? 0}
          </p>
          <p>Total Matches</p>
        </div>
      </div>

      <div className='flex justify-between gap-4 w-full'>

        <AddNewPlayer 
          setError={setError}
          refreshData={refreshData}
          setRefreshData={setRefreshData}
          />
        <RegisterPlayerToday
        refreshData={refreshData}
        setRefreshData={setRefreshData}/>

      </div>

      <div className="border rounded-xl bg-white p-5">
        <div className='flex justify-between'> 
          <div>
            <button 
            onClick={()=>{
              setActiveTable('registered_today');
              setSearch('');
            }}>
              <h2 className={`text-xl font-semibold 
              ${activeTable === 'registered_today' ? 'underline' : ''}`}>
                Registered Players Today
              </h2>
            </button>
            &nbsp;&nbsp; | &nbsp;&nbsp;
            <button 
            onClick={()=>{
              setActiveTable('all_players');
              setSearch('');
              }}>
              <h2 className={`text-xl font-semibold 
              ${activeTable === 'all_players' ? 'underline' : ''}`}>
                All Player Profiles
              </h2>
            </button>
          </div>
          <input
              placeholder="Search player..."
              className="rounded-lg border p-2"
              onChange={(e)=>setSearch(e.target.value)}
            />
        </div>
        {activeTable === "registered_today" ? (
          <RegisteredPlayerTable 
          searchInput={search}
          refreshData={refreshData}
          setRefreshData={setRefreshData}/>
          ) : (
          <AllPlayersTable searchInput={search}/>
        )}
      </div>

      
      {/* <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Player"
        message="Are you sure you want to delete this player?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      /> */}
    </div>
  );
}
