'use client';

import { useState, useEffect } from 'react';
import Modal from "./Modal";

export default function EditPlayer({
  open,
  onClose,
  player,
}) {
  const [id, setId] = useState(null);
  const [name, setName] = useState('');
  const [level, setLevel] = useState('beginner');
  const [contact, setContact] = useState('');
  const [gender, setGender] = useState('male');
  const [preferMens, setPreferMens] = useState(false);
  const [preferWomens, setPreferWomens] = useState(false);
  const [preferMixed, setPreferMixed] = useState(false);
  const [preferNoGender, setPreferNoGender] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleUpdatePlayer = async (e) => {
    e.preventDefault();
    setLoading(true);

    if(!name || !level || (!preferMens && !preferWomens && !preferMixed && !preferNoGender)){
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }
    
    await window.api.updatePlayerInfo(id, name.trim(), level, gender, contact.trim(), preferMens, preferWomens, preferMixed, preferNoGender);

    setError('');
    setLoading(false);
    setLevel('beginner');
    setName('');
    setGender('male');
    setId(null);
    setContact('');
    setPreferMens(false);
    setPreferWomens(false);
    setPreferMixed(false);
    setPreferNoGender(false);

    onClose();
  };
  useEffect(() => {
    if (!player) return;

    setId(player.id ?? null);
    setName(player.name ?? '');
    setLevel(player.level ?? 'beginner');
    setContact(player.contact_number ?? '');
    setGender(player.gender ?? 'male');

    setPreferMens(Boolean(player.prefer_mens));
    setPreferWomens(Boolean(player.prefer_womens));
    setPreferMixed(Boolean(player.prefer_mixed));
    setPreferNoGender(Boolean(player.prefer_no_gender));
  }, [player]);
  
  if (!player) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Player Profile"
    >
      <form className="space-y-4" onSubmit={handleUpdatePlayer}> 
        {error && (
          <div className='bg-red-500 p-2 rounded-lg text-white'>{error} </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium">
            Full Name
          </label>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border p-2"
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

          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full rounded-lg border p-2"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="upper_intermediate">Upper Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Preferred Match Type
          </label>

          <div className="grid grid-cols-2 gap-3">

            <label className="flex items-center gap-2 rounded-lg border p-2">
              <input
                type="checkbox"
                checked={preferMens}
                onChange={(e) => setPreferMens(e.target.checked)}
              />
              <span>Men's</span>
            </label>

            <label className="flex items-center gap-2 rounded-lg border p-2">
              <input
                type="checkbox"
                checked={preferWomens}
                onChange={(e) => setPreferWomens(e.target.checked)}
              />
              <span>Women's</span>
            </label>

            <label className="flex items-center gap-2 rounded-lg border p-2">
              <input
                type="checkbox"
                checked={preferMixed}
                onChange={(e) => setPreferMixed(e.target.checked)}
              />
              <span>Mixed</span>
            </label>

            <label className="flex items-center gap-2 rounded-lg border p-2">
              <input
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
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className="w-full rounded-lg border p-2"
          />
        </div>

        <div className="flex justify-end gap-3 pt-3">

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2"
          >
            Cancel
          </button>

          <button
            className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>

        </div>

      </form>
    </Modal>
  );
}