export function getVendorId(p) {
  return (
    p?.vendorId ??
    p?.vendor_id ??
    p?.vendor?.id ??
    p?.vendor?._id ??
    p?.providerVendorId ??
    p?.sellerId ??
    null
  );
}

export function getVendorDisplayName(p) {
  const v = p?.vendor ?? p?.vendorDetails ?? p?.seller ?? p?.provider ?? null;

  const direct =
    p?.vendorName ??
    p?.vendor_name ??
    v?.name ??
    v?.businessName ??
    v?.business_name ??
    v?.shopName ??
    v?.shop_name ??
    v?.storeName ??
    v?.store_name ??
    v?.companyName ??
    v?.company_name ??
    null;

  const firstOnly = String(
    v?.firstName ?? v?.first_name ?? p?.vendorFirstName ?? p?.vendor_first_name ?? '',
  ).trim();

  const raw = String(direct || firstOnly || '').trim();
  if (!raw || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') return null;
  // Never surface a full name if a multi-word string slipped through.
  return raw.split(/\s+/)[0] || null;
}

export function isVendorProduct(p) {
  return getVendorId(p) != null;
}

export function vendorSourceText(p) {
  if (!isVendorProduct(p)) return null;
  const name = getVendorDisplayName(p);
  if (name) return `From Jeweller ${name}`;
  return 'From Jeweller';
}

export function sourceBadgeText(p) {
  const vendorId = getVendorId(p);
  if (vendorId == null) return null;
  const name = getVendorDisplayName(p);
  if (name) return `From Jeweller ${name}`;
  return 'From Jeweller';
}

