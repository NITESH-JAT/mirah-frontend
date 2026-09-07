import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Centered square KYC gate shown on vendor modules that require accepted KYC.
 */
export default function VendorKycRequiredCard({
  message = 'Please complete your KYC to continue.',
}) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] w-full items-center justify-center animate-fade-in lg:min-h-[calc(100dvh-6rem)]">
      <div className="flex aspect-square w-[min(100%,22rem)] flex-col items-center justify-center rounded-2xl border border-pale bg-white p-8 text-center text-[13px] text-mid shadow-sm">
        <div className="font-semibold text-ink mb-1">KYC not accepted yet</div>
        <div>{message}</div>
        <div className="mt-5">
          <button
            type="button"
            onClick={() => navigate('/vendor/kyc')}
            className="px-5 py-2.5 rounded-xl bg-walnut text-blush text-xs font-bold shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
          >
            Go to KYC
          </button>
        </div>
      </div>
    </div>
  );
}
