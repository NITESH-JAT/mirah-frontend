import React, { useEffect, useRef, useState } from 'react';
import img1 from '../../assets/mirah_img1.png';
import img2 from '../../assets/mirah_img2.png';
import img3 from '../../assets/mirah_img3.png';

const slides = [
  {
    image: img1,
    title: 'Custom jewellery, crafted just for you',
    desc: 'Upload your jewellery idea, describe your vision, and let skilled manufacturers turn it into a timeless piece made just for you.',
  },
  {
    image: img2,
    title: 'Connect with skilled artisans',
    desc: 'Direct access to master makers who bring centuries of tradition to your modern designs.',
  },
  {
    image: img3,
    title: 'A transparent crafting process',
    desc: 'Track every step of your jewellery creation, from first sketch to final polish.',
  },
];

const AUTOPLAY_MS = 5000;
const FADE_MS = 300;

/** Desktop-only showcase beside the auth forms. Blush panel echoes the marketing site's app section. */
export default function CarouselPanel() {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const fadeTimer = useRef(null);

  const goTo = (index) => {
    if (index === active) return;
    clearTimeout(fadeTimer.current);
    setVisible(false);
    fadeTimer.current = setTimeout(() => {
      setActive(index);
      setVisible(true);
    }, FADE_MS);
  };

  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => goTo((active + 1) % slides.length), AUTOPLAY_MS);
    return () => clearTimeout(timer);
    // goTo only reads `active`, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, paused]);

  useEffect(() => () => clearTimeout(fadeTimer.current), []);

  const slide = slides[active];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Why Arviah"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative flex h-full w-full flex-col overflow-hidden rounded-[24px] border border-pale bg-[radial-gradient(circle_at_50%_38%,var(--color-white)_0%,var(--color-blush)_70%)] px-10 pb-9 pt-10"
    >
      <div
        className={`flex min-h-0 flex-1 items-center justify-center transition-all duration-300 ease-out ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        <img
          src={slide.image}
          alt=""
          className="max-h-full w-auto max-w-[85%] object-contain drop-shadow-[0_24px_40px_rgba(58,42,30,0.12)]"
        />
      </div>

      <div
        aria-live="polite"
        className={`mx-auto mt-8 max-w-[420px] shrink-0 text-center transition-all duration-300 ease-out ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        <h2 className="font-jakarta text-[26px] font-bold leading-[1.15] tracking-[-0.04em] text-ink text-balance">
          {slide.title}
        </h2>
        <p className="mt-3 font-jakarta text-[15px] leading-[1.6] text-mid">{slide.desc}</p>
      </div>

      <div className="mt-7 flex shrink-0 justify-center gap-2">
        {slides.map((s, i) => (
          <button
            key={s.title}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Show slide ${i + 1}: ${s.title}`}
            aria-current={active === i ? 'true' : undefined}
            className={`h-1.5 cursor-pointer rounded-full transition-all duration-300 ${
              active === i ? 'w-8 bg-walnut' : 'w-1.5 bg-soft hover:bg-muted'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
