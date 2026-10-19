import React, { useId } from 'react';

const SKIN = '#F4C7A8';
const SHADE = '#E6B08A';

export const PROFILE_AVATARS = [
  { id: 'luna', label: 'Luna', bg: '#F7E7EB', hair: '#3C2C26', shirt: '#8E3F55', trim: '#6A1B31', hairStyle: 'long' },
  { id: 'milo', label: 'Milo', bg: '#E7F1F8', hair: '#3E2C22', shirt: '#3D7EBE', trim: '#195A9A', hairStyle: 'part' },
  { id: 'nova', label: 'Nova', bg: '#7EC8EE', hair: '#2A2A2A', shirt: '#C44738', trim: '#A02314', hairStyle: 'bun' },
  { id: 'kai', label: 'Kai', bg: '#ECEFF5', hair: '#221C18', shirt: '#3A4C70', trim: '#16284C', hairStyle: 'crop' },
  { id: 'aria', label: 'Aria', bg: '#F4EFE7', hair: '#34282C', shirt: '#6B4A86', trim: '#472662', hairStyle: 'bob' },
  { id: 'leo', label: 'Leo', bg: '#E4F1E7', hair: '#5C4334', shirt: '#2F6E4C', trim: '#0B4A28', hairStyle: 'short' },
];

const BY_ID = Object.fromEntries(PROFILE_AVATARS.map((a) => [a.id, a]));

export function avatarIdFromValue(value, seed = '') {
  const raw = String(value || '').trim();
  const id = raw.startsWith('preset:') ? raw.slice('preset:'.length) : raw;
  if (BY_ID[id]) return id;
  const s = String(seed || 'arviah');
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return PROFILE_AVATARS[hash % PROFILE_AVATARS.length].id;
}

function Crew({ color }) {
  return <path d="M-8 120 V66 C16 54 32 52 43 62 C47 66.5 48.6 70 50 72 C51.4 70 53 66.5 57 62 C68 52 84 54 108 66 V120 Z" fill={color} />;
}

function VNeck({ color, trim }) {
  return (
    <>
      <path d="M-8 120 V64 C18 52 34 50 44 60 L50 70 L56 60 C66 50 82 52 108 64 V120 Z" fill={color} />
      <path d="M45 60 L50 68.5 L55 60 L53.2 58.6 L50 63.6 L46.8 58.6 Z" fill={trim} />
    </>
  );
}

function Neck() {
  return (
    <>
      <path d="M45.5 58 H54.5 L56 71 Q50 75.5 44 71 Z" fill={SKIN} />
      <path d="M51 59.2 H54.4 L55.6 70.4 Q52.4 73.2 50.2 72.2 Q51.8 66 51 59.2 Z" fill={SHADE} />
    </>
  );
}

function Ears() {
  return (
    <>
      <ellipse cx="30" cy="46" rx="4.2" ry="5.8" fill={SKIN} />
      <ellipse cx="70" cy="46" rx="4.2" ry="5.8" fill={SKIN} />
    </>
  );
}

function FaceMale({ top }) {
  return <path d={`${top} L68.5 52 C69.5 62 65.5 70 58.5 74 C53 77 47 77 41.5 74 C34.5 70 30.5 62 31.5 52 Z`} fill={SKIN} />;
}

function HairCap({ color, rx, ry, cy }) {
  const side = 50 - rx;
  const right = 50 + rx;
  return (
    <>
      <ellipse cx="50" cy={cy} rx={rx} ry={ry} fill={color} />
      <path d={`M${side + 2} 34 H${side + 8} V48 Q${side + 5} 53 ${side + 2} 48 Z`} fill={color} />
      <path d={`M${right - 8} 34 H${right - 2} V48 Q${right - 5} 53 ${right - 8} 48 Z`} fill={color} />
    </>
  );
}

function HairBun({ color }) {
  return (
    <>
      <circle cx="50" cy="13" r="7.2" fill={color} />
      <ellipse cx="50" cy="31" rx="18" ry="15" fill={color} />
      <path d="M36 30 C26 32 18 42 18 54 C18 62 13 67 9 64 C15 71 26 66 29 58 C32 50 34 40 41 32 Z" fill={color} />
      <path d="M64 30 C74 33 82 44 82 56 C82 64 87 68 91 65 C85 71 74 66 71 58 C68 50 66 40 59 32 Z" fill={color} />
    </>
  );
}

function HairLong({ color }) {
  return (
    <>
      <ellipse cx="50" cy="31" rx="18" ry="15" fill={color} />
      <path d="M34 30 C22 36 16 50 17 68 C18 86 14 100 10 118 L27 118 C29 98 32 82 37 68 C41 54 39 40 45 32 Z" fill={color} />
      <path d="M66 30 C78 36 84 50 83 68 C82 86 86 100 90 118 L73 118 C71 98 68 82 63 68 C59 54 61 40 55 32 Z" fill={color} />
    </>
  );
}

function HairBob({ color }) {
  return <path d="M28 56 C28 30 36 16 50 16 C64 16 72 30 72 56 C72 74 64 84 56 86 C53 76 51.5 70 50 70 C48.5 70 47 76 44 86 C36 84 28 74 28 56 Z" fill={color} />;
}

function FaceFrame() {
  return <path d="M40 40 C40.2 31 44.5 27 50 27.4 C55.5 27 59.8 31 60 40 L61 54 C61 64 56.4 69 50 69 C43.6 69 39 64 39 54 Z" fill={SKIN} />;
}

function FaceBob() {
  return <path d="M38 40 C38 30 43 25 50 25 C57 25 62 30 62 40 L62.5 56 C62.5 68 57.2 74 50 74 C42.8 74 37.5 68 37.5 56 Z" fill={SKIN} />;
}

function Portrait({ avatar }) {
  const formal = avatar.hairStyle === 'bun' || avatar.hairStyle === 'long' || avatar.hairStyle === 'bob';
  return (
    <>
      {formal ? <VNeck color={avatar.shirt} trim={avatar.trim} /> : <Crew color={avatar.shirt} />}
      <Neck />
      {formal ? null : <Ears />}
      {avatar.hairStyle === 'part' ? <HairCap color={avatar.hair} rx={22} ry={20} cy={32} /> : null}
      {avatar.hairStyle === 'short' ? <HairCap color={avatar.hair} rx={21} ry={18} cy={33} /> : null}
      {avatar.hairStyle === 'crop' ? <HairCap color={avatar.hair} rx={18} ry={15} cy={34} /> : null}
      {avatar.hairStyle === 'bun' ? <HairBun color={avatar.hair} /> : null}
      {avatar.hairStyle === 'long' ? <HairLong color={avatar.hair} /> : null}
      {avatar.hairStyle === 'bob' ? <HairBob color={avatar.hair} /> : null}
      {avatar.hairStyle === 'part' ? <FaceMale top="M32 48 C33 36 40 28 48 30 C57 26 64 32 68 42" /> : null}
      {avatar.hairStyle === 'short' ? <FaceMale top="M32 46 C33 33 41 26 50 26 C59 26 67 33 68 46" /> : null}
      {avatar.hairStyle === 'crop' ? <FaceMale top="M31 46 C32 32 40 26 50 26 C60 26 68 32 69 46" /> : null}
      {avatar.hairStyle === 'bun' || avatar.hairStyle === 'long' ? <FaceFrame /> : null}
      {avatar.hairStyle === 'bob' ? <FaceBob /> : null}
    </>
  );
}

export default function PresetAvatar({ profileImageUrl, seed, avatarId, className = '', label }) {
  const clipId = useId().replace(/:/g, '');
  const id = avatarId || avatarIdFromValue(profileImageUrl, seed);
  const avatar = BY_ID[id] || PROFILE_AVATARS[0];

  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={label || avatar.label}>
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <circle cx="50" cy="50" r="50" fill={avatar.bg} />
        <Portrait avatar={avatar} />
      </g>
    </svg>
  );
}
