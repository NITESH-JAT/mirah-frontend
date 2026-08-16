import React, { useCallback, useEffect, useRef, useState } from 'react';
import { vendorService } from '../../services/vendorService';
import ImageWithFullscreenZoom from '../ImageWithFullscreenZoom';

function photoUrlOf(row) {
  return String(row?.imageUrl ?? row?.image_url ?? row?.url ?? '').trim();
}

function photoIdOf(row) {
  return row?.id ?? row?._id ?? null;
}

export default function VendorPortfolioPanel({ addToast }) {
  const inputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [max, setMax] = useState(24);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);

  const load = useCallback(async ({ signal } = {}) => {
    setLoading(true);
    try {
      const res = await vendorService.listMyPortfolio({ signal });
      if (signal?.aborted) return;
      setItems(Array.isArray(res?.items) ? res.items : []);
      if (Number.isFinite(Number(res?.max)) && Number(res.max) > 0) setMax(Number(res.max));
    } catch (e) {
      if (signal?.aborted || e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.name === 'AbortError') {
        return;
      }
      addToast?.(e?.message || 'Failed to load portfolio', 'error');
      setItems([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    const ctrl = new AbortController();
    load({ signal: ctrl.signal });
    return () => ctrl.abort();
  }, [load]);

  const atMax = items.length >= max;

  const onPickFiles = async (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f && String(f.type || '').startsWith('image/'));
    e.target.value = '';
    if (!files.length) return;
    if (atMax) {
      addToast?.(`You can upload up to ${max} photos`, 'error');
      return;
    }
    const remaining = Math.max(0, max - items.length);
    const batch = files.slice(0, remaining);
    if (files.length > remaining) {
      addToast?.(`Only ${remaining} more photo${remaining === 1 ? '' : 's'} can be added`, 'error');
    }
    setUploading(true);
    let added = 0;
    try {
      for (const file of batch) {
        await vendorService.uploadPortfolioPhoto(file);
        added += 1;
      }
      if (added) addToast?.(`${added} photo${added === 1 ? '' : 's'} added`, 'success');
      await load();
    } catch (err) {
      addToast?.(err?.message || 'Failed to upload photo', 'error');
      await load();
    } finally {
      setUploading(false);
    }
  };

  const closeRemoveModal = () => {
    if (deletingId) return;
    setRemoveTarget(null);
  };

  const confirmRemovePhoto = async () => {
    const id = photoIdOf(removeTarget);
    if (!id || deletingId) return;
    setDeletingId(id);
    try {
      await vendorService.deletePortfolioPhoto(id);
      setItems((prev) => prev.filter((x) => String(photoIdOf(x)) !== String(id)));
      setRemoveTarget(null);
      addToast?.('Photo removed', 'success');
    } catch (err) {
      addToast?.(err?.message || 'Failed to remove photo', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-pale bg-white p-5 shadow-sm lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-sans text-lg font-bold text-ink">Portfolio</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            Photos of your previous work. These appear on your public profile for clients. No titles or prices.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || atMax}
          className="shrink-0 cursor-pointer rounded-full bg-walnut px-4 py-2 text-[12px] font-extrabold text-blush hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : atMax ? 'Limit reached' : 'Add photos'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={onPickFiles}
        />
      </div>

      {loading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-pale" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-pale bg-cream px-6 py-12 text-center">
          <p className="text-[13px] font-bold text-ink">No photos yet</p>
          <p className="mt-1 text-[12px] text-muted">Add photos of finished pieces you’ve made.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((row) => {
            const src = photoUrlOf(row);
            const id = photoIdOf(row);
            if (!src) return null;
            return (
              <div key={String(id || src)} className="group relative overflow-hidden rounded-2xl border border-pale bg-cream">
                <div className="aspect-square">
                  <ImageWithFullscreenZoom
                    src={src}
                    alt=""
                    imageClassName="h-full w-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setRemoveTarget(row)}
                  disabled={Boolean(deletingId)}
                  className="absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-pale bg-white/95 text-mid shadow-sm hover:bg-white hover:text-ink disabled:opacity-50"
                  aria-label="Remove photo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[11px] text-muted">
        {items.length}/{max} photos
      </p>

      {removeTarget ? (
        <div
          className="fixed inset-0 z-[120] bg-ink/30 flex items-end sm:items-center justify-center px-3 sm:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={closeRemoveModal}
        >
          <div
            className="relative w-full max-w-[22rem] bg-white rounded-t-[1.75rem] sm:rounded-[1.75rem] border border-pale shadow-sm px-6 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-9"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-portfolio-photo-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeRemoveModal}
              disabled={Boolean(deletingId)}
              className="absolute right-3 top-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-cream hover:text-ink disabled:opacity-50"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>

            {photoUrlOf(removeTarget) ? (
              <div className="mx-auto mb-5 h-28 w-28 overflow-hidden rounded-2xl border border-pale bg-cream shadow-sm">
                <img
                  src={photoUrlOf(removeTarget)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}

            <div className="text-center">
              <h2
                id="remove-portfolio-photo-title"
                className="font-serif text-[22px] font-semibold leading-tight text-ink"
              >
                Remove this photo?
              </h2>
              <p className="mx-auto mt-2 max-w-[16rem] text-[13px] leading-relaxed text-muted">
                It will no longer appear on your public profile for clients.
              </p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={closeRemoveModal}
                disabled={Boolean(deletingId)}
                className="cursor-pointer rounded-full border border-pale bg-white px-5 py-2.5 text-[12px] font-extrabold text-mid hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
              >
                Keep photo
              </button>
              <button
                type="button"
                onClick={confirmRemovePhoto}
                disabled={Boolean(deletingId)}
                className="cursor-pointer rounded-full bg-walnut px-5 py-2.5 text-[12px] font-extrabold text-blush hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId ? 'Removing…' : 'Remove photo'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
