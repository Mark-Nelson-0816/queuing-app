import { useEffect, useRef } from "react";

export default function Modal({ open, onClose, title, children }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 "
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose?.();
      }}
    >
      <div className="bg-[var(--surface)] rounded-md border border-[var(--border)] shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {title && (
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-lg font-bold text-[var(--text-h)]">{title}</h3>
          </div>
        )}
        <div className="px-5 py-3">{children}</div>
      </div>
    </div>
  );
}

