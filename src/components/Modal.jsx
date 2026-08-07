import { useEffect, useRef } from "react";

// Displays accessible overlay content that closes on Escape or backdrop click.
export default function Modal({
  open,
  onClose,
  title,
  children,
  maxWidthClass = "max-w-md",
}) {
  const overlayRef = useRef(null);

  // Close an open modal when the operator presses Escape.
  useEffect(() => {
    if (!open) return;
    // Handle keyboard dismissal without changing modal content.
    const handleKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    /* Modal backdrop */
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose?.();
      }}
    >
      <div className={`bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl w-full ${maxWidthClass} max-h-[92vh] overflow-hidden flex flex-col`}>
        {/* Modal header */}
        {title && (
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-2">
            <h3 className="text-lg font-bold text-[var(--text-h)]">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${title}`}
              className="rounded-lg px-2 py-1 text-xl leading-none text-[var(--text)] hover:bg-[var(--surface-hover)]"
            >
              ×
            </button>
          </div>
        )}
        {/* Modal content */}
        <div className="px-5 py-3 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

