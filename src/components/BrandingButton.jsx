import { useState } from 'react';
import Can from './Can';
import BrandingDialog from './BrandingDialog';

const TONES = {
  header: 'text-steel-500 hover:bg-steel-100 hover:text-steel-900',
  nav: 'text-nav-300 hover:bg-white/10 hover:text-white',
};

export default function BrandingButton({ tone = 'header', className = '' }) {
  const [open, setOpen] = useState(false);

  return (
    <Can resource="BRANDING" action="UPDATE">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Customize logo and title"
        title="Customize logo and title"
        className={`rounded p-1.5 transition-colors ${TONES[tone]} ${className}`}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13.5 3.5a2.1 2.1 0 0 1 3 3L7 16l-4 1 1-4 9.5-9.5Z" />
          <path d="m12 5 3 3" />
        </svg>
      </button>
      <BrandingDialog open={open} onClose={() => setOpen(false)} />
    </Can>
  );
}
