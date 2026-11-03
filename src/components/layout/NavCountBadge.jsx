import React from 'react';
import { badgeLabel } from '../../hooks/useNavBadges';

/** Round count bubble pinned to the top-right of a menu icon. Renders nothing for 0. */
export default function NavCountBadge({ count, label }) {
  const text = badgeLabel(count);
  if (!text) return null;
  return (
    <span
      className="pointer-events-none absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-walnut px-1 text-[10px] font-bold leading-none text-blush ring-2 ring-white"
      aria-label={label ? `${text} ${label}` : text}
    >
      {text}
    </span>
  );
}
