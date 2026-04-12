import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { faqService } from '../../services/faqService';

function normalizeFaq(f) {
  const id = f?.id ?? f?._id ?? f?.faqId ?? null;
  return {
    id,
    question: f?.question ?? f?.q ?? '',
    answer: f?.answer ?? f?.a ?? '',
    sortOrder: Number(f?.sortOrder ?? f?.sort_order ?? f?.order ?? 0) || 0,
  };
}

export default function Faq() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isVendor = user?.userType === 'vendor' || user?.userType === 'jeweller';

  const [loading, setLoading] = useState(true);
  const [faqs, setFaqs] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const items = await faqService.list();
        if (cancelled) return;
        const normalized = (items || []).map(normalizeFaq).filter((x) => x.id != null);
        normalized.sort((a, b) => a.sortOrder - b.sortOrder);
        setFaqs(normalized);
        setOpenId(normalized[0]?.id ?? null);
      } catch (e) {
        if (cancelled) return;
        setErrorMsg(e?.message || 'Failed to load FAQ');
        setFaqs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSupport = () => {
    const messagesRoute = isVendor ? '/vendor/messages' : '/customer/messages';
    navigate(messagesRoute, { state: { openSupport: true, supportPrefill: 'Hi' } });
  };

  const headerText = useMemo(() => {
    return isVendor ? 'Jeweller Support & FAQ' : 'Customer Support & FAQ';
  }, [isVendor]);

  return (
    <div className="w-full max-w-none mx-auto">
      <div className="bg-white rounded-2xl border border-pale overflow-hidden">
        <div className="p-5 md:p-7 border-b border-pale">
          <h2 className="font-serif text-[22px] md:text-[24px] font-bold text-ink">{headerText}</h2>
        </div>

        <div className="p-5 md:p-7 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            {loading ? (
              <div className="py-6 text-center text-[13px] text-muted">Loading FAQ…</div>
            ) : errorMsg ? (
              <div className="py-6 text-center text-[13px] text-red-600">{errorMsg}</div>
            ) : faqs.length === 0 ? (
              <div className="py-6 text-center text-[13px] text-muted">No FAQ available.</div>
            ) : (
              <div className="space-y-3">
                {faqs.map((f) => {
                  const isOpen = String(openId) === String(f.id);
                  return (
                    <div key={String(f.id)} className="rounded-2xl border border-pale bg-white overflow-hidden">
                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 cursor-pointer"
                        onClick={() => setOpenId((prev) => (String(prev) === String(f.id) ? null : f.id))}
                        aria-expanded={isOpen}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-extrabold text-ink">{f.question}</p>
                        </div>
                        <div className="shrink-0 w-8 h-8 rounded-xl border border-pale bg-cream flex items-center justify-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={`transition-transform ${isOpen ? 'rotate-180' : 'rotate-0'}`}
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </div>
                      </button>

                      {isOpen ? (
                        <div className="px-4 pb-4 pt-0.5">
                          <p className="text-[13px] text-mid leading-relaxed whitespace-pre-wrap">
                            {f.answer}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-[100px]">
              <div className="rounded-2xl border border-pale bg-primary-light/10 p-4 md:p-5">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white border border-pale flex items-center justify-center text-ink">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-extrabold text-ink">Support</p>
                    <p className="mt-1 text-[12px] text-mid">Chat with Mirah support for help.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSupport}
                  className="mt-4 w-full px-4 py-3 rounded-xl bg-walnut text-blush text-[13px] font-bold shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Contact Support
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

