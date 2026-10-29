import { useState } from 'react';
import { formatDialCodeTriggerLabel } from '../../utils/countryFlag';

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const addToast = (message, type = 'error') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
  };
  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));
  return { toasts, addToast, removeToast };
}

/** Builds dial-code options from the country-codes API rows. */
export function toDialCodeOptions(rows) {
  return (rows || []).map((c) => ({
    value: c.phoneCode,
    code: c.countryCode,
    countryName: c.countryName,
    label: formatDialCodeTriggerLabel({ iso: c.countryCode, phoneCode: c.phoneCode, fallback: `${c.countryCode} ${c.phoneCode}` }),
    searchData: { code: c.countryCode, dial: c.phoneCode, name: c.countryName },
  }));
}
