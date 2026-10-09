/** Marketplace privacy: show only a counterpart's first name in customer↔jeweller UI. */

export function counterpartFirstName(u) {
  return String(u?.firstName ?? u?.first_name ?? '').trim();
}

export function counterpartDisplayName(u, fallback = '') {
  const first = counterpartFirstName(u);
  if (first) return first;
  const direct = String(u?.name ?? u?.fullName ?? u?.vendorName ?? u?.customerName ?? '').trim();
  if (!direct) return fallback;
  return direct.split(/\s+/)[0] || fallback;
}

/** Join first+last safely — keeps only first name even if last is present. */
export function joinCounterpartName(firstName, lastName, fallback = '') {
  const first = String(firstName ?? '').trim();
  if (first) return first;
  void lastName;
  return fallback;
}
