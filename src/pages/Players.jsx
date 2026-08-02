import { useEffect, useState } from "react";
import RegisteredPlayerTable from "../components/RegisteredPlayersTable";
import AllPlayersTable from "../components/AllPlayersTable";
import RegisterPlayerToday from "../components/RegisterPlayerToday";
import AddNewPlayer from "../components/AddNewPlayer";
import ConfirmDialog from "../components/ConfirmDialog";

export default function Players() {
  
  const [error, setError] = useState('');
  const [addPlayerLoading, setAddPlayerLoading] = useState(false);
  const [registerTodayLoading, setRegisterTodayLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [activeTable, setActiveTable] = useState("registered_today");
  const [search, setSearch] = useState('');

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
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold">
            0
          </p>
          <p>All Players</p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold">
            0
          </p>
          <p>Players Today</p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold">
            0
          </p>
          <p>Playing</p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold">
            0
          </p>
          <p>Total Matches</p>
        </div>
      </div>

      <div className='flex justify-between gap-4 w-full'>

        <AddNewPlayer 
          setError={setError}
          addLoadingPlayer={addPlayerLoading}
          setAddPlayerLoading={setAddPlayerLoading}
          />
        <RegisterPlayerToday
          setError={setError}
          registerTodayLoading={registerTodayLoading}
          setRegisterTodayLoading={setRegisterTodayLoading}
          />

      </div>

      <div className="border rounded-xl bg-white p-5">
        <div className='flex justify-between'> 
          <div>
            <button 
            onClick={()=>{
              setActiveTable('registered_today');
              setSearch('');
            }}>
              <h2 className="text-xl font-semibold">
                Registered Players Today
              </h2>
            </button>
            &nbsp;&nbsp; | &nbsp;&nbsp;
            <button 
            onClick={()=>{
              setActiveTable('all_players');
              setSearch('');
              }}>
              <h2 className="text-xl font-semibold">
                Player Profiles
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
          <RegisteredPlayerTable searchInput={search}/>
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
