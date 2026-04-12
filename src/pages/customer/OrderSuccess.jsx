import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function OrderSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const localOrderId = location?.state?.localOrderId ?? null;
  const orderCode = location?.state?.orderCode ?? null;
  const paymentMethod = location?.state?.paymentMethod ?? null;

  const title =
    paymentMethod === 'offline'
      ? 'Order placed'
      : paymentMethod === 'partial'
        ? 'Payment successful'
        : 'Payment successful';

  const subtitle =
    paymentMethod === 'offline'
      ? 'Your order is created. Please pay offline as per instructions from seller.'
      : paymentMethod === 'partial'
        ? 'Your online payment is successful. Remaining amount will be collected offline as per instructions from seller.'
        : 'Your payment was verified and your order is confirmed.';

  return (
    <div className="w-full animate-fade-in">
      <div className="rounded-2xl border border-pale bg-white p-6 md:p-8">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center text-green-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <p className="mt-4 text-center text-[18px] font-extrabold text-ink">{title}</p>
        <p className="mt-2 text-center text-[13px] text-muted">{subtitle}</p>

        {orderCode || localOrderId ? (
          <div className="mt-4 text-center text-[12px] text-muted">
            Order: <span className="font-semibold text-mid">{orderCode ?? localOrderId}</span>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => navigate('/customer/orders')}
            className="px-5 py-3 rounded-2xl bg-walnut text-blush text-[12px] font-bold hover:opacity-90"
          >
            Go to My Orders
          </button>
          <button
            type="button"
            onClick={() => navigate('/customer/shopping')}
            className="px-5 py-3 rounded-2xl bg-white border border-pale text-[12px] font-bold text-mid hover:bg-cream"
          >
            Continue shopping
          </button>
        </div>
      </div>
    </div>
  );
}

