import React from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';

export default function Checkout() {
  const { addToast } = useOutletContext();
  const navigate = useNavigate();
  const location = useLocation();
  const productIds = location?.state?.productIds ?? [];

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-gray-100 text-gray-600 hover:bg-gray-50"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex-1">
          <p className="text-[16px] font-bold text-gray-900">Checkout</p>
          <p className="text-[12px] text-gray-400 mt-1">
            Selected items: {Array.isArray(productIds) ? productIds.length : 0}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-[13px] text-gray-600">
        Checkout UI will be implemented next (addresses + payment). For now, your selected cart items are saved for the next step.
        <button
          type="button"
          onClick={() => addToast('Checkout coming next', 'success')}
          className="mt-4 inline-flex px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
        >
          Ok
        </button>
      </div>
    </div>
  );
}

