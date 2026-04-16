import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import SafeImage from './SafeImage';

function ZoomInIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
      <path d="M11 8v6M8 11h6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/**
 * Renders an image with a top-right zoom control; opens a borderless fullscreen viewer (native img).
 */
export default function ImageWithFullscreenZoom({ src, alt = '', imageClassName = '', loading }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!src || String(src).trim() === '') return null;

  const overlay = open
    ? createPortal(
        <div
          className="fixed inset-0 z-[220] bg-black"
          role="dialog"
          aria-modal="true"
          aria-label="Full size image"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
          <div
            className="absolute inset-0 flex items-center justify-center p-4 pt-16"
            onClick={() => setOpen(false)}
          >
            <img
              src={src}
              alt={alt || 'Image'}
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div className="relative h-full w-full min-h-0">
        <SafeImage src={src} alt={alt} className={imageClassName} loading={loading} />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          className="absolute top-2 right-2 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-pale bg-white/95 text-ink shadow-sm transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-walnut/40"
          aria-label="View full size"
        >
          <ZoomInIcon />
        </button>
      </div>
      {overlay}
    </>
  );
}
