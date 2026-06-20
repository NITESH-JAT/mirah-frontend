const SIMILAR_PRODUCTS_SESSION_KEY = 'mirah_similar_products_session';

export function readSimilarProductsSession() {
  try {
    const raw = sessionStorage.getItem(SIMILAR_PRODUCTS_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const anchorProductId = String(data?.anchorProductId ?? '').trim();
    if (!anchorProductId) return null;
    const categoryRaw = data?.category;
    return {
      anchorProductId,
      category: categoryRaw != null && String(categoryRaw).trim() ? String(categoryRaw).trim() : null,
    };
  } catch {
    return null;
  }
}

export function writeSimilarProductsSession({ anchorProductId, category } = {}) {
  try {
    const id = String(anchorProductId ?? '').trim();
    if (!id) return;
    sessionStorage.setItem(
      SIMILAR_PRODUCTS_SESSION_KEY,
      JSON.stringify({
        anchorProductId: id,
        category: category != null && String(category).trim() ? String(category).trim() : null,
      })
    );
  } catch {
    // ignore
  }
}

export function clearSimilarProductsSession() {
  try {
    sessionStorage.removeItem(SIMILAR_PRODUCTS_SESSION_KEY);
  } catch {
    // ignore
  }
}
