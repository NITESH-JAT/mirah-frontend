function toNum(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function toPosNum(v) {
  const n = toNum(v);
  return n != null && n > 0 ? n : null;
}

export function getProductDiamondTypes(product) {
  const raw = product?.diamondTypes ?? product?.diamond_types;
  if (Array.isArray(raw)) {
    return raw
      .map((x) => String(x || '').trim().toLowerCase())
      .filter((x) => x === 'natural' || x === 'lab');
  }
  const legacy = String(product?.diamondType ?? product?.diamond_type ?? '').trim().toLowerCase();
  if (legacy === 'natural' || legacy === 'lab') return [legacy];
  return [];
}

export function resolveDiamondUnitPricing(product, variant, diamondType) {
  const dt = diamondType === 'natural' || diamondType === 'lab' ? diamondType : null;
  const v = variant || {};
  const p = product || {};

  if (dt === 'natural') {
    return {
      price: toPosNum(v.naturalPrice) ?? toPosNum(p.naturalPrice) ?? toPosNum(v.price) ?? toPosNum(p.price) ?? 0,
      compareAt:
        toNum(v.naturalCompareAtPrice) ??
        toNum(p.naturalCompareAtPrice) ??
        toNum(v.compareAtPrice ?? v.compare_at_price) ??
        toNum(p.compareAtPrice ?? p.compare_at_price) ??
        0,
    };
  }
  if (dt === 'lab') {
    return {
      price: toPosNum(v.labPrice) ?? toPosNum(p.labPrice) ?? toPosNum(v.price) ?? toPosNum(p.price) ?? 0,
      compareAt:
        toNum(v.labCompareAtPrice) ??
        toNum(p.labCompareAtPrice) ??
        toNum(v.compareAtPrice ?? v.compare_at_price) ??
        toNum(p.compareAtPrice ?? p.compare_at_price) ??
        0,
    };
  }
  return {
    price: toPosNum(v.price) ?? toPosNum(p.price) ?? 0,
    compareAt: toNum(v.compareAtPrice ?? v.compare_at_price) ?? toNum(p.compareAtPrice ?? p.compare_at_price) ?? 0,
  };
}

export function resolveSelectedDiamondType(product, selection) {
  const types = getProductDiamondTypes(product);
  const sel = String(selection?.diamondType || '').trim().toLowerCase();
  if (sel === 'natural' || sel === 'lab') return sel;
  if (types.length === 1) return types[0];
  return null;
}
