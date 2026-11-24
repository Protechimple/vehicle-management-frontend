import { useEffect, useRef } from 'react';

export default function Modal({ open, onClose, title, description, children, footer, wide = false }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const handleCancel = (event) => {
      event.preventDefault();
      onClose();
    };

    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="modal-title"
      // dvh where supported: on iPhone 100vh is taller than the area Safari's toolbars leave visible, so a tall dialog
      // could run under the toolbar and hide its footer buttons.
      className={`fixed inset-0 m-auto max-h-[calc(100vh-2rem)] supports-[height:100dvh]:max-h-[calc(100dvh-2rem)] ${wide === 'xl' ? 'w-[min(64rem,calc(100vw-2rem))]' : wide ? 'w-[min(44rem,calc(100vw-2rem))]' : 'w-[min(28rem,calc(100vw-2rem))]'} flex-col overflow-hidden rounded border border-steel-200 bg-surface p-0 backdrop:bg-brand-900/50 open:flex`}
    >
      {/* Header and footer stay put; only the content between them scrolls. */}
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-steel-200 px-5 py-4">
        <div className="min-w-0">
          <h2 id="modal-title" className="text-base font-semibold text-steel-900">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-steel-500">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close"
          className="-mt-1 -mr-2 shrink-0 rounded p-1.5 text-steel-500 transition-colors hover:bg-steel-100 hover:text-steel-900"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M5 5l10 10M15 5 5 15" />
          </svg>
        </button>
      </div>

      {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}

      {footer && (
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-steel-200 bg-steel-50 px-5 py-3">
          {footer}
        </div>
      )}
    </dialog>
  );
}
