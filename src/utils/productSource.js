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

  const fromParts = [
    v?.firstName ?? v?.first_name ?? p?.vendorFirstName ?? p?.vendor_first_name ?? null,
    v?.lastName ?? v?.last_name ?? p?.vendorLastName ?? p?.vendor_last_name ?? null,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const name = String(direct || fromParts || '').trim();
  if (!name || name.toLowerCase() === 'null' || name.toLowerCase() === 'undefined') return null;
  return name || null;
}

export function isVendorProduct(p) {
  return getVendorId(p) != null;
}

export function vendorSourceText(p) {
  if (!isVendorProduct(p)) return null;
  const name = getVendorDisplayName(p);
  if (name) return `From vendor ${name}`;
  return 'From vendor';
}

export function sourceBadgeText(p) {
  const vendorId = getVendorId(p);
  if (vendorId == null) return null;
  const name = getVendorDisplayName(p);
  if (name) return `From vendor ${name}`;
  return 'From vendor';
}

