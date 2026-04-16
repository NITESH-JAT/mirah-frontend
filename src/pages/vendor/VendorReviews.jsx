import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import ListPaginationBar from '../../components/customer/ListPaginationBar';
import { vendorService } from '../../services/vendorService';

function isCanceledRequest(err) {
  const e = err ?? {};
  return e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || e?.name === 'AbortError';
}

function formatReviewDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function reviewerLabel(review) {
  if (review?.isAnonymous) return 'Anonymous';
  const c = review?.customer ?? null;
  const joined = `${c?.firstName ?? ''} ${c?.lastName ?? ''}`.trim();
  const fromCustomer =
    c?.fullName ?? c?.name ?? (joined || null);
  const raw = review?.customerName ?? fromCustomer;
  return String(raw || '').trim() || 'Customer';
}

function StarRow({ rating }) {
  const r = Math.min(5, Math.max(0, Math.round(Number(rating) || 0)));
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${r} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 ${i <= r ? 'text-walnut' : 'text-pale'}`}
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

export default function VendorReviews() {
  const navigate = useNavigate();
  const { addToast } = useOutletContext();
  const abortRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: null });

  const canPrev = Number(meta?.page || 1) > 1;
  const canNext = Number(meta?.page || 1) < Number(meta?.totalPages || 1);
  const currentPage = Number(meta?.page || page) || 1;
  const totalPages = Number(meta?.totalPages || 1) || 1;

  const load = useCallback(
    async ({ nextPage = 1 } = {}) => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const res = await vendorService.listMyReviews({ page: nextPage, limit: 12, signal: ctrl.signal });
        const list = Array.isArray(res?.items) ? res.items : [];
        setItems(list);
        if (res?.meta) {
          setMeta(res.meta);
          setPage(res.meta.page || nextPage);
        } else {
          setMeta((prev) => ({ ...(prev || {}), page: nextPage }));
          setPage(nextPage);
        }
      } catch (e) {
        if (isCanceledRequest(e)) return;
        addToast(e?.message || 'Failed to load reviews', 'error');
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    load({ nextPage: page });
    return () => abortRef.current?.abort();
  }, [load, page]);

  const empty = !loading && items.length === 0;

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] w-full flex-col pb-0 animate-fade-in lg:min-h-[calc(100dvh-6rem)]">
      <div className="sticky top-0 z-30 isolate bg-cream -mx-4 lg:-mx-8 px-4 lg:px-8 py-3 border-b border-pale/60">
        <div className="flex items-center justify-between gap-4 min-w-0">
          <p className="font-sans text-[14px] md:text-[15px] font-extrabold leading-tight text-ink tracking-tight min-w-0 truncate">
            Reviews From Customers
          </p>
          <div
            className="shrink-0 inline-flex items-center gap-2 rounded-full border border-pale bg-white px-4 py-2.5 md:px-5 md:py-3 font-sans text-[12px] font-semibold text-mid tabular-nums hover:bg-cream"
            role="status"
            aria-live="polite"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" className="text-walnut shrink-0" fill="currentColor" aria-hidden>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span>Total</span>
            <span className="font-extrabold text-ink">
              {meta?.total != null ? Number(meta.total).toLocaleString('en-IN') : '—'}
            </span>
          </div>
        </div>
      </div>

      <div
        className={`mt-5 flex min-h-0 flex-1 flex-col ${
          !loading && items.length > 0 ? 'justify-between gap-4' : ''
        }`}
      >
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : empty ? (
          <div className="flex-1 flex items-center justify-center px-4 py-16">
            <div className="text-center max-w-sm">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-cream border border-pale flex items-center justify-center text-muted">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <p className="mt-4 text-[15px] font-bold text-ink">No reviews yet</p>
              <p className="mt-2 text-[12px] text-muted leading-relaxed">
                When customers complete a project and leave a rating, it will appear here.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((rev, idx) => {
                const id = rev?.id ?? rev?._id ?? `rev-${idx}`;
                const projectId = rev?.projectId ?? rev?.project_id ?? null;
                const title = String(rev?.projectTitle ?? rev?.project_title ?? 'Project').trim() || 'Project';
                const when = rev?.reviewedAt ?? rev?.reviewed_at ?? rev?.createdAt ?? rev?.created_at ?? null;
                const comment = String(rev?.comment ?? '').trim();
                const name = reviewerLabel(rev);
                return (
                  <article
                    key={String(id)}
                    className="rounded-2xl border border-pale bg-white shadow-sm overflow-hidden flex flex-col hover:border-walnut/20 transition-colors"
                  >
                    <div className="px-4 py-3 border-b border-pale/80 bg-gradient-to-r from-cream/50 to-white flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Project</p>
                        <p className="mt-0.5 text-[14px] font-extrabold text-ink truncate" title={title}>
                          {title}
                        </p>
                      </div>
                      {projectId ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/vendor/projects/${encodeURIComponent(String(projectId))}`)}
                          className="shrink-0 text-[11px] font-bold text-walnut hover:underline"
                        >
                          Open
                        </button>
                      ) : null}
                    </div>
                    <div className="p-4 flex-1 flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <StarRow rating={rev?.rating} />
                        <time className="text-[11px] text-muted tabular-nums">{formatReviewDate(when)}</time>
                      </div>
                      <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Customer</p>
                        <p className="mt-0.5 text-[13px] font-semibold text-ink">{name}</p>
                      </div>
                      {comment ? (
                        <p className="text-[13px] text-mid leading-relaxed whitespace-pre-wrap border-t border-pale/60 pt-3">
                          {comment}
                        </p>
                      ) : (
                        <p className="text-[12px] text-muted italic border-t border-pale/60 pt-3">No written comment.</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            <ListPaginationBar
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={meta?.total}
              canPrev={canPrev}
              canNext={canNext}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          </>
        )}
      </div>
    </div>
  );
}
