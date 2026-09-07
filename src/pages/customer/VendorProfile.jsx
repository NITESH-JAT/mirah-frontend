import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { vendorService } from '../../services/vendorService';
import { SkeletonBar } from '../../components/project/VendorProjectPageSkeleton';
import ImageWithFullscreenZoom from '../../components/ImageWithFullscreenZoom';

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
  const safe = name || 'Jeweller';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(safe)}&background=0D8ABC&color=fff`;
}

function vendorNameOf(v) {
  const joined = `${v?.firstName ?? ''} ${v?.lastName ?? ''}`.trim();
  return String(v?.fullName ?? v?.vendorName ?? v?.name ?? (joined || 'Jeweller'));
}

function starRow(rating) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  const full = Math.round(r);
  return Array.from({ length: 5 }).map((_, i) => i < full);
}

function VendorProfilePageSkeleton() {
  return (
    <div className="w-full" aria-busy="true" aria-live="polite">
      <div className="rounded-2xl border border-pale bg-white p-4 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <SkeletonBar className="mt-2 h-6 w-48" />
          <SkeletonBar className="h-9 w-16 rounded-xl" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-pale bg-white p-5">
          <div className="flex items-start gap-4">
            <SkeletonBar className="h-16 w-16 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2 pt-1">
              <SkeletonBar className="h-4 w-36" />
              <SkeletonBar className="h-3 w-28" />
            </div>
          </div>
          <SkeletonBar className="mt-5 h-11 w-full rounded-2xl" />
        </div>
        <div className="rounded-2xl border border-pale bg-white p-5 lg:col-span-2">
          <SkeletonBar className="h-3 w-48" />
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-pale bg-cream p-4">
                <SkeletonBar className="h-3 w-28" />
                <SkeletonBar className="mt-3 h-6 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-pale bg-white p-5">
        <SkeletonBar className="h-3 w-40" />
        <SkeletonBar className="mt-3 h-3 w-56" />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-pale p-4">
              <div className="flex items-start gap-3">
                <SkeletonBar className="h-9 w-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2 pt-1">
                  <SkeletonBar className="h-3 w-28" />
                  <SkeletonBar className="h-2.5 w-20" />
                </div>
              </div>
              <SkeletonBar className="mt-3 h-3 w-full" />
              <SkeletonBar className="mt-2 h-3 w-[80%]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-pale p-4">
          <div className="flex items-start gap-3">
            <SkeletonBar className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2 pt-1">
              <SkeletonBar className="h-3 w-28" />
              <SkeletonBar className="h-2.5 w-20" />
            </div>
          </div>
          <SkeletonBar className="mt-3 h-3 w-full" />
          <SkeletonBar className="mt-2 h-3 w-[80%]" />
        </div>
      ))}
    </div>
  );
}

export default function VendorProfile() {
  const { addToast } = useOutletContext();
  const { vendorId } = useParams();
  const navigate = useNavigate();

  const [loadFailed, setLoadFailed] = useState(false);
  const [vendor, setVendor] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsMoreLoading, setReviewsMoreLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsMeta, setReviewsMeta] = useState({ page: 1, totalPages: 1, total: null });
  const [portfolioPage, setPortfolioPage] = useState(1);

  const abortRef = useRef(null);

  const load = useCallback(async () => {
    if (!vendorId) return;
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoadFailed(false);
    try {
      const v = await vendorService.getDetails(vendorId, { signal: ctrl.signal });
      if (abortRef.current !== ctrl) return;
      setVendor(v || null);
      setLoadFailed(!v);
      setPortfolioPage(1);
    } catch (e) {
      if (isCanceledRequest(e) || abortRef.current !== ctrl) return;
      addToast(e?.message || 'Failed to load jeweller', 'error');
      setVendor(null);
      setLoadFailed(true);
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

  const PORTFOLIO_PAGE_SIZE = 4;
  const portfolioPhotos = useMemo(() => {
    const raw = vendor?.portfolio ?? vendor?.portfolioPhotos ?? vendor?.previousWork ?? [];
    return (Array.isArray(raw) ? raw : [])
      .map((row) => ({
        id: row?.id ?? row?._id ?? null,
        imageUrl: String(row?.imageUrl ?? row?.image_url ?? row?.url ?? '').trim(),
      }))
      .filter((row) => row.imageUrl);
  }, [vendor]);
  const portfolioTotalPages = Math.max(1, Math.ceil(portfolioPhotos.length / PORTFOLIO_PAGE_SIZE));
  const safePortfolioPage = Math.min(Math.max(1, portfolioPage), portfolioTotalPages);
  const pagedPortfolioPhotos = useMemo(() => {
    const start = (safePortfolioPage - 1) * PORTFOLIO_PAGE_SIZE;
    return portfolioPhotos.slice(start, start + PORTFOLIO_PAGE_SIZE);
  }, [portfolioPhotos, safePortfolioPage]);

  const chatNow = () => {
    if (!vendorId) return;
    navigate('/customer/messages', { state: { openRecipientId: vendorId } });
  };

  const canLoadMoreReviews = (Number(reviewsMeta?.page ?? 1) || 1) < (Number(reviewsMeta?.totalPages ?? 1) || 1);
  const showSkeleton = !vendor && !loadFailed;

  return (
    <div className="w-full pb-10 animate-fade-in">
      {showSkeleton ? (
        <VendorProfilePageSkeleton />
      ) : !vendor ? (
        <div className="flex min-h-[calc(100dvh-12rem)] w-full flex-col items-center justify-center px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-pale bg-white text-muted shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <p className="mt-4 font-serif text-[22px] font-bold text-ink md:text-[24px]">Jeweller not found</p>
          <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">
            This profile isn’t available, or the link may be incorrect.
          </p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-walnut px-5 py-2.5 text-[12px] font-bold text-blush hover:opacity-90"
          >
            Go back
          </button>
        </div>
      ) : (
        <>
      <div className="bg-white rounded-2xl border border-pale p-4 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mt-2 text-[20px] md:text-[22px] font-extrabold text-ink">{name}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-3 py-2 rounded-xl bg-white border border-pale text-[12px] font-bold text-mid hover:bg-cream"
          >
            Back
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-pale p-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-pale bg-white shrink-0">
              <img src={avatarUrlFor(name)} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-extrabold text-ink truncate">{name}</p>
              <div className="mt-1 flex items-center gap-2 text-[12px] text-muted flex-wrap">
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
            className="mt-5 w-full px-4 py-3 rounded-2xl bg-walnut text-blush text-[13px] font-extrabold hover:opacity-95 inline-flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Message Jeweller
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-pale p-5 lg:col-span-2">
          <p className="text-[13px] font-extrabold text-ink">My Bidding History Record</p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-pale bg-cream p-4">
              <p className="text-[12px] text-muted">Total Projects Completed</p>
              <p className="mt-1 text-[18px] font-extrabold text-ink">{Number.isFinite(Number(completed)) ? Number(completed) : 0}</p>
            </div>
            <div className="rounded-2xl border border-pale bg-cream p-4">
              <p className="text-[12px] text-muted">Active Bids</p>
              <p className="mt-1 text-[18px] font-extrabold text-ink">{Number.isFinite(Number(activeBids)) ? Number(activeBids) : 0}</p>
            </div>
            <div className="rounded-2xl border border-pale bg-cream p-4">
              <p className="text-[12px] text-muted">On Going Project</p>
              <p className="mt-1 text-[18px] font-extrabold text-ink">{Number.isFinite(Number(ongoing)) ? Number(ongoing) : 0}</p>
            </div>
          </div>
        </div>
      </div>

      {portfolioPhotos.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-pale bg-white p-5">
          <p className="text-[13px] font-extrabold text-ink">Portfolio</p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {pagedPortfolioPhotos.map((row, idx) => (
              <div
                key={String(row.id || row.imageUrl || idx)}
                className="overflow-hidden rounded-2xl border border-pale bg-cream"
              >
                <div className="aspect-square">
                  <ImageWithFullscreenZoom
                    src={row.imageUrl}
                    alt=""
                    imageClassName="h-full w-full object-cover"
                  />
                </div>
              </div>
            ))}
          </div>
          {portfolioPhotos.length > PORTFOLIO_PAGE_SIZE ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] text-muted">
                Page <span className="font-extrabold text-ink">{safePortfolioPage}</span> of{' '}
                <span className="font-extrabold text-ink">{portfolioTotalPages}</span>
                <span className="opacity-60"> · {portfolioPhotos.length} photos</span>
              </p>
              <div className="flex items-center gap-2">
                {safePortfolioPage > 1 ? (
                  <button
                    type="button"
                    onClick={() => setPortfolioPage((p) => Math.max(1, p - 1))}
                    className="rounded-2xl border border-pale bg-white px-4 py-2 text-[12px] font-extrabold text-ink hover:bg-cream"
                  >
                    Prev
                  </button>
                ) : null}
                {safePortfolioPage < portfolioTotalPages ? (
                  <button
                    type="button"
                    onClick={() => setPortfolioPage((p) => Math.min(portfolioTotalPages, p + 1))}
                    className="rounded-2xl bg-walnut px-4 py-2 text-[12px] font-extrabold text-blush hover:opacity-95"
                  >
                    Next
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 bg-white rounded-2xl border border-pale p-5">
        <div>
          <p className="text-[13px] font-extrabold text-ink">Review and Rating</p>
          <div className="mt-2 flex items-center gap-3 text-[12px] text-muted flex-wrap">
            <span className="inline-flex items-center gap-1">
              <span className="text-amber-500">★</span> Rating: {avgRating != null ? avgRating.toFixed(1) : 'No ratings yet'}
            </span>
            <span className="opacity-60">•</span>
            <span>Reviewers: {totalReviews ?? (Array.isArray(reviews) ? reviews.length : 0)}</span>
          </div>
        </div>

        <div className="mt-4">
          {reviewsLoading ? (
            <ReviewsGridSkeleton />
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl border border-pale bg-cream p-6 text-[13px] text-mid">No reviews yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {reviews.map((r) => {
                const customer = r?.customer ?? r?.reviewer ?? r?.user ?? null;
                const reviewer = `${customer?.firstName ?? ''} ${customer?.lastName ?? ''}`.trim() || 'Customer';
                const rating = Number(r?.rating ?? r?.stars ?? NaN);
                const comment = String(r?.comment ?? r?.message ?? '').trim();
                const createdAt = r?.createdAt ?? r?.created_at ?? null;
                return (
                  <div key={String(r?.id ?? r?._id ?? reviewer ?? Math.random())} className="rounded-2xl border border-pale p-4 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden border border-pale bg-white shrink-0">
                          <img src={avatarUrlFor(reviewer)} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-extrabold text-ink truncate">{reviewer}</p>
                          {createdAt ? <p className="text-[11px] text-muted mt-0.5">{formatDate(createdAt)}</p> : null}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-0.5">
                        {starRow(rating).map((filled, idx) => (
                          <span key={idx} className={filled ? 'text-amber-500' : 'text-soft'}>
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="mt-3 text-[12px] text-mid line-clamp-4">{comment || '—'}</p>
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
                className="px-5 py-2.5 rounded-2xl border border-pale bg-white text-[12px] font-extrabold text-ink hover:bg-cream disabled:opacity-60"
              >
                {reviewsMoreLoading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
        </>
      )}
    </div>
  );
}

