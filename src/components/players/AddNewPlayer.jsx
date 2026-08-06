'use client';
import {useState} from "react";

export default function AddNewPlayer({setError, refreshData, setRefreshData}) {
  
  const [addPlayerLoading, setAddPlayerLoading] = useState(false);
  const [name, setName] = useState('');
  const [level, setLevel] = useState('beginner');
  const [gender, setGender] = useState('male');
  const [contact, setContact] = useState('');
  const [preferMens, setPreferMens] = useState(false);
  const [preferWomens, setPreferWomens] = useState(false);
  const [preferMixed, setPreferMixed] = useState(false);
  const [preferNoGender, setPreferNoGender] = useState(false);

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    setAddPlayerLoading(true);

    if (!name || !level || (!preferMens && !preferWomens && !preferMixed && !preferNoGender)) {
      setError('Please fill in all required fields.');
      setAddPlayerLoading(false);
      return;
    }
    try{
      const data = await window.api.addPlayer(name.trim(), level, gender, contact.trim(), preferMens, preferWomens, preferMixed, preferNoGender);

      if(data.message && data.message === 'Player already exists.'){
        setError('Player already exists.');
        setAddPlayerLoading(false);
        return;
      }
    }catch(error){
      console.error(error);
      
    }finally{
      setRefreshData(!refreshData);
    }

    
    setAddPlayerLoading(false);
    setError('');
    setName('');
    setGender('male');
    setLevel('beginner');
    setContact('');
    setPreferMens(false);
    setPreferWomens(false);
    setPreferMixed(false);
    setPreferNoGender(false);
  }
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm w-full max-h-[600px]">
      <h2 className="mb-5 text-xl font-semibold">
        Add New Player Profile
      </h2>

      <form onSubmit={handleAddPlayer} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Full Name
          </label>
          <input
            type="text"
            placeholder="Enter player name"
            className="w-full rounded-lg border p-2"
            value={name}
            onChange={(e)=>setName(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Gender
          </label>

          <select className="w-full rounded-lg border p-2"
            value={gender}
            onChange={(e)=>setGender(e.target.value)}>
            <option value='male'>Male</option>
            <option value='female'>Female</option>
          </select>
        </div>
        
        <div>
          <label className="mb-1 block text-sm font-medium">
            Skill Level
          </label>

          <select className="w-full rounded-lg border p-2"
            value={level}
            onChange={(e)=>setLevel(e.target.value)}>
            <option value='beginner'>Beginner</option>
            <option value='intermediate'>Intermediate</option>
            <option value='upper_intermediate'>Upper Intermediate</option>
            <option value='advanced'>Advanced</option>
          </select>
        </div>
        
        <div>
            <label className="mb-2 block text-sm font-medium">
                Preferred Match Type
            </label>

            <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 rounded-lg border p-2">
                <input type="checkbox" 
                  type="checkbox"
                  checked={preferMens}
                  onChange={(e) => setPreferMens(e.target.checked)}
                  />
                <span>Men's</span>
                </label>

                <label className="flex items-center gap-2 rounded-lg border p-2">
                <input type="checkbox" 
                  type="checkbox"
                  checked={preferWomens}
                  onChange={(e) => setPreferWomens(e.target.checked)}
                />
                <span>Women's</span>
                </label>

                <label className="flex items-center gap-2 rounded-lg border p-2">
                <input type="checkbox" 
                  type="checkbox"
                  checked={preferMixed}
                  onChange={(e) => setPreferMixed(e.target.checked)}
                />
                <span>Mixed</span>
                </label>

                <label className="flex items-center gap-2 rounded-lg border p-2">
                <input type="checkbox" 
                  type="checkbox"
                  checked={preferNoGender}
                  onChange={(e) => setPreferNoGender(e.target.checked)}
                />
                <span>No Gender</span>
                </label>
            </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Contact Number
          </label>

          <input
            type="text"
            placeholder="09xxxxxxxxx"
            className="w-full rounded-lg border p-2"
            value={contact}
            onChange={(e)=>setContact(e.target.value)}
          />
        </div>
        <button className="w-full rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-700">
          {addPlayerLoading ? 'Adding...' : 'Add Player'}
        </button>
      </form>
    </div>
  );
}