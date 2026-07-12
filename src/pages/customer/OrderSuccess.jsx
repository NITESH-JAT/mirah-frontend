import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function OrderSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const localOrderId = location?.state?.localOrderId ?? null;
  const orderCode = location?.state?.orderCode ?? null;
  const paymentMethod = location?.state?.paymentMethod ?? null;
  const pickupShowroom = location?.state?.pickupShowroom ?? null;

  const title =
    paymentMethod === 'offline'
      ? 'Order placed'
      : paymentMethod === 'partial'
        ? 'Payment successful'
        : 'Payment successful';

  const subtitle =
    paymentMethod === 'offline'
      ? 'Your order is confirmed. Your piece will be reserved and arranged at your selected showroom, where you can view it and complete the payment in person.'
      : paymentMethod === 'partial'
        ? 'Your online payment is successful. Your piece will be reserved at your selected showroom, where you can view it and pay the remaining amount in person.'
        : 'Your payment was verified and your order is confirmed.';

  const showroomLocation = pickupShowroom
    ? [pickupShowroom.city, pickupShowroom.country, pickupShowroom.postcode].filter(Boolean).join(', ')
    : '';

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

        {pickupShowroom ? (
          <div className="mx-auto mt-4 max-w-sm rounded-2xl border border-pale bg-cream/50 p-4 text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Pickup showroom</p>
            <p className="mt-1 text-[13px] font-bold text-ink">{pickupShowroom.name}</p>
            {pickupShowroom.address ? (
              <p className="mt-0.5 text-[12px] text-muted">{pickupShowroom.address}</p>
            ) : null}
            {showroomLocation ? <p className="mt-0.5 text-[12px] text-muted">{showroomLocation}</p> : null}
            {pickupShowroom.phone ? (
              <p className="mt-0.5 text-[12px] text-muted">{pickupShowroom.phone}</p>
            ) : null}
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

