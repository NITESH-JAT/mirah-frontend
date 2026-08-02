import React, { useEffect, useRef } from 'react';
import ArviahLogoRevealSvg from './arviahLogoRevealSvg';

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t) {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function animate(duration, onFrame, onDone, isCancelled) {
  const start = performance.now();
  function step(now) {
    if (isCancelled()) return;
    const t = Math.min(1, (now - start) / duration);
    onFrame(t);
    if (t < 1) requestAnimationFrame(step);
    else if (onDone) onDone();
  }
  requestAnimationFrame(step);
}

/**
 * Port of `arviah logo animation v2.html` — arch reveal → flourish → gem drop.
 * Loops while mounted so long feasibility waits stay alive.
 */
export default function ArviahLogoReveal({ className = '', loop = true, size = 180 }) {
  const rootRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    const root = rootRef.current;
    if (!root) return undefined;

    const isCancelled = () => cancelledRef.current;
    const archRect = root.querySelector('#archRect');
    const flL = root.querySelector('#flL');
    const flR = root.querySelector('#flR');
    const gem = root.querySelector('#gem');
    if (!archRect || !flL || !flR || !gem) return undefined;

    const letterBottom = 953;
    const letterLeft = 98;
    const letterRight = 1073;
    const centerX = 585.5;
    const gemStartOffset = -85;
    let loopTimer = null;

    const reset = () => {
      archRect.setAttribute('y', String(letterBottom));
      archRect.setAttribute('height', '0.1');
      flL.setAttribute('width', '0.1');
      flR.setAttribute('x', String(letterRight));
      flR.setAttribute('width', '0.1');
      gem.style.opacity = '0';
      gem.setAttribute('transform', `translate(0,${gemStartOffset})`);
    };

    const run = () => {
      if (isCancelled()) return;
      reset();

      animate(
        900,
        (t) => {
          const e = easeOutCubic(t);
          const newTop = letterBottom - e * (letterBottom - 111);
          archRect.setAttribute('y', String(newTop));
          archRect.setAttribute('height', String(letterBottom - newTop));
        },
        () => {
          animate(
            750,
            (t) => {
              const e = easeOutCubic(t);
              const lw = e * (centerX - letterLeft);
              const rw = e * (letterRight - centerX);
              flL.setAttribute('width', String(lw));
              flR.setAttribute('x', String(letterRight - rw));
              flR.setAttribute('width', String(rw));
            },
            () => {
              gem.style.opacity = '1';
              animate(
                520,
                (t) => {
                  const e = easeOutBack(t);
                  const y = gemStartOffset * (1 - e);
                  gem.setAttribute('transform', `translate(0,${y})`);
                },
                () => {
                  if (!loop || isCancelled()) return;
                  loopTimer = window.setTimeout(run, 900);
                },
                isCancelled,
              );
            },
            isCancelled,
          );
        },
        isCancelled,
      );
    };

    run();

    return () => {
      cancelledRef.current = true;
      if (loopTimer != null) window.clearTimeout(loopTimer);
    };
  }, [loop]);

  return (
    <div
      ref={rootRef}
      className={`relative mx-auto ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <ArviahLogoRevealSvg />
    </div>
  );
}
