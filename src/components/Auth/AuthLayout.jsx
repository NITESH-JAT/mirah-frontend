import React from 'react';
import { Outlet } from 'react-router-dom';
import AfterSignupPanel from './AfterSignupPanel';
import logo from '../../assets/logo.png';

/** Header + dot-grid canvas shared by login, signup and verification (mirrors arviahstudio.com). */
export default function AuthLayout() {
  return (
    // The app locks body scrolling (dashboard panes scroll themselves), so auth pages own their scroll container.
    <div className="relative flex h-[100dvh] w-full flex-col overflow-y-auto overflow-x-hidden bg-cream font-jakarta text-mid antialiased">
      <div className="auth-dots pointer-events-none fixed inset-0" aria-hidden />

      <header className="sticky top-0 z-30 h-[60px] shrink-0 border-b border-pale bg-cream/90 backdrop-blur-md sm:h-[72px] lg:h-[60px]">
        <div className="mx-auto flex h-full w-full max-w-[1280px] items-center px-5 sm:px-8 lg:max-w-[1064px] lg:px-6">
          <a href="https://www.arviahstudio.com" className="inline-flex items-center gap-[0.55rem] text-ink" aria-label="Arviah home">
            <img src={logo} alt="" className="h-[30px] w-auto sm:h-9 lg:h-[30px]" />
            <span className="font-serif text-[1.35rem] font-bold italic leading-none tracking-[-0.03em] sm:text-[1.5rem] lg:text-[1.25rem]">
              Arviah
            </span>
          </a>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-[1280px] flex-1 px-5 pb-12 pt-5 sm:px-8 sm:pb-16 sm:pt-7 lg:max-w-[1064px] lg:grid-cols-2 lg:gap-10 lg:px-6 lg:pb-6 lg:pt-3">
        <div className="flex justify-center lg:items-start lg:py-3">
          <div className="w-full max-w-[480px] lg:max-w-[392px]">
            <Outlet />
          </div>
        </div>

        {/* Stays in view while the form scrolls; desktop only. */}
        <aside className="hidden lg:block">
          <div className="sticky top-[84px] h-[calc(100dvh-108px)] min-h-[520px]">
            <AfterSignupPanel />
          </div>
        </aside>
      </main>
    </div>
  );
}
