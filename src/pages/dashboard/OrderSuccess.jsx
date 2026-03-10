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
      <div className="rounded-2xl border border-gray-100 bg-white p-6 md:p-8">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center text-green-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <p className="mt-4 text-center text-[18px] font-extrabold text-gray-900">{title}</p>
        <p className="mt-2 text-center text-[13px] text-gray-500">{subtitle}</p>

        {orderCode || localOrderId ? (
          <div className="mt-4 text-center text-[12px] text-gray-400">
            Order: <span className="font-semibold text-gray-700">{orderCode ?? localOrderId}</span>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => navigate('/dashboard/orders')}
            className="px-5 py-3 rounded-2xl bg-primary-dark text-white text-[12px] font-bold hover:opacity-90"
          >
            Go to My Orders
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/shopping')}
            className="px-5 py-3 rounded-2xl bg-white border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50"
          >
            Continue shopping
          </button>
        </div>
      </div>
    </div>
  );
}

