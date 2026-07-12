import React from 'react';
import DiamondClassificationPanel from '../../components/vendor/DiamondClassificationPanel';

export default function VendorGuidelines() {
  return (
    <div className="flex min-h-[calc(100dvh-5rem)] w-full flex-col pb-8 animate-fade-in lg:min-h-[calc(100dvh-6rem)]">
      <div className="sticky top-0 z-30 isolate bg-cream -mx-4 lg:-mx-8 px-4 lg:px-8 py-4 border-b border-pale/60">
        <div className="min-w-0">
          <p className="text-[14px] md:text-[15px] font-extrabold text-ink">Diamond Quality Guidelines</p>
          <p className="mt-0.5 text-[12px] text-muted">Minimum acceptable grades when supplying stones for Arviah projects.</p>
        </div>
      </div>

      <div className="mt-6 w-full max-w-none">
        <DiamondClassificationPanel />
      </div>
    </div>
  );
}
