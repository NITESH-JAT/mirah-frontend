function normText(x) {
  const s = String(x ?? '').trim();
  return s ? s.toLowerCase() : '';
}

function normUnit(x) {
  const s = String(x ?? '').trim();
  return s ? s.toLowerCase() : '';
}

function normDim(x) {
  if (x == null || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export function normalizeCartVariantSelector(variants) {
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return null;
  const type = normText(variants?.type);
  const size = normText(variants?.size);
  const sizeDimensions = normDim(variants?.sizeDimensions ?? variants?.size_dimensions);
  const sizeDimensionsUnit = normUnit(variants?.sizeDimensionsUnit ?? variants?.size_dimensions_unit);

  if (!type && !size && sizeDimensions == null && !sizeDimensionsUnit) return null;
  return { type, size, sizeDimensions, sizeDimensionsUnit };
}

function dimEq(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 1e-6;
}

export function findMatchingProductVariant(productVariants, selectedVariants) {
  const sel = normalizeCartVariantSelector(selectedVariants);
  const list = Array.isArray(productVariants) ? productVariants : [];
  if (!sel || !list.length) return null;

  // Most reliable match: type+size+dim+unit (dim/unit are optional in some data)
  const strict = list.find((v) => {
    const vt = normText(v?.type);
    const vs = normText(v?.size);
    const vd = normDim(v?.sizeDimensions ?? v?.size_dimensions);
    const vu = normUnit(v?.sizeDimensionsUnit ?? v?.size_dimensions_unit);
    if (sel.type && vt !== sel.type) return false;
    if (sel.size && vs !== sel.size) return false;
    if (sel.sizeDimensionsUnit && vu !== sel.sizeDimensionsUnit) return false;
    if (sel.sizeDimensions != null && !dimEq(vd, sel.sizeDimensions)) return false;
    return true;
  });
  if (strict) return strict;

  // Fallback: type+size only (handles backends that omit dims in cart selector)
  const loose = list.find((v) => {
    const vt = normText(v?.type);
    const vs = normText(v?.size);
    if (sel.type && vt !== sel.type) return false;
    if (sel.size && vs !== sel.size) return false;
    return true;
  });
  return loose || null;
}

export function priceForCartLine({ cartItem, product } = {}) {
  const p = product || cartItem?.product || null;
  const matched = findMatchingProductVariant(p?.variants, cartItem?.variants);
  const unitPrice =
    Number(matched?.price ?? cartItem?.price ?? cartItem?.unitPrice ?? cartItem?.unit_price ?? cartItem?.raw?.price ?? cartItem?.raw?.unitPrice ?? cartItem?.raw?.unit_price ?? p?.price ?? 0) ||
    0;
  const compareAt =
    Number(matched?.compareAtPrice ?? matched?.compare_at_price ?? cartItem?.compareAtPrice ?? cartItem?.compare_at_price ?? cartItem?.raw?.compareAtPrice ?? cartItem?.raw?.compare_at_price ?? p?.compareAtPrice ?? p?.compare_at_price ?? 0) ||
    0;
  return { unitPrice, compareAt, matchedVariant: matched };
}

