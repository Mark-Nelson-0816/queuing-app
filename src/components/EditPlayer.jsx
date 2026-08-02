import Modal from "./Modal";

export default function EditPlayer({
  open,
  onClose,
  player,
}) {
  if (!player) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Player Profile"
    >
      <div className="space-y-4">

        <div>
          <label className="mb-1 block text-sm font-medium">
            Full Name
          </label>

          <input
            defaultValue={player.name}
            className="w-full rounded-lg border p-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Skill Level
          </label>

          <select
            defaultValue={player.level}
            className="w-full rounded-lg border p-2"
          >
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Upper Intermediate</option>
            <option>Advanced</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Gender
          </label>

          <select
            defaultValue={player.gender}
            className="w-full rounded-lg border p-2"
          >
            <option>Male</option>
            <option>Female</option>
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
                defaultChecked={player.preferMens}
              />
              <span>Men's</span>
            </label>

            <label className="flex items-center gap-2 rounded-lg border p-2">
              <input
                type="checkbox"
                defaultChecked={player.preferWomens}
              />
              <span>Women's</span>
            </label>

            <label className="flex items-center gap-2 rounded-lg border p-2">
              <input
                type="checkbox"
                defaultChecked={player.preferMixed}
              />
              <span>Mixed</span>
            </label>

            <label className="flex items-center gap-2 rounded-lg border p-2">
              <input
                type="checkbox"
                defaultChecked={player.preferNoGender}
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
            defaultValue={player.contact}
            className="w-full rounded-lg border p-2"
          />
        </div>

        <div className="flex justify-end gap-3 pt-3">

          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2"
          >
            Cancel
          </button>

          <button
            className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
          >
            Save Changes
          </button>

        </div>

      </div>
    </Modal>
  );
}