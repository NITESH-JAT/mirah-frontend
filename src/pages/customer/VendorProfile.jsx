import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { vendorService } from '../../services/vendorService';

function isCanceledRequest(err) {
  const e = err ?? {};
  return e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || e?.name === 'AbortError';
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function avatarUrlFor(name) {
  const safe = name || 'Vendor';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(safe)}&background=0D8ABC&color=fff`;
}

function vendorNameOf(v) {
  const joined = `${v?.firstName ?? ''} ${v?.lastName ?? ''}`.trim();
  return String(v?.fullName ?? v?.vendorName ?? v?.name ?? (joined || 'Vendor'));
}

function starRow(rating) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  const full = Math.round(r);
  return Array.from({ length: 5 }).map((_, i) => i < full);
}

export default function VendorProfile() {
  const { addToast } = useOutletContext();
  const { vendorId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [vendor, setVendor] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsMoreLoading, setReviewsMoreLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsMeta, setReviewsMeta] = useState({ page: 1, totalPages: 1, total: null });

  const abortRef = useRef(null);

  const load = useCallback(async () => {
    if (!vendorId) return;
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const v = await vendorService.getDetails(vendorId, { signal: ctrl.signal });
      setVendor(v || null);
    } catch (e) {
      if (isCanceledRequest(e)) return;
      addToast(e?.message || 'Failed to load vendor', 'error');
      setVendor(null);
    } finally {
      setLoading(false);
    }
  }, [addToast, vendorId]);

  const loadReviews = useCallback(async () => {
    if (!vendorId) return;
    setReviewsLoading(true);
    try {
      const res = await vendorService.listReviews(vendorId, { page: 1, limit: 6 });
      setReviews(Array.isArray(res?.items) ? res.items : []);
      setReviewsMeta(res?.meta ?? { page: 1, totalPages: 1, total: null });
    } catch {
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [vendorId]);

  const loadMoreReviews = useCallback(async () => {
    if (!vendorId) return;
    if (reviewsMoreLoading) return;
    const curPage = Number(reviewsMeta?.page ?? 1) || 1;
    const totalPages = Number(reviewsMeta?.totalPages ?? 1) || 1;
    if (curPage >= totalPages) return;

    setReviewsMoreLoading(true);
    try {
      const nextPage = curPage + 1;
      const res = await vendorService.listReviews(vendorId, { page: nextPage, limit: 6 });
      const items = Array.isArray(res?.items) ? res.items : [];
      setReviews((prev) => [...(Array.isArray(prev) ? prev : []), ...items]);
      setReviewsMeta(res?.meta ?? { page: nextPage, totalPages, total: reviewsMeta?.total ?? null });
    } catch {
      // ignore
    } finally {
      setReviewsMoreLoading(false);
    }
  }, [vendorId, reviewsMeta, reviewsMoreLoading]);

  useEffect(() => {
    load();
    loadReviews();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [load, loadReviews]);

  const name = useMemo(() => vendorNameOf(vendor), [vendor]);
  const city = vendor?.city ?? vendor?.location?.city ?? null;
  const state = vendor?.state ?? vendor?.location?.state ?? null;
  const country = vendor?.country ?? vendor?.location?.country ?? null;
  const locationText = [city, state, country].filter(Boolean).join(', ') || '—';

  const ratingSummary = vendor?.vendorOverallProjectRating ?? vendor?.overallRating ?? vendor?.ratingSummary ?? null;
  const avgRatingRaw =
    ratingSummary?.averageRating ??
    ratingSummary?.avg ??
    vendor?.averageRating ??
    vendor?.avgRating ??
    null;
  const avgRating =
    avgRatingRaw != null && String(avgRatingRaw).trim() !== '' && Number.isFinite(Number(avgRatingRaw)) ? Number(avgRatingRaw) : null;
  const totalReviews =
    ratingSummary?.totalReviews ??
    ratingSummary?.count ??
    vendor?.totalReviews ??
    reviewsMeta?.total ??
    null;

  const stats = vendor?.stats ?? vendor?.biddingStats ?? vendor ?? {};
  const completed = stats?.totalProjectsCompleted ?? stats?.completedProjects ?? stats?.totalCompleted ?? stats?.totalProjects ?? null;
  const activeBids = stats?.activeBids ?? stats?.activeBidsCount ?? stats?.activeBidCount ?? null;
  const ongoing = stats?.onGoingProject ?? stats?.ongoingProjects ?? stats?.runningAssignments ?? stats?.runningProjects ?? null;

  const chatNow = () => {
    if (!vendorId) return;
    navigate('/customer/messages', { state: { openRecipientId: vendorId } });
  };

  const canLoadMoreReviews = (Number(reviewsMeta?.page ?? 1) || 1) < (Number(reviewsMeta?.totalPages ?? 1) || 1);

  return (
    <div className="w-full pb-10 animate-fade-in">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mt-2 text-[20px] md:text-[22px] font-extrabold text-gray-900">{loading ? 'Loading…' : name}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-3 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-gray-100 bg-white shrink-0">
              <img src={avatarUrlFor(name)} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-extrabold text-gray-900 truncate">{name}</p>
              <div className="mt-1 flex items-center gap-2 text-[12px] text-gray-500 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                  {avgRating != null ? avgRating.toFixed(1) : 'No ratings yet'}
                </span>
                <span className="truncate">{locationText}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={chatNow}
            className="mt-5 w-full px-4 py-3 rounded-2xl bg-primary-dark text-white text-[13px] font-extrabold hover:opacity-95"
          >
            Chat Now
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 lg:col-span-2">
          <p className="text-[13px] font-extrabold text-gray-900">My Bidding History Record</p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-[12px] text-gray-500">Total Projects Completed</p>
              <p className="mt-1 text-[18px] font-extrabold text-gray-900">{Number.isFinite(Number(completed)) ? Number(completed) : 0}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-[12px] text-gray-500">Active Bids</p>
              <p className="mt-1 text-[18px] font-extrabold text-gray-900">{Number.isFinite(Number(activeBids)) ? Number(activeBids) : 0}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-[12px] text-gray-500">On Going Project</p>
              <p className="mt-1 text-[18px] font-extrabold text-gray-900">{Number.isFinite(Number(ongoing)) ? Number(ongoing) : 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-5">
        <div>
          <p className="text-[13px] font-extrabold text-gray-900">Review and Rating</p>
          <div className="mt-2 flex items-center gap-3 text-[12px] text-gray-500 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <span className="text-amber-500">★</span> Rating: {avgRating != null ? avgRating.toFixed(1) : 'No ratings yet'}
            </span>
            <span className="opacity-60">•</span>
            <span>Reviewers: {totalReviews ?? (Array.isArray(reviews) ? reviews.length : 0)}</span>
          </div>
        </div>

        <div className="mt-4">
          {reviewsLoading ? (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-10 flex items-center justify-center">
              <svg className="animate-spin text-primary-dark" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-[13px] text-gray-600">No reviews yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {reviews.map((r) => {
                const customer = r?.customer ?? r?.reviewer ?? r?.user ?? null;
                const reviewer = `${customer?.firstName ?? ''} ${customer?.lastName ?? ''}`.trim() || 'Customer';
                const rating = Number(r?.rating ?? r?.stars ?? NaN);
                const comment = String(r?.comment ?? r?.message ?? '').trim();
                const createdAt = r?.createdAt ?? r?.created_at ?? null;
                return (
                  <div key={String(r?.id ?? r?._id ?? reviewer ?? Math.random())} className="rounded-2xl border border-gray-100 p-4 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden border border-gray-100 bg-white shrink-0">
                          <img src={avatarUrlFor(reviewer)} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-extrabold text-gray-900 truncate">{reviewer}</p>
                          {createdAt ? <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(createdAt)}</p> : null}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-0.5">
                        {starRow(rating).map((filled, idx) => (
                          <span key={idx} className={filled ? 'text-amber-500' : 'text-gray-200'}>
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="mt-3 text-[12px] text-gray-600 line-clamp-4">{comment || '—'}</p>
                  </div>
                );
              })}
            </div>
          )}

          {!reviewsLoading && reviews.length > 0 && canLoadMoreReviews ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={loadMoreReviews}
                disabled={reviewsMoreLoading}
                className="px-5 py-2.5 rounded-2xl border border-gray-200 bg-white text-[12px] font-extrabold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
              >
                {reviewsMoreLoading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

