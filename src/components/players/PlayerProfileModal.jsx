import { useRef, useState } from "react";
import Modal from "../Modal";
import { PlayerLevelBadge } from "./PlayerBadges";

const EMPTY_PROFILE = {
  name: "",
  gender: "male",
  level: "beginner",
  rankPreference: "same_rank",
  contactNumber: "",
  preferMens: false,
  preferWomens: false,
  preferMixed: false,
  preferNoGender: false,
};

export default function PlayerProfileModal({
  open,
  mode = "add",
  player = null,
  onClose,
  onSaved,
}) {
  const initialProfile = player || EMPTY_PROFILE;
  const [name, setName] = useState(initialProfile.name || "");
  const [gender, setGender] = useState(initialProfile.gender || "male");
  const [level, setLevel] = useState(initialProfile.level || "beginner");
  const [rankPreference, setRankPreference] = useState(
    initialProfile.rankPreference || "same_rank",
  );
  const [contact, setContact] = useState(
    initialProfile.contactNumber === "N/A" ? "" : initialProfile.contactNumber || "",
  );
  const [preferMens, setPreferMens] = useState(Boolean(initialProfile.preferMens));
  const [preferWomens, setPreferWomens] = useState(Boolean(initialProfile.preferWomens));
  const [preferMixed, setPreferMixed] = useState(Boolean(initialProfile.preferMixed));
  const [preferNoGender, setPreferNoGender] = useState(
    Boolean(initialProfile.preferNoGender),
  );
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const submissionRef = useRef(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submissionRef.current) return;
    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!preferMens && !preferWomens && !preferMixed && !preferNoGender) {
      setError("Select at least one preferred match category.");
      return;
    }

    submissionRef.current = true;
    setIsSaving(true);
    setError("");
    try {
      const args = [
        name.trim(),
        level,
        gender,
        contact.trim(),
        preferMens,
        preferWomens,
        preferMixed,
        preferNoGender,
        rankPreference,
      ];
      const result = mode === "edit"
        ? await window.api.updatePlayerInfo(player.id, ...args)
        : await window.api.addPlayer(...args);
      if (!result?.success) {
        setError(result?.message || "Failed to save player profile.");
        return;
      }
      await onSaved?.(result.data);
      onClose?.();
    } catch (saveError) {
      setError(saveError instanceof Error
        ? saveError.message
        : "Failed to save player profile.");
    } finally {
      submissionRef.current = false;
      setIsSaving(false);
    }
  };

  const closeWhenIdle = () => {
    if (!isSaving) onClose?.();
  };

  return (
    <Modal
      open={open}
      onClose={closeWhenIdle}
      title={mode === "edit" ? "Edit Player Profile" : "Add New Player Profile"}
      maxWidthClass="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-light)] p-3 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-[var(--text-h)] md:col-span-2" htmlFor="player-full-name">
            Full Name
            <input
              id="player-full-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter player name"
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-normal"
            />
          </label>

          <label className="text-sm font-medium text-[var(--text-h)]" htmlFor="player-gender">
            Gender
            <select
              id="player-gender"
              value={gender}
              onChange={(event) => setGender(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-normal"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>

          <label className="text-sm font-medium text-[var(--text-h)]" htmlFor="player-level">
            Skill Level
            <select
              id="player-level"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-normal"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="upper_intermediate">Upper Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>

          <label className="text-sm font-medium text-[var(--text-h)]" htmlFor="player-rank-preference">
            Rank Match Preference
            <select
              id="player-rank-preference"
              value={rankPreference}
              onChange={(event) => setRankPreference(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-normal"
            >
              <option value="same_rank">Same Rank Only</option>
              <option value="adjacent_rank">Adjacent Rank Allowed</option>
            </select>
          </label>

          <label className="text-sm font-medium text-[var(--text-h)]" htmlFor="player-contact">
            Contact Number
            <input
              id="player-contact"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="Optional contact number"
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-normal"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-hover)] p-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text-h)]">Level preview</p>
            <p className="text-xs text-[var(--text)]">The same rank color appears throughout the app.</p>
          </div>
          <PlayerLevelBadge level={level} />
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-[var(--text-h)]">
            Preferred Match Categories
          </legend>
          <p className="mt-1 text-xs text-[var(--text)]">Select at least one category.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              ["Men's", preferMens, setPreferMens],
              ["Women's", preferWomens, setPreferWomens],
              ["Mixed", preferMixed, setPreferMixed],
              ["No Gender", preferNoGender, setPreferNoGender],
            ].map(([label, checked, setter]) => (
              <label key={label} className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-3 text-sm text-[var(--text-h)]">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => setter(event.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={closeWhenIdle}
            disabled={isSaving}
            className="rounded-xl bg-[var(--surface-hover)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSaving
              ? "Saving..."
              : mode === "edit" ? "Save Changes" : "Save Player"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
