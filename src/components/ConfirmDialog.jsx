import Modal from "./Modal";

export default function ConfirmDialog({
  open,
  title = "Confirm",
  message = "Are you sure?",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  confirmDisabled = false,
  onConfirm,
  onCancel,
}) {
  const confirmColor =
    variant === "danger"
      ? "bg-red-500 hover:bg-red-600"
      : "bg-[var(--primary)] hover:bg-[var(--primary-hover)]";

  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-[var(--text)] mb-5">{message}</p>
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-[var(--surface-hover)] text-[var(--text)] text-sm font-semibold hover:opacity-80 transition-opacity"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={confirmDisabled}
          className={`px-4 py-2 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmColor}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

