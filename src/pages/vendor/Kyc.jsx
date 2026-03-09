import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { kycService } from '../../services/kycService';

function toTitleCase(text) {
  return String(text || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function getFieldKey(field) {
  return field.fieldName || field.name || field.key || field.id;
}

function getFieldLabel(field) {
  return field.label || field.displayName || field.title || toTitleCase(getFieldKey(field));
}

function getAcceptString(field) {
  if (field?.accept) return String(field.accept);

  const attachmentType = String(field?.attachmentType || '').toLowerCase().trim();
  if (attachmentType) {
    if (attachmentType === 'pdf' || attachmentType === 'application/pdf') return 'application/pdf';
    if (attachmentType === 'image' || attachmentType === 'images') return 'image/*';
    if (attachmentType === 'jpg' || attachmentType === 'jpeg') return 'image/jpeg';
    if (attachmentType === 'png') return 'image/png';
    if (attachmentType === 'webp') return 'image/webp';
  }

  const mimeTypes = field?.mimeTypes || field?.fileTypes;
  if (Array.isArray(mimeTypes) && mimeTypes.length) return mimeTypes.join(',');

  return undefined;
}

function getFilenameFromUrlOrKey(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const path = url.pathname || '';
    return decodeURIComponent(path.split('/').filter(Boolean).pop() || '');
  } catch {
    // not a valid URL; treat as path/key
    const cleaned = raw.split('?')[0].split('#')[0];
    return decodeURIComponent(cleaned.split('/').filter(Boolean).pop() || cleaned);
  }
}

function getFieldType(field) {
  const t = String(field.type || field.inputType || field.fieldType || field.component || '').toLowerCase();

  // Heuristics for upload fields (backend configs vary)
  const validationType = String(field?.validation?.type || field?.validation?.kind || '').toLowerCase();
  const hasUploadHints =
    Boolean(field?.acceptsAttachment) ||
    Boolean(field?.accept) ||
    Boolean(field?.mimeTypes) ||
    Boolean(field?.fileTypes) ||
    Boolean(field?.maxFileSize) ||
    Boolean(field?.maxSize) ||
    Boolean(field?.upload) ||
    Boolean(field?.isFile) ||
    Boolean(field?.isDocument);

  if (
    t.includes('file') ||
    t.includes('upload') ||
    t.includes('image') ||
    t.includes('document') ||
    validationType.includes('file') ||
    validationType.includes('document') ||
    hasUploadHints
  ) {
    return 'file';
  }

  if (t.includes('select') || t.includes('dropdown')) return 'select';
  if (t.includes('email')) return 'email';
  if (t.includes('number') || t.includes('numeric')) return 'number';
  return 'text';
}

function getSectionOrder(fields = []) {
  const first = fields[0];
  return typeof first?.sectionOrder === 'number'
    ? first.sectionOrder
    : typeof first?.order === 'number'
      ? first.order
      : 9999;
}

export default function Kyc() {
  const { addToast } = useOutletContext();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(true);
  const [savingSection, setSavingSection] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingByField, setUploadingByField] = useState({});

  const [fieldsBySection, setFieldsBySection] = useState({});
  const [kycStatus, setKycStatus] = useState(null);

  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [formBySection, setFormBySection] = useState({});
  const [missingFields, setMissingFields] = useState([]);

  const [country, setCountry] = useState('IN');

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      // backend expects ISO like "IN"
      const explicitIso = user?.country || user?.kyc?.country;
      if (explicitIso && String(explicitIso).length === 2) {
        const iso = String(explicitIso).toUpperCase();
        if (!cancelled) setCountry((prev) => (prev === iso ? prev : iso));
        return;
      }

      const rawDial = user?.countryCode;
      if (!rawDial) {
        if (!cancelled) setCountry((prev) => (prev === 'IN' ? prev : 'IN'));
        return;
      }

      const normalizedDial = String(rawDial).trim().startsWith('+')
        ? String(rawDial).trim()
        : `+${String(rawDial).trim()}`;

      try {
        const response = await authService.getCountryCodes();
        const data = Array.isArray(response) ? response : (response?.data || []);
        const match = data.find((c) => String(c?.phoneCode || '').trim() === normalizedDial);
        const iso = match?.countryCode ? String(match.countryCode).toUpperCase() : 'IN';
        if (!cancelled) setCountry((prev) => (prev === iso ? prev : iso));
      } catch {
        if (!cancelled) setCountry((prev) => (prev === 'IN' ? prev : 'IN'));
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [user?.country, user?.kyc?.country, user?.countryCode]);

  const sections = useMemo(() => {
    const entries = Object.entries(fieldsBySection || {});
    entries.sort((a, b) => getSectionOrder(a[1]) - getSectionOrder(b[1]));
    return entries.map(([key, fields]) => ({
      key,
      title: toTitleCase(key),
      fields: Array.isArray(fields)
        ? [...fields].sort((x, y) => (x?.order ?? 9999) - (y?.order ?? 9999))
        : [],
    }));
  }, [fieldsBySection]);

  const activeSection = sections[activeSectionIdx];
  const isLocked =
    ['submitted', 'in_review', 'in-review', 'inreview'].includes(
      String(kycStatus?.status || '').toLowerCase()
    );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await kycService.getFields({ country });
        setFieldsBySection(res?.fieldsBySection || {});
      } catch (e) {
        addToast(e?.message || 'Failed to load KYC fields', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [addToast, country]);

  useEffect(() => {
    const loadStatus = async () => {
      setStatusLoading(true);
      try {
        const res = await kycService.getStatus();
        setKycStatus(res);
        const data = res?.data || {};
        // Normalize existing saved data into section map
        if (data && typeof data === 'object') {
          setFormBySection((prev) => ({ ...data, ...prev }));
        }
      } catch (e) {
        addToast(e?.message || 'Failed to load KYC status', 'error');
      } finally {
        setStatusLoading(false);
      }
    };
    loadStatus();
  }, [addToast]);

  const updateField = (sectionKey, fieldKey, value) => {
    setFormBySection((prev) => ({
      ...prev,
      [sectionKey]: {
        ...(prev[sectionKey] || {}),
        [fieldKey]: value,
      },
    }));
    setMissingFields((prev) => prev.filter((f) => f !== fieldKey));
  };

  const handleUpload = async ({ sectionKey, fieldKey, file }) => {
    const uploadKey = `${sectionKey}:${fieldKey}`;
    try {
      setUploadingByField((prev) => ({ ...prev, [uploadKey]: true }));
      const res = await kycService.upload({ file, fieldName: fieldKey, section: sectionKey });
      // backend may return url/key; we store whole response under field
      updateField(sectionKey, fieldKey, res);
      addToast('Uploaded successfully', 'success');
    } catch (e) {
      addToast(e?.message || 'Upload failed', 'error');
    } finally {
      setUploadingByField((prev) => ({ ...prev, [uploadKey]: false }));
    }
  };

  const saveCurrentSection = async () => {
    if (!activeSection) return;
    setSavingSection(true);
    setMissingFields([]);
    try {
      const payload = formBySection[activeSection.key] || {};
      const res = await kycService.saveSection({
        section: activeSection.key,
        data: payload,
        country,
      });
      if (res?.missingFields?.length) {
        setMissingFields(res.missingFields);
        addToast('Please fill required fields.', 'error');
        return false;
      }
      addToast('Saved', 'success');
      return true;
    } catch (e) {
      const mf = e?.missingFields || e?.data?.missingFields || e?.response?.data?.missingFields;
      if (Array.isArray(mf) && mf.length) setMissingFields(mf);
      addToast(e?.message || 'Failed to save section', 'error');
      return false;
    } finally {
      setSavingSection(false);
    }
  };

  const handleNext = async () => {
    const ok = await saveCurrentSection();
    if (!ok) return;
    setActiveSectionIdx((i) => Math.min(i + 1, sections.length - 1));
  };

  const handlePrev = () => setActiveSectionIdx((i) => Math.max(i - 1, 0));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // best effort: save current section first
      await saveCurrentSection();
      await kycService.submit();
      addToast('KYC submitted for review.', 'success');
      const refreshed = await kycService.getStatus();
      setKycStatus(refreshed);
    } catch (e) {
      addToast(e?.message || 'KYC submit failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || statusLoading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading KYC...</div>;
  }

  const status = String(kycStatus?.status || 'in_progress').toLowerCase();

  return (
    <div className="w-full pb-10 animate-fade-in">
      <div className="bg-white rounded-2xl p-5 lg:p-8 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="font-sans text-lg font-bold text-gray-800">Vendor KYC</h2>
            <p className="text-[12px] text-gray-400">
              Status: <span className="font-semibold text-gray-600">{toTitleCase(status)}</span>
            </p>
            {status === 'rejected' && kycStatus?.rejectionReason && (
              <p className="mt-2 text-[12px] text-red-500">
                Rejection reason: <span className="font-semibold">{kycStatus.rejectionReason}</span>
              </p>
            )}
          </div>

          <div className="text-[12px] text-gray-400">
            Country: <span className="font-semibold text-gray-600">{country}</span>
          </div>
        </div>

        {isLocked && (
          <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 p-4 text-[13px] text-gray-600">
            Your KYC is submitted and currently under review. Editing is locked until the status changes.
          </div>
        )}

        {sections.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-10">No KYC fields configured.</div>
        ) : (
          <>
            {/* Section tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {sections.map((s, idx) => (
                <button
                  key={s.key}
                  type="button"
                  disabled={isLocked}
                  onClick={() => setActiveSectionIdx(idx)}
                  className={`px-3 py-2 rounded-xl border text-[12px] font-semibold transition-colors cursor-pointer
                    ${idx === activeSectionIdx
                      ? 'bg-primary-dark text-white border-primary-dark'
                      : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}
                    ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}
                  `}
                >
                  {s.title}
                </button>
              ))}
            </div>

            {/* Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {activeSection?.fields?.map((field) => {
                const fieldKey = getFieldKey(field);
                if (!fieldKey) return null;
                const label = getFieldLabel(field);
                const required = Boolean(field.required);
                const type = getFieldType(field);
                const value = formBySection?.[activeSection.key]?.[fieldKey];
                const isMissing = missingFields.includes(fieldKey);

                if (type === 'file') {
                  const rawDisplay =
                    value?.fileName ||
                    value?.filename ||
                    value?.originalName ||
                    value?.name ||
                    value?.url ||
                    value?.publicUrl ||
                    value?.location ||
                    value?.key ||
                    '';
                  const display = getFilenameFromUrlOrKey(rawDisplay);
                  const accept = getAcceptString(field);
                  const isUploading = Boolean(uploadingByField[`${activeSection.key}:${fieldKey}`]);
                  return (
                    <div key={fieldKey} className="space-y-1.5 md:col-span-2">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                        {label}{required ? <span className="text-red-500">*</span> : null}
                      </label>
                      <div
                        className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold bg-white transition-all
                          ${isMissing ? 'border-red-300' : 'border-gray-200'}
                        `}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                          <div className="text-gray-600 text-[13px] break-all">
                            {display ? (
                              <span>Uploaded: {display}</span>
                            ) : (
                              <span className="text-gray-400">No file uploaded</span>
                            )}
                          </div>
                          <label
                            className={`inline-flex items-center justify-center px-4 py-2 rounded-lg text-[12px] font-bold cursor-pointer
                              ${(isLocked || isUploading)
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-primary-dark text-white hover:opacity-90'}
                            `}
                          >
                            {isUploading ? 'Uploading...' : 'Upload'}
                            <input
                              type="file"
                              className="hidden"
                              accept={accept}
                              disabled={isLocked || isUploading}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUpload({ sectionKey: activeSection.key, fieldKey, file });
                              }}
                            />
                          </label>
                        </div>
                      </div>
                      {isMissing && (
                        <p className="text-red-500 text-[11px] mt-1 ml-1">Required</p>
                      )}
                    </div>
                  );
                }

                if (type === 'select') {
                  const options = field.options || field.values || [];
                  return (
                    <div key={fieldKey} className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                        {label}{required ? <span className="text-red-500">*</span> : null}
                      </label>
                      <select
                        disabled={isLocked}
                        value={value || ''}
                        onChange={(e) => updateField(activeSection.key, fieldKey, e.target.value)}
                        className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none transition-all
                          ${isLocked ? 'bg-[#F8F9FA] border-gray-100 text-gray-500' : 'bg-white border-gray-200 focus:border-primary-dark'}
                          ${isMissing ? 'border-red-300' : ''}
                        `}
                      >
                        <option value="">Select</option>
                        {options.map((opt) => {
                          const v = opt.value ?? opt;
                          const l = opt.label ?? opt;
                          return (
                            <option key={String(v)} value={v}>
                              {l}
                            </option>
                          );
                        })}
                      </select>
                      {isMissing && (
                        <p className="text-red-500 text-[11px] mt-1 ml-1">Required</p>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={fieldKey} className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                      {label}{required ? <span className="text-red-500">*</span> : null}
                    </label>
                    <input
                      type={type}
                      disabled={isLocked}
                      value={value || ''}
                      onChange={(e) => updateField(activeSection.key, fieldKey, e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 transition-all
                        ${isLocked ? 'bg-[#F8F9FA] border-gray-100 text-gray-500' : 'bg-white border-gray-200 focus:border-primary-dark'}
                        ${isMissing ? 'border-red-300' : ''}
                      `}
                    />
                    {isMissing && (
                      <p className="text-red-500 text-[11px] mt-1 ml-1">Required</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-between">
              <button
                type="button"
                onClick={handlePrev}
                disabled={isLocked || activeSectionIdx === 0}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Back
              </button>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={saveCurrentSection}
                  disabled={isLocked || savingSection}
                  className="px-5 py-2.5 rounded-xl bg-gray-100 text-xs font-bold text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {savingSection ? 'Saving...' : 'Save'}
                </button>

                {activeSectionIdx < sections.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={isLocked || savingSection}
                    className="px-5 py-2.5 rounded-xl bg-primary-dark text-white text-xs font-bold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLocked || submitting}
                    className="px-5 py-2.5 rounded-xl bg-primary-dark text-white text-xs font-bold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {submitting ? 'Submitting...' : 'Submit KYC'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

