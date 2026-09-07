import React, { useEffect, useMemo, useState } from 'react';
import ArviahLogoReveal from '../brand/ArviahLogoReveal';

/**
 * Status lines for the Review calculating screen, based on metal / stone choices.
 */
export function buildFeasibilityStatusMessages(specs = {}) {
  const metal = String(specs?.metalType || '').trim().toLowerCase();
  const stonesYes = String(specs?.stonesIncluded || 'no').trim().toLowerCase() === 'yes';
  const stoneType = String(specs?.stoneType || '').trim().toLowerCase();
  const quality = String(specs?.stoneQualityBracket || '').trim();

  const messages = ['Analyzing your reference and design details…'];

  if (stonesYes) {
    if (stoneType.includes('lab')) {
      messages.push('Calculating lab-grown diamond specifications…');
    } else if (stoneType.includes('natural')) {
      if (quality) {
        messages.push(`Calculating ${quality.toLowerCase()} natural diamond requirements…`);
      } else {
        messages.push('Calculating natural diamond specifications…');
      }
    } else {
      messages.push('Calculating stone specifications and requirements…');
    }
  }

  if (metal === 'gold') {
    messages.push('Estimating gold weight and metal requirements…');
  } else if (metal === 'silver') {
    messages.push('Estimating silver weight and metal requirements…');
  } else if (metal === 'platinum') {
    messages.push('Estimating platinum weight and metal requirements…');
  } else if (metal === 'other') {
    messages.push('Estimating metal requirements for your finish…');
  } else if (metal) {
    messages.push(`Estimating ${metal} weight and metal requirements…`);
  }

  messages.push('Putting your estimated cost together…');
  return messages;
}

/**
 * Full-bleed Review-step calculating screen — fills parent, centered, no scroll.
 */
export default function FeasibilityCalculatingPanel({
  specs = null,
  messages: messagesProp = null,
  intervalMs = 2800,
}) {
  const messages = useMemo(() => {
    if (Array.isArray(messagesProp) && messagesProp.length) return messagesProp;
    return buildFeasibilityStatusMessages(specs || {});
  }, [messagesProp, specs]);

  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    setMsgIndex(0);
  }, [messages]);

  useEffect(() => {
    if (!messages.length) return undefined;
    const id = window.setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [messages, intervalMs]);

  return (
    <div
      className="flex h-full min-h-0 w-full max-w-full flex-1 flex-col items-center justify-center overflow-hidden bg-[#F7F1E8] px-6 py-8 text-center"
      aria-busy="true"
      aria-live="polite"
    >
      <ArviahLogoReveal size={200} loop />
      <p
        key={`${msgIndex}-${messages[msgIndex] || ''}`}
        className="mt-7 max-w-lg w-full text-[15px] sm:text-[16px] font-extrabold text-ink leading-snug animate-fade-in px-2"
      >
        {messages[msgIndex] || messages[0]}
      </p>
      <p className="mt-3 text-[12px] font-medium text-mid">Please wait a moment.</p>
    </div>
  );
}
