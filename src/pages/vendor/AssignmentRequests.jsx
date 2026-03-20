import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';

function isCanceledRequest(err) {
  const e = err ?? {};
  return e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || e?.name === 'AbortError';
}

function toTitleCase(text) {
  return String(text || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function projectOf(row) {
  return row?.project ?? row?.projectDetails ?? row?.projectModel ?? row?.projectSnapshot ?? row?.data?.project ?? null;
}

function assignmentOf(row) {
  return row?.assignment ?? row?.assignmentRequest ?? row?.data?.assignment ?? row ?? null;
}

function customerNameOf(project, row) {
  const p = project ?? {};
  const r = row ?? {};
  const c = p?.customerSummary ?? p?.customer ?? r?.customerSummary ?? r?.customer ?? r?.data?.customerSummary ?? null;
  const joined = `${c?.firstName ?? ''} ${c?.lastName ?? ''}`.trim();
  const name = c?.fullName ?? c?.name ?? joined ?? null;
  const trimmed = typeof name === 'string' ? name.trim() : name;
  return trimmed ? trimmed : null;
}

function assignmentIdOf(a) {
  return a?.id ?? a?._id ?? a?.assignmentId ?? a?.assignment_id ?? null;
}

function myProjectsIcon() {
  // Same icon as customer "My Projects" in Sidebar
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
    </svg>
  );
}

export default function VendorAssignmentRequests() {
  const navigate = useNavigate();
  const { addToast } = useOutletContext();
  const { user } = useAuth();

  const isVendor = user?.userType === 'vendor' || user?.userType === 'jeweller';
  const vendorKycStatus = String(user?.kyc?.status ?? user?.kycStatus ?? user?.kyc_status ?? '').toLowerCase();
  const kycAccepted = vendorKycStatus === 'accepted';

  const abortRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: null });
  const [search, setSearch] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState(null); // 'accept' | 'reject'
  const [confirmRow, setConfirmRow] = useState(null);
  const [actingId, setActingId] = useState(null);

  const load = useCallback(
    async ({ nextPage = 1, append = false } = {}) => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      if (append) setMoreLoading(true);
      else setLoading(true);
      try {
        const res = await projectService.listAssignments({ page: nextPage, limit: 24, signal: ctrl.signal });
        const list = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setItems((prev) => {
          if (!append) return list;
          const existing = Array.isArray(prev) ? prev : [];
          const seen = new Set(existing.map((x) => String(assignmentIdOf(assignmentOf(x)) ?? '')));
          const merged = [...existing];
          for (const row of list) {
            const id = String(assignmentIdOf(assignmentOf(row)) ?? '');
            if (!id || seen.has(id)) continue;
            seen.add(id);
            merged.push(row);
          }
          return merged;
        });
        if (res?.meta) {
          setMeta({
            page: res.meta.page ?? nextPage,
            totalPages: res.meta.totalPages ?? 1,
            total: res.meta.total ?? null,
          });
        } else {
          setMeta((prev) => ({ ...(prev || {}), page: nextPage }));
        }
      } catch (e) {
        if (isCanceledRequest(e)) return;
        addToast(e?.message || 'Failed to load assignment requests', 'error');
        if (!append) setItems([]);
      } finally {
        if (append) setMoreLoading(false);
        else setLoading(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  const rows = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    const base = Array.isArray(items) ? items : [];
    if (!q) return base;
    return base.filter((r) => {
      const p = projectOf(r);
      const a = assignmentOf(r);
      const title = String(p?.title ?? p?.name ?? '').toLowerCase();
      const customer = String(customerNameOf(p, r) ?? '').toLowerCase();
      const status = String(a?.status ?? '').toLowerCase();
      return title.includes(q) || customer.includes(q) || status.includes(q);
    });
  }, [items, search]);

  const openConfirm = (type, row) => {
    const a = assignmentOf(row);
    const id = assignmentIdOf(a);
    if (!id) return;
    setConfirmType(type);
    setConfirmRow(row);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (actingId) return;
    setConfirmOpen(false);
    setConfirmType(null);
    setConfirmRow(null);
  };

  const confirmAction = async () => {
    const row = confirmRow;
    const a = assignmentOf(row);
    const id = assignmentIdOf(a);
    if (!id || !confirmType || actingId) return;
    setActingId(String(id));
    try {
      if (confirmType === 'accept') {
        await projectService.acceptAssignment(id);
        addToast('Assignment accepted.', 'success');
      } else {
        await projectService.rejectAssignment(id);
        addToast('Assignment rejected.', 'success');
      }
      closeConfirm();
      await load({ nextPage: 1, append: false });
    } catch (e) {
      addToast(e?.message || 'Action failed', 'error');
    } finally {
      setActingId(null);
    }
  };

  if (!isVendor) {
    return (
      <div className="w-full pb-10 animate-fade-in">
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-[13px] text-gray-600">
          This page is available for vendors only.
        </div>
      </div>
    );
  }

  if (!kycAccepted) {
    return (
      <div className="w-full pb-10 animate-fade-in">
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-[13px] text-gray-600">
          <div className="font-semibold text-gray-900 mb-1">KYC not accepted yet</div>
          <div>Please complete your KYC to access assignments.</div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => navigate('/vendor/kyc')}
              className="px-5 py-2.5 rounded-xl bg-primary-dark text-white text-xs font-bold shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
            >
              Go to KYC
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Assignments should be visible regardless of selling approval.

  const empty = !loading && rows.length === 0;
  const canLoadMore = !loading && !empty && meta.page < meta.totalPages;

  return (
    <div className="w-full pb-10 animate-fade-in">
      <div className="sticky top-0 z-30 isolate bg-[#F8F9FA] -mx-4 lg:-mx-8 px-4 lg:px-8 pt-2 pb-4 border-b border-gray-100/60">
        <div className="flex items-center justify-between gap-3">
          <div className="relative w-full md:w-[420px] max-w-full">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search by project, customer, or status…'
              className="w-full bg-white border border-gray-100 rounded-2xl pl-11 pr-4 py-3 text-[13px] font-medium focus:outline-none focus:border-primary-dark"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="shrink-0 px-3 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="mt-5 min-h-[calc(100vh-260px)] flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <svg className="animate-spin text-primary-dark" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : empty ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-300">
                {myProjectsIcon()}
              </div>
              <p className="mt-3 text-[14px] font-bold text-gray-900">No assignment requests yet</p>
              <p className="mt-1 text-[12px] text-gray-500">When customers assign you a project, it’ll appear here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r, idx) => {
              const p = projectOf(r) || {};
              const a = assignmentOf(r) || {};
              const id = assignmentIdOf(a) ?? idx;
              const status = String(a?.status ?? '').trim().toLowerCase() || 'pending';
              const statusText = status === 'reassigned' ? 'Overridden' : toTitleCase(status);
              const isPending = status === 'pending';
              const isAccepted = status === 'accepted';
              const isRejected = status === 'rejected';
              const customerName = customerNameOf(p, r);
              const when =
                a?.createdAt ??
                a?.created_at ??
                a?.assignedAt ??
                a?.assigned_at ??
                a?.updatedAt ??
                a?.updated_at ??
                null;

              const statusClass =
                isAccepted
                  ? 'bg-green-50 border-green-100 text-green-700'
                  : isRejected
                    ? 'bg-red-50 border-red-100 text-red-700'
                    : status === 'reassigned'
                      ? 'bg-gray-50 border-gray-100 text-gray-700'
                      : 'bg-amber-50 border-amber-100 text-amber-700';

              const busy = actingId != null && String(actingId) === String(id);

              return (
                <div key={String(id)} className="rounded-2xl border border-gray-100 bg-white p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-bold text-gray-900 truncate max-w-[90vw] sm:max-w-none">
                          {p?.title || p?.name || 'Project'}
                        </p>
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${statusClass}`}>
                          {statusText}
                        </span>
                      </div>
                      {customerName ? (
                        <p className="mt-1 text-[12px] text-gray-500">
                          Customer: <span className="font-semibold text-gray-700">{customerName}</span>
                        </p>
                      ) : null}
                      {/* Mobile timestamp */}
                      {when ? (
                        <p className="mt-1 text-[12px] text-gray-400 sm:hidden">
                          {new Date(when).toLocaleString()}
                        </p>
                      ) : null}
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2">
                      {/* Desktop timestamp */}
                      {when ? (
                        <p className="hidden sm:block text-[12px] text-gray-400 text-right">
                          {new Date(when).toLocaleString()}
                        </p>
                      ) : null}
                      {isPending ? (
                        <div className="flex flex-row items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openConfirm('reject', r)}
                            disabled={busy}
                            className="px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-[12px] font-extrabold text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => openConfirm('accept', r)}
                            disabled={busy}
                            className="px-4 py-2 rounded-xl border border-green-200 bg-green-50 text-[12px] font-extrabold text-green-700 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Accept
                          </button>
                        </div>
                      ) : isAccepted ? (
                        <button
                          type="button"
                          onClick={() => {
                            const projectId = p?.id ?? p?._id ?? a?.projectId ?? a?.project_id ?? null;
                            if (!projectId) return;
                            navigate(`/vendor/projects/${projectId}`);
                          }}
                          className="px-4 py-2 rounded-xl bg-primary-dark text-white text-[12px] font-extrabold hover:opacity-90"
                        >
                          Manage Project
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}

            {canLoadMore ? (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => load({ nextPage: (meta.page || 1) + 1, append: true })}
                  disabled={moreLoading}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-2xl border border-gray-100 bg-white text-[12px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {moreLoading ? 'Loading…' : 'Load more'}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={closeConfirm}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-gray-900">
                  {confirmType === 'accept' ? 'Accept Assignment' : 'Reject Assignment'}
                </p>
                <p className="mt-1 text-[12px] text-gray-500">
                  {confirmType === 'accept'
                    ? 'You will be marked as the assigned Jeweller for this project.'
                    : 'You will decline this assignment request.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeConfirm}
                disabled={Boolean(actingId)}
                className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer disabled:opacity-60"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeConfirm}
                  disabled={Boolean(actingId)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-[12px] font-extrabold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Keep
                </button>
                <button
                  type="button"
                  onClick={confirmAction}
                  disabled={Boolean(actingId)}
                  className={`px-4 py-2.5 rounded-xl text-[12px] font-extrabold disabled:opacity-50 disabled:cursor-not-allowed ${
                    confirmType === 'accept'
                      ? 'border border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                      : 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                  }`}
                >
                  {actingId ? (confirmType === 'accept' ? 'Accepting…' : 'Rejecting…') : (confirmType === 'accept' ? 'Accept' : 'Reject')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

