import React, { useCallback, useEffect, useMemo, useState } from 'react';

function normalizeSrc(src) {
  const s = typeof src === 'string' ? src.trim() : '';
  return s ? s : null;
}

function buildPlaceholderDataUri() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180">
      <rect width="240" height="180" rx="16" fill="#F3F4F6"/>
      <rect x="44" y="38" width="152" height="104" rx="14" fill="#FFFFFF" stroke="#E5E7EB" stroke-width="2"/>
      <circle cx="86" cy="74" r="10" fill="#D1D5DB"/>
      <path d="M64 128l42-46 24 26 18-18 28 38H64z" fill="#D1D5DB"/>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const PLACEHOLDER = buildPlaceholderDataUri();

export default function SafeImage({ src, alt = '', onError, ...props }) {
  const desiredSrc = useMemo(() => normalizeSrc(src) || PLACEHOLDER, [src]);
  const [currentSrc, setCurrentSrc] = useState(desiredSrc);

  useEffect(() => {
    setCurrentSrc(desiredSrc);
  }, [desiredSrc]);

  const handleError = useCallback(
    (e) => {
      if (typeof onError === 'function') onError(e);
      // If already on placeholder, avoid loops.
      if (currentSrc === PLACEHOLDER) return;
      setCurrentSrc(PLACEHOLDER);
    },
    [currentSrc, onError],
  );

  return <img src={currentSrc} alt={alt} onError={handleError} {...props} />;
}

