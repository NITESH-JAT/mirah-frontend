const SHOP_CATALOG_SESSION_KEY = 'mirah_shop_catalog_session';

const SORT_IDS = new Set(['newest', 'price_asc', 'price_desc']);

function normalizeCollectionId(value) {
  if (value === '' || value == null) return '';
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : '';
}

/** @returns {import('./shopCatalogSession').ShopCatalogSession | null} */
export function readShopCatalogSession() {
  try {
    const raw = sessionStorage.getItem(SHOP_CATALOG_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;

    const view = data.view === 'products' ? 'products' : 'categories';
    const catalogBrowseMode = data.catalogBrowseMode === 'collection' ? 'collection' : 'category';
    const sortId = SORT_IDS.has(data.sortId) ? data.sortId : 'newest';
    const pageRaw = Number(data.page);
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

    return {
      view,
      catalogBrowseMode,
      category: String(data.category || '').trim(),
      collectionId: normalizeCollectionId(data.collectionId),
      featured: Boolean(data.featured),
      q: String(data.q || ''),
      sortId,
      page,
      diamondType: data.diamondType === 'natural' || data.diamondType === 'lab' ? data.diamondType : '',
    };
  } catch {
    return null;
  }
}

/**
 * @param {Partial<import('./shopCatalogSession').ShopCatalogSession>} state
 */
export function writeShopCatalogSession(state) {
  try {
    const prev = readShopCatalogSession() || {};
    const view = state.view === 'products' ? 'products' : state.view === 'categories' ? 'categories' : prev.view || 'categories';
    const catalogBrowseMode =
      state.catalogBrowseMode === 'collection'
        ? 'collection'
        : state.catalogBrowseMode === 'category'
          ? 'category'
          : prev.catalogBrowseMode || 'category';

    const next = {
      view,
      catalogBrowseMode,
      category: state.category !== undefined ? String(state.category || '').trim() : prev.category || '',
      collectionId:
        state.collectionId !== undefined ? normalizeCollectionId(state.collectionId) : normalizeCollectionId(prev.collectionId),
      featured: state.featured !== undefined ? Boolean(state.featured) : Boolean(prev.featured),
      q: state.q !== undefined ? String(state.q || '') : prev.q || '',
      sortId: state.sortId !== undefined && SORT_IDS.has(state.sortId) ? state.sortId : prev.sortId || 'newest',
      diamondType:
        state.diamondType !== undefined
          ? state.diamondType === 'natural' || state.diamondType === 'lab'
            ? state.diamondType
            : ''
          : prev.diamondType === 'natural' || prev.diamondType === 'lab'
            ? prev.diamondType
            : '',
      page:
        state.page !== undefined
          ? (() => {
              const n = Number(state.page);
              return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
            })()
          : prev.page || 1,
    };

    sessionStorage.setItem(SHOP_CATALOG_SESSION_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function clearShopCatalogProductSession(catalogBrowseMode = 'category') {
  writeShopCatalogSession({
    view: 'categories',
    catalogBrowseMode: catalogBrowseMode === 'collection' ? 'collection' : 'category',
    category: '',
    collectionId: '',
    featured: false,
    q: '',
    sortId: 'newest',
    page: 1,
    diamondType: '',
  });
}

/**
 * @typedef {Object} ShopCatalogSession
 * @property {'products' | 'categories'} view
 * @property {'category' | 'collection'} catalogBrowseMode
 * @property {string} category
 * @property {number | ''} collectionId
 * @property {boolean} featured
 * @property {string} q
 * @property {'newest' | 'price_asc' | 'price_desc'} sortId
 * @property {number} page
 * @property {'natural' | 'lab' | ''} diamondType
 */
