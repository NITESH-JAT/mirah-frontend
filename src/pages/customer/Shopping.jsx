import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { productService } from '../../services/productService';
import { cartService } from '../../services/cartService';
import ProductGridCard from '../../components/customer/ProductGridCard';
import CatalogContextBanner from '../../components/customer/CatalogContextBanner';
import ListPaginationBar from '../../components/customer/ListPaginationBar';
import SafeImage from '../../components/SafeImage';
import StorefrontComingSoon from '../../components/customer/StorefrontComingSoon';
import { useCustomerStorefront } from '../../context/CustomerStorefrontContext';
import { useRegion } from '../../context/RegionProvider';
import { formatCurrency } from '../../utils/formatMoney';
import {
  clearShopCatalogProductSession,
  readShopCatalogSession,
  writeShopCatalogSession,
} from '../../utils/shopCatalogSession';
import { productListingGridBorderClasses, shopListingFullBleedClass } from '../../utils/productListingGrid';
import { getProductDiamondTypes, resolveDiamondUnitPricing } from '../../utils/productDiamondPricing';
import { SpecChoiceCard } from '../../components/project/SpecChoiceCards';
import { labPictogram, naturalPictogram } from '../../utils/projectFinishPreview';

function restoredProductsSession() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') !== 'products') return null;
    const saved = readShopCatalogSession();
    return saved?.view === 'products' ? saved : null;
  } catch {
    return null;
  }
}

const SortOptions = [
  { id: 'newest', label: 'Newest', sortBy: 'createdAt', sortOrder: 'desc' },
  { id: 'price_asc', label: 'Price: Low to High', sortBy: 'price', sortOrder: 'asc' },
  { id: 'price_desc', label: 'Price: High to Low', sortBy: 'price', sortOrder: 'desc' },
];

/** Title-style label for display (cards + filter dropdowns); values stay raw for API. */
function formatCategoryDisplayName(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function CategoryCardNoImagePlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-muted">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      <div className="mt-2 text-[11px] font-semibold text-muted">No image</div>
    </div>
  );
}

function ShopListingSpinner() {
  return (
    <svg
      className="animate-spin text-ink"
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Center loader in the main column (below header, right of desktop sidebar). */
function ShopPageLoader() {
  return (
    <div
      className="flex w-full flex-1 items-center justify-center min-h-[calc(100dvh-4rem-3.5rem-env(safe-area-inset-bottom))] lg:min-h-[calc(100dvh-4rem)]"
      aria-busy="true"
    >
      <ShopListingSpinner />
      <span className="sr-only">Loading shop</span>
    </div>
  );
}

/** Category tiles use only the `image` URL from `GET .../customer/categories`. */
function categoryCardImageSrc(apiImage) {
  const url = String(apiImage || '').trim();
  return url || null;
}

export default function Shopping() {
  const { addToast } = useOutletContext();
  const navigate = useNavigate();
  const { ready: regionReady } = useRegion();
  const { loading: storefrontLoading, navVisible, catalogEnabled, comingSoonMessage } = useCustomerStorefront();
  const [searchParams, setSearchParams] = useSearchParams();
  const listView = searchParams.get('view');
  const restoredSession = useMemo(() => restoredProductsSession(), []);

  /** `?view=products` is pushed when opening the grid from categories so OS/browser Back returns to category browse. */
  const [browseMode, setBrowseMode] = useState(() => (listView === 'products' ? 'products' : 'categories'));
  /** Browse landing: category tiles vs collection tiles (default category). */
  const [catalogBrowseMode, setCatalogBrowseMode] = useState(() => {
    const saved = readShopCatalogSession();
    return saved?.catalogBrowseMode === 'collection' ? 'collection' : 'category';
  });

  const DESKTOP_GRID_KEY = 'mirah_shop_desktop_grid_cols';
  const [desktopGridCols, setDesktopGridCols] = useState(() => {
    try {
      const raw = localStorage.getItem(DESKTOP_GRID_KEY);
      const n = Number(raw);
      return n === 2 || n === 3 || n === 4 ? n : 3;
    } catch {
      return 4;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(DESKTOP_GRID_KEY, String(desktopGridCols));
    } catch {
      // ignore
    }
  }, [desktopGridCols]);
  const desktopGridColsClass =
    desktopGridCols === 2 ? 'md:grid-cols-2' : desktopGridCols === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3';
  const listingGridBorderClass = useMemo(
    () => productListingGridBorderClasses(desktopGridCols),
    [desktopGridCols]
  );

  const [q, setQ] = useState(() => restoredSession?.q ?? '');
  const [page, setPage] = useState(() => restoredSession?.page ?? 1);
  const [limit] = useState(10);
  const [sortId, setSortId] = useState(() => restoredSession?.sortId ?? 'newest');

  // Applied filters (used for API requests)
  const [category, setCategory] = useState(() => restoredSession?.category ?? '');
  const [collectionId, setCollectionId] = useState(() => restoredSession?.collectionId ?? '');
  const [featured, setFeatured] = useState(() => restoredSession?.featured ?? false);
  const [diamondTypeFilter, setDiamondTypeFilter] = useState(() =>
    restoredSession?.diamondType === 'natural' || restoredSession?.diamondType === 'lab'
      ? restoredSession.diamondType
      : ''
  );

  const hasActiveCatalogFilters = useMemo(
    () =>
      Boolean(String(category || '').trim()) ||
      (collectionId !== '' && collectionId != null && !Number.isNaN(Number(collectionId))) ||
      Boolean(featured),
    [category, collectionId, featured]
  );

  // Draft filters (only applied on "Apply")
  const [draftCategory, setDraftCategory] = useState(() => restoredSession?.category ?? '');
  const [draftCollectionId, setDraftCollectionId] = useState(() =>
    restoredSession?.collectionId !== '' && restoredSession?.collectionId != null
      ? String(restoredSession.collectionId)
      : ''
  );
  const [draftFeatured, setDraftFeatured] = useState(() => restoredSession?.featured ?? false);

  const [openFilters, setOpenFilters] = useState(false);
  const [openDiamondFilter, setOpenDiamondFilter] = useState(false);
  const [openSort, setOpenSort] = useState(false);
  const [openGridCols, setOpenGridCols] = useState(false);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: null });

  const [filterMetaLoading, setFilterMetaLoading] = useState(false);
  const [filterMetaLoaded, setFilterMetaLoaded] = useState(false);
  const [customerCategories, setCustomerCategories] = useState([]);
  const [customerCollections, setCustomerCollections] = useState([]);
  const [totalCatalogProducts, setTotalCatalogProducts] = useState(null);
  const [totalCollectionCatalogProducts, setTotalCollectionCatalogProducts] = useState(null);

  const categoryOptions = useMemo(
    () => customerCategories.map((c) => c.category).filter(Boolean),
    [customerCategories]
  );
  const collectionOptions = useMemo(() => customerCollections, [customerCollections]);

  const hasCollectionFilter = useMemo(
    () => collectionId !== '' && collectionId != null && !Number.isNaN(Number(collectionId)),
    [collectionId]
  );

  const hasCategoryFilter = useMemo(() => Boolean(String(category || '').trim()), [category]);

  /** Category/collection banner below search — hidden for View all (no filters); collection wins if both set. */
  const listingContextBanner = useMemo(() => {
    if (!hasCollectionFilter && !hasCategoryFilter) return null;

    if (hasCollectionFilter) {
      const row = customerCollections.find((c) => Number(c.id) === Number(collectionId));
      const title = row?.name ? formatCategoryDisplayName(row.name) : 'Collection';
      return {
        kind: 'collection',
        title,
        description: row?.description ? String(row.description).trim() : null,
        image: row?.image ?? null,
      };
    }

    const row = customerCategories.find((c) => String(c?.category || '').trim() === String(category).trim());
    const title = formatCategoryDisplayName(row?.category ?? category);
    return {
      kind: 'category',
      title,
      description: row?.description ? String(row.description).trim() : null,
      image: row?.image ?? null,
    };
  }, [
    category,
    collectionId,
    customerCategories,
    customerCollections,
    hasCategoryFilter,
    hasCollectionFilter,
  ]);

  const [cartOpen, setCartOpen] = useState(false);
  const [cartProduct, setCartProduct] = useState(null);
  const [cartQty, setCartQty] = useState(1);
  const [cartAdding, setCartAdding] = useState(false);
  const [cartVariantIdx, setCartVariantIdx] = useState(null);

  const cartVariants = useMemo(() => {
    return Array.isArray(cartProduct?.variants) ? cartProduct.variants.filter(Boolean) : [];
  }, [cartProduct]);

  const selectedCartVariant = useMemo(() => {
    if (!cartVariants.length) return null;
    const idx = Number(cartVariantIdx);
    if (!Number.isFinite(idx) || idx < 0 || idx >= cartVariants.length) return null;
    return cartVariants[idx] || null;
  }, [cartVariantIdx, cartVariants]);

  const variantLabel = (v) => {
    const parts = [];
    const type = String(v?.type ?? '').trim();
    const size = String(v?.size ?? '').trim();
    const dimRaw = v?.sizeDimensions ?? v?.size_dimensions ?? null;
    const dim = dimRaw == null || dimRaw === '' ? null : String(dimRaw).trim();
    const unit = String(v?.sizeDimensionsUnit ?? v?.size_dimensions_unit ?? '').trim();
    if (type) parts.push(type);
    if (size) parts.push(size);
    if (dim) parts.push(`${dim}${unit ? ` ${unit}` : ''}`.trim());
    return parts.join(' · ') || 'Variant';
  };

  const featuredFirstItems = useMemo(() => {
    const arr = Array.isArray(items) ? items : [];
    return arr
      .map((p, idx) => ({ p, idx }))
      .sort((a, b) => {
        const af = a?.p?.isFeatured === true || a?.p?.isFeatured === 1 || String(a?.p?.isFeatured).toLowerCase() === 'true';
        const bf = b?.p?.isFeatured === true || b?.p?.isFeatured === 1 || String(b?.p?.isFeatured).toLowerCase() === 'true';
        if (af === bf) return a.idx - b.idx;
        return af ? -1 : 1;
      })
      .map((x) => x.p);
  }, [items]);

  /** Category/collection image previews (max 5) for the View all banner — API images only. */
  const viewAllPreviewCategories = useMemo(() => {
    const list = Array.isArray(customerCategories) ? customerCategories : [];
    return list.filter((c) => categoryCardImageSrc(c?.image)).slice(0, 5);
  }, [customerCategories]);

  const viewAllPreviewCollections = useMemo(() => {
    const list = Array.isArray(customerCollections) ? customerCollections : [];
    return list.filter((c) => categoryCardImageSrc(c?.image)).slice(0, 5);
  }, [customerCollections]);

  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const filterMetaAbortRef = useRef(null);
  const productsFetchInitializedRef = useRef(false);
  const skipSessionRestoreRef = useRef(false);

  const sort = useMemo(() => SortOptions.find((x) => x.id === sortId) || SortOptions[0], [sortId]);

  const canPrev = Number(meta?.page || 1) > 1;
  const canNext = Number(meta?.page || 1) < Number(meta?.totalPages || 1);
  const currentPage = Number(meta?.page || page) || 1;
  const totalPages = Number(meta?.totalPages || 1) || 1;

  const fetchList = async ({ nextPage, query }) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const search = String(query ?? '').trim();
      const res = await productService.listCustomerProducts({
        page: nextPage,
        limit,
        category: category || undefined,
        collectionId: collectionId !== '' && collectionId != null ? collectionId : undefined,
        featured: featured ? true : undefined,
        diamondType: diamondTypeFilter || undefined,
        search: search || undefined,
        sortBy: sort?.sortBy,
        sortOrder: sort?.sortOrder,
        signal: ctrl.signal,
      });
      setItems(res.items || []);
      setMeta(res.meta || { page: nextPage, totalPages: 1, total: null });
      setPage(Number(res?.meta?.page || nextPage) || nextPage);
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
      addToast(e?.message || 'Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openFilterModal = () => {
    // sync draft from applied
    setDraftCategory(category);
    setDraftCollectionId(collectionId !== '' && collectionId != null ? String(collectionId) : '');
    setDraftFeatured(featured);
    setOpenDiamondFilter(false);
    setOpenSort(false);
    setOpenGridCols(false);
    setOpenFilters(true);
  };

  const openDiamondFilterModal = () => {
    setOpenFilters(false);
    setOpenSort(false);
    setOpenGridCols(false);
    setOpenDiamondFilter(true);
  };

  const persistShopSession = (patch = {}) => {
    writeShopCatalogSession({
      view: browseMode === 'products' ? 'products' : 'categories',
      catalogBrowseMode,
      category,
      collectionId,
      featured,
      diamondType: diamondTypeFilter,
      q,
      sortId,
      page,
      ...patch,
    });
  };

  const applySessionToState = (saved) => {
    if (!saved || saved.view !== 'products') return;
    setCategory(saved.category || '');
    setCollectionId(saved.collectionId ?? '');
    setFeatured(Boolean(saved.featured));
    setDiamondTypeFilter(
      saved.diamondType === 'natural' || saved.diamondType === 'lab' ? saved.diamondType : ''
    );
    setQ(saved.q || '');
    setSortId(saved.sortId || 'newest');
    setPage(saved.page || 1);
    setDraftCategory(saved.category || '');
    setDraftCollectionId(
      saved.collectionId !== '' && saved.collectionId != null ? String(saved.collectionId) : ''
    );
    setDraftFeatured(Boolean(saved.featured));
    productsFetchInitializedRef.current = false;
  };

  // `?view=products` ↔ product grid; dropping the param (browser/OS Back) returns to category browse.
  useEffect(() => {
    if (listView === 'products') {
      setBrowseMode('products');
      if (!skipSessionRestoreRef.current) {
        const saved = readShopCatalogSession();
        if (saved?.view === 'products') applySessionToState(saved);
      }
      skipSessionRestoreRef.current = false;
      setOpenFilters(false);
      setOpenDiamondFilter(false);
      setOpenSort(false);
      return;
    }

    setBrowseMode('categories');
    setCategory('');
    setCollectionId('');
    setFeatured(false);
    setQ('');
    setSortId('newest');
    setPage(1);
    setItems([]);
    setMeta({ page: 1, totalPages: 1, total: null });
    setOpenFilters(false);
    setOpenDiamondFilter(false);
    setOpenSort(false);
    productsFetchInitializedRef.current = false;
    clearShopCatalogProductSession(catalogBrowseMode);
  }, [listView, catalogBrowseMode]);

  // Persist shop browse + filter state for the session (survives product detail navigation).
  useEffect(() => {
    persistShopSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browseMode, catalogBrowseMode, category, collectionId, featured, diamondTypeFilter, q, sortId, page]);

  // Keep Filters dropdowns in sync with applied filters (grid / Apply / history).
  useEffect(() => {
    setDraftCategory(category);
    setDraftCollectionId(collectionId !== '' && collectionId != null ? String(collectionId) : '');
    setDraftFeatured(Boolean(featured));
  }, [category, collectionId, featured]);

  // Debounced search + filter/sort refresh (products browse only).
  // Wait for region cookie bootstrap so first paint is not INR-then-AED.
  useEffect(() => {
    if (browseMode !== 'products') {
      productsFetchInitializedRef.current = false;
      return;
    }
    if (!regionReady) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = q;
    debounceRef.current = setTimeout(() => {
      const isRestoreFetch = !productsFetchInitializedRef.current;
      const nextPage = isRestoreFetch ? page : 1;
      productsFetchInitializedRef.current = true;
      if (!isRestoreFetch) setPage(1);
      fetchList({ nextPage, query });
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category, collectionId, featured, diamondTypeFilter, sortId, browseMode, regionReady]);

  // Manual currency change (navbar) — refresh localized prices.
  useEffect(() => {
    const onRegion = (ev) => {
      if (ev?.detail?.bootstrap) return;
      if (browseMode !== 'products' || !regionReady) return;
      productsFetchInitializedRef.current = true;
      fetchList({ nextPage: page, query: q });
    };
    window.addEventListener('mirah_region_updated', onRegion);
    return () => window.removeEventListener('mirah_region_updated', onRegion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browseMode, regionReady, page, q, category, collectionId, featured, diamondTypeFilter, sortId]);

  // Load filter metadata (categories/collections) once
  useEffect(() => {
    if (filterMetaAbortRef.current) filterMetaAbortRef.current.abort();
    const ctrl = new AbortController();
    filterMetaAbortRef.current = ctrl;
    setFilterMetaLoading(true);
    Promise.all([
      productService.listCustomerCategories({ signal: ctrl.signal }),
      productService.listCustomerCollections({ signal: ctrl.signal }),
    ])
      .then(([catPayload, colPayload]) => {
        const cats = catPayload?.categories ?? [];
        setCustomerCategories(Array.isArray(cats) ? cats : []);
        const tp = catPayload?.totalProducts;
        setTotalCatalogProducts(
          tp != null && tp !== '' && !Number.isNaN(Number(tp)) ? Number(tp) : null
        );
        const cols = colPayload?.collections ?? [];
        setCustomerCollections(Array.isArray(cols) ? cols : []);
        const tcp = colPayload?.totalProducts;
        setTotalCollectionCatalogProducts(
          tcp != null && tcp !== '' && !Number.isNaN(Number(tcp)) ? Number(tcp) : null
        );
      })
      .catch((e) => {
        if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
        // keep UI usable even if meta fails
      })
      .finally(() => {
        // Only finalize for the latest (non-aborted) request. Under React
        // StrictMode the effect runs mount→cleanup→mount, aborting the first
        // request; its finally must not mark meta "loaded" while the arrays
        // are still empty (that would flash the empty-state message).
        if (filterMetaAbortRef.current === ctrl && !ctrl.signal.aborted) {
          setFilterMetaLoading(false);
          setFilterMetaLoaded(true);
        }
      });

    return () => {
      ctrl.abort();
    };
  }, []);

  const showListingContextBanner = browseMode === 'products' && Boolean(listingContextBanner);

  const productGridTopClass = useMemo(() => {
    if (showListingContextBanner) return '';
    if (!loading && items.length > 0) return '';
    return 'mt-4';
  }, [showListingContextBanner, loading, items.length]);

  const openAddToCart = (p) => {
    setCartProduct(p || null);
    setCartQty(1);
    const variants = Array.isArray(p?.variants) ? p.variants : [];
    setCartVariantIdx(variants.length === 1 ? 0 : null);
    setCartOpen(true);
  };

  const closeAddToCart = () => {
    if (cartAdding) return;
    setCartOpen(false);
    setCartProduct(null);
  };

  const confirmAddToCart = async () => {
    const pid = cartProduct?.id ?? cartProduct?._id ?? cartProduct?.productId ?? null;
    const qty = Math.max(1, Math.floor(Number(cartQty) || 1));
    if (!pid) {
      addToast('Invalid product', 'error');
      return;
    }
    if (cartVariants.length && !selectedCartVariant) {
      addToast('Please select a variant before adding to cart', 'error');
      return;
    }
    setCartAdding(true);
    try {
      const diamondTypes = getProductDiamondTypes(cartProduct);
      let diamondType = null;
      if (diamondTypes.length === 1) {
        diamondType = diamondTypes[0];
      } else if (diamondTypes.includes(diamondTypeFilter)) {
        diamondType = diamondTypeFilter;
      } else if (diamondTypes.length > 1) {
        addToast('Open the product to choose Natural or Lab grown diamonds', 'error');
        setCartAdding(false);
        return;
      }

      const variantsPayload = selectedCartVariant
        ? {
            type: selectedCartVariant?.type ?? undefined,
            size: selectedCartVariant?.size ?? undefined,
            sizeDimensions: selectedCartVariant?.sizeDimensions ?? selectedCartVariant?.size_dimensions ?? undefined,
            sizeDimensionsUnit:
              selectedCartVariant?.sizeDimensionsUnit ?? selectedCartVariant?.size_dimensions_unit ?? undefined,
            ...(diamondType ? { diamondType } : {}),
          }
        : diamondType
          ? { diamondType }
          : undefined;
      await cartService.addItem({
        productId: pid,
        quantity: qty,
        variants: variantsPayload,
        diamondType: diamondType || undefined,
      });
      addToast(`${qty} ${qty === 1 ? 'item' : 'items'} added to cart`, 'success');
      setCartOpen(false);
      setCartProduct(null);
    } catch (e) {
      addToast(e?.message || 'Failed to add to cart', 'error');
    } finally {
      setCartAdding(false);
    }
  };

  const selectShopCategoryFromCatalog = (categoryValue) => {
    const v = String(categoryValue || '').trim();
    if (!v) return;
    skipSessionRestoreRef.current = true;
    writeShopCatalogSession({
      view: 'products',
      catalogBrowseMode,
      category: v,
      collectionId: '',
      featured: false,
      diamondType: '',
      q: '',
      sortId,
      page: 1,
    });
    setCategory(v);
    setDraftCategory(v);
    setCollectionId('');
    setDraftCollectionId('');
    setFeatured(false);
    setDraftFeatured(false);
    setDiamondTypeFilter('');
    setBrowseMode('products');
    setQ('');
    setPage(1);
    productsFetchInitializedRef.current = false;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('view', 'products');
        return next;
      },
      { replace: false }
    );
  };

  const selectShopCollectionFromCatalog = (collectionValue) => {
    const n = Number(collectionValue);
    if (!Number.isFinite(n) || n <= 0) return;
    skipSessionRestoreRef.current = true;
    writeShopCatalogSession({
      view: 'products',
      catalogBrowseMode,
      category: '',
      collectionId: n,
      featured: false,
      diamondType: '',
      q: '',
      sortId,
      page: 1,
    });
    setCollectionId(n);
    setDraftCollectionId(String(n));
    setCategory('');
    setDraftCategory('');
    setFeatured(false);
    setDraftFeatured(false);
    setDiamondTypeFilter('');
    setBrowseMode('products');
    setQ('');
    setPage(1);
    productsFetchInitializedRef.current = false;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('view', 'products');
        return next;
      },
      { replace: false }
    );
  };

  const openViewAllProducts = () => {
    skipSessionRestoreRef.current = true;
    writeShopCatalogSession({
      view: 'products',
      catalogBrowseMode,
      category: '',
      collectionId: '',
      featured: false,
      diamondType: '',
      q: '',
      sortId,
      page: 1,
    });
    setCategory('');
    setDraftCategory('');
    setCollectionId('');
    setDraftCollectionId('');
    setFeatured(false);
    setDraftFeatured(false);
    setDiamondTypeFilter('');
    setBrowseMode('products');
    setQ('');
    setPage(1);
    productsFetchInitializedRef.current = false;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('view', 'products');
        return next;
      },
      { replace: false }
    );
  };

  if (storefrontLoading) {
    return <ShopPageLoader />;
  }

  if (!navVisible) {
    return <Navigate to="/customer/projects?tab=list" replace />;
  }

  if (!catalogEnabled) {
    return <StorefrontComingSoon message={comingSoonMessage} />;
  }

  return (
    <div
      className={`flex w-full flex-col pb-0 animate-fade-in ${
        browseMode === 'products'
          ? 'min-h-[calc(100dvh-4rem)] flex-1'
          : 'min-h-[calc(100dvh-5rem)] flex-1 lg:min-h-[calc(100dvh-6rem)]'
      }`}
    >
      {browseMode === 'products' ? (
        <div
          className={`sticky top-0 z-30 isolate bg-cream ${shopListingFullBleedClass} ${
            showListingContextBanner ? '' : 'border-b border-pale/60'
          }`}
        >
          <div className="px-4 py-4 lg:px-8">
            <div className="grid grid-cols-10 gap-2 md:flex md:w-full md:flex-nowrap md:items-center md:justify-between md:gap-3">
            <div className="relative col-span-6 min-w-0 md:w-[420px] md:max-w-[55vw] md:shrink-0">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search Jewellery"
                className="input-search-quiet-focus w-full rounded-2xl border border-pale bg-white py-2.5 pl-9 pr-2 text-[12px] font-medium text-ink placeholder:text-muted focus:outline-none md:py-3 md:pl-11 md:pr-4 md:text-[13px] md:focus:border-walnut"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted md:left-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="md:h-[18px] md:w-[18px]">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
            </div>

            <div className="col-span-4 flex min-w-0 items-center justify-end gap-2 md:min-w-0 md:shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (openDiamondFilter) setOpenDiamondFilter(false);
                  else openDiamondFilterModal();
                }}
                className={`relative inline-flex min-h-[2.25rem] min-w-[2.25rem] items-center justify-center rounded-full border px-2.5 transition-colors sm:min-w-[2.5rem] ${
                  openDiamondFilter || Boolean(diamondTypeFilter)
                    ? 'border-walnut bg-[#F2E6D4] text-ink'
                    : 'border-pale bg-white text-mid hover:bg-[#F2E6D4] hover:text-ink'
                }`}
                aria-label={
                  diamondTypeFilter === 'lab'
                    ? 'Diamond type: Lab grown'
                    : diamondTypeFilter === 'natural'
                      ? 'Diamond type: Natural'
                      : 'Diamond type'
                }
                aria-expanded={openDiamondFilter}
                title="Diamonds"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M6 3h12l4 6-10 12L2 9z" />
                  <path d="M2 9h20" />
                  <path d="M12 3 8 9l4 12 4-12-4-6" />
                </svg>
                {diamondTypeFilter ? (
                  <span
                    className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-walnut"
                    aria-hidden
                  />
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (openFilters) setOpenFilters(false);
                  else openFilterModal();
                }}
                className={`relative inline-flex min-h-[2.25rem] min-w-[2.25rem] items-center justify-center rounded-full border px-2.5 transition-colors sm:min-w-[2.5rem] ${
                  openFilters || hasActiveCatalogFilters
                    ? 'border-walnut bg-[#F2E6D4] text-ink'
                    : 'border-pale bg-white text-mid hover:bg-[#F2E6D4] hover:text-ink'
                }`}
                aria-label={hasActiveCatalogFilters ? 'Filters (active)' : 'Filters'}
                title="Filters"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                  <line x1="11" y1="18" x2="13" y2="18" />
                </svg>
                {hasActiveCatalogFilters ? (
                  <span
                    className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-walnut"
                    aria-hidden
                  />
                ) : null}
              </button>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setOpenGridCols(false);
                    setOpenDiamondFilter(false);
                    setOpenSort((v) => !v);
                  }}
                  className={`inline-flex min-h-[2.25rem] min-w-[2.25rem] items-center justify-center rounded-full border px-2.5 transition-colors sm:min-w-[2.5rem] ${
                    openSort
                      ? 'border-walnut bg-[#F2E6D4] text-ink'
                      : 'border-pale bg-white text-mid hover:bg-[#F2E6D4] hover:text-ink'
                  }`}
                  aria-label="Sort"
                  aria-expanded={openSort}
                  title="Sort"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="m3 8 4-4 4 4" />
                    <path d="M7 4v16" />
                    <path d="m21 16-4 4-4-4" />
                    <path d="M17 20V4" />
                  </svg>
                </button>
                {openSort ? (
                  <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-pale bg-white shadow-sm">
                    {SortOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSortId(opt.id);
                          setOpenSort(false);
                        }}
                        className={`w-full px-4 py-3 text-left text-[12px] font-semibold hover:bg-[#F2E6D4] ${
                          sortId === opt.id ? 'bg-[#F2E6D4] text-ink' : 'text-mid'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="relative hidden shrink-0 md:block">
                <button
                  type="button"
                  onClick={() => {
                    setOpenSort(false);
                    setOpenDiamondFilter(false);
                    setOpenGridCols((v) => !v);
                  }}
                  className={`inline-flex min-h-[2.25rem] min-w-[2.25rem] items-center justify-center rounded-full border px-2.5 transition-colors sm:min-w-[2.5rem] ${
                    openGridCols
                      ? 'border-walnut bg-[#F2E6D4] text-ink'
                      : 'border-pale bg-white text-mid hover:bg-[#F2E6D4] hover:text-ink'
                  }`}
                  aria-label={`Grid layout: ${desktopGridCols} per row`}
                  aria-expanded={openGridCols}
                  title={`${desktopGridCols} per row`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </button>
                {openGridCols ? (
                  <div className="absolute right-0 z-40 mt-2 w-36 overflow-hidden rounded-2xl border border-pale bg-white shadow-sm">
                    {[2, 3, 4].map((cols) => (
                      <button
                        key={cols}
                        type="button"
                        onClick={() => {
                          setDesktopGridCols(cols);
                          setOpenGridCols(false);
                        }}
                        className={`flex w-full items-center justify-center px-4 py-3 transition-colors hover:bg-[#F2E6D4] ${
                          desktopGridCols === cols ? 'bg-[#F2E6D4] text-ink' : 'text-mid'
                        }`}
                        aria-label={`${cols} products per row`}
                        title={`${cols} per row`}
                      >
                        <span
                          className="grid w-full max-w-[5.5rem] gap-1"
                          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                          aria-hidden
                        >
                          {Array.from({ length: cols }, (_, i) => (
                            <span
                              key={i}
                              className={`aspect-square rounded-[3px] border-2 ${
                                desktopGridCols === cols
                                  ? 'border-walnut bg-walnut/20'
                                  : 'border-current bg-transparent'
                              }`}
                            />
                          ))}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        </div>
      ) : null}

      {/* Filters panel (mobile drawer) */}
      {browseMode === 'products' && openFilters ? (
        <div
          className="fixed inset-0 z-[80] bg-ink/25 flex items-end md:items-stretch md:justify-end justify-center px-3 md:px-0 pt-[calc(env(safe-area-inset-top)+12px)] md:pt-0 pb-[calc(env(safe-area-inset-bottom)+12px)] md:pb-0"
          onMouseDown={() => setOpenFilters(false)}
        >
          <div
            className="w-full max-w-xl md:w-[420px] md:max-w-[420px] bg-white rounded-t-2xl md:rounded-none shadow-sm border border-pale overflow-hidden max-h-[calc(100dvh-24px)] md:max-h-none md:h-full flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 border-b border-pale flex items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-bold text-ink">Filters</p>
                <p className="text-[12px] text-muted mt-1">Refine results</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenFilters(false)}
                className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-ink uppercase tracking-wide">Category</label>
                  <select
                    value={draftCategory}
                    onChange={(e) => setDraftCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border text-[13px] font-semibold text-mid bg-white border-pale focus:outline-none focus:ring-1 focus:ring-walnut/20 focus:border-walnut"
                  >
                    <option value="">All</option>
                    {filterMetaLoading ? (
                      <option value="" disabled>
                        Loading…
                      </option>
                    ) : null}
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {formatCategoryDisplayName(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-ink uppercase tracking-wide">Collection</label>
                  <select
                    value={draftCollectionId}
                    onChange={(e) => setDraftCollectionId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border text-[13px] font-semibold text-mid bg-white border-pale focus:outline-none focus:ring-1 focus:ring-walnut/20 focus:border-walnut"
                  >
                    <option value="">All</option>
                    {filterMetaLoading ? (
                      <option value="" disabled>
                        Loading…
                      </option>
                    ) : null}
                    {collectionOptions.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {formatCategoryDisplayName(c.name)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-[12px] text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={draftFeatured}
                  onChange={(e) => setDraftFeatured(e.target.checked)}
                  className="w-4 h-4 rounded border-pale text-ink focus:ring-walnut/30"
                />
                <span className="font-medium">Featured</span>
              </label>
            </div>

            <div className="shrink-0 px-5 py-4 border-t border-pale bg-white flex justify-end gap-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <button
                type="button"
                onClick={() => {
                  setDraftCategory('');
                  setDraftCollectionId('');
                  setDraftFeatured(false);
                }}
                className="px-4 py-2 rounded-xl border border-pale text-[12px] font-semibold text-mid hover:bg-cream cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategory(draftCategory);
                  setCollectionId(
                    draftCollectionId !== '' && draftCollectionId != null
                      ? Number(draftCollectionId)
                      : ''
                  );
                  setFeatured(Boolean(draftFeatured));
                  setOpenFilters(false);
                }}
                className="px-5 py-2 rounded-xl bg-walnut text-blush text-[12px] font-bold hover:opacity-90 transition-opacity cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {browseMode === 'products' && openDiamondFilter ? (
        <div
          className="fixed inset-0 z-[80] bg-ink/25 flex items-end md:items-center justify-center px-3 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => setOpenDiamondFilter(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-pale overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 border-b border-pale flex items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-bold text-ink">Diamonds</p>
                <p className="text-[12px] text-muted mt-1">Choose diamond type</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenDiamondFilter(false)}
                className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2.5 p-4">
              <SpecChoiceCard
                label="Any"
                className="min-h-[96px]"
                selected={!diamondTypeFilter}
                iconNode={
                  <span className="flex h-11 w-11 items-center justify-center text-ink" aria-hidden>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 3h12l4 6-10 12L2 9z" />
                      <path d="M2 9h20" />
                      <path d="M12 3 8 9l4 12 4-12-4-6" />
                    </svg>
                  </span>
                }
                onClick={() => {
                  setDiamondTypeFilter('');
                  setOpenDiamondFilter(false);
                }}
              />
              <SpecChoiceCard
                label="Natural"
                iconSrc={naturalPictogram}
                className="min-h-[96px]"
                selected={diamondTypeFilter === 'natural'}
                onClick={() => {
                  setDiamondTypeFilter('natural');
                  setOpenDiamondFilter(false);
                }}
              />
              <SpecChoiceCard
                label="Lab grown"
                iconSrc={labPictogram}
                className="min-h-[96px]"
                selected={diamondTypeFilter === 'lab'}
                onClick={() => {
                  setDiamondTypeFilter('lab');
                  setOpenDiamondFilter(false);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {browseMode === 'categories' ? (
        <>
          <div className="sticky top-0 z-30 isolate bg-cream -mx-4 border-b border-pale/60 lg:-mx-8 px-4 lg:px-8">
            <div className="flex w-full" role="tablist" aria-label="Shop browse mode">
              <button
                type="button"
                role="tab"
                aria-selected={catalogBrowseMode === 'category'}
                onClick={() => setCatalogBrowseMode('category')}
                className={`relative flex-1 basis-1/2 cursor-pointer py-3.5 text-center text-[12px] font-semibold tracking-wide transition-colors md:py-4 md:text-[13px] ${
                  catalogBrowseMode === 'category'
                    ? 'text-walnut'
                    : 'text-muted hover:text-mid'
                }`}
              >
                Shop By Category
                {catalogBrowseMode === 'category' ? (
                  <span
                    className="pointer-events-none absolute inset-x-0 -bottom-px z-[1] h-0.5 bg-walnut"
                    aria-hidden
                  />
                ) : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={catalogBrowseMode === 'collection'}
                onClick={() => setCatalogBrowseMode('collection')}
                className={`relative flex-1 basis-1/2 cursor-pointer py-3.5 text-center text-[12px] font-semibold tracking-wide transition-colors md:py-4 md:text-[13px] ${
                  catalogBrowseMode === 'collection'
                    ? 'text-walnut'
                    : 'text-muted hover:text-mid'
                }`}
              >
                Shop By Collection
                {catalogBrowseMode === 'collection' ? (
                  <span
                    className="pointer-events-none absolute inset-x-0 -bottom-px z-[1] h-0.5 bg-walnut"
                    aria-hidden
                  />
                ) : null}
              </button>
            </div>
          </div>

          <div className="mt-4 flex w-full flex-col pb-4">
            <div className="w-full min-w-0">
              {catalogBrowseMode === 'category' ? (
                customerCategories.length === 0 && !filterMetaLoaded ? (
                  <ShopPageLoader />
                ) : customerCategories.length === 0 ? (
                  <div className="rounded-2xl border border-pale bg-cream px-4 py-10 text-center text-[13px] text-muted">
                    No categories are available yet.
                  </div>
                ) : (
                  <>
                    <div className="flex w-full min-w-0 flex-col gap-3 md:flex-row md:snap-x md:snap-mandatory md:overflow-x-auto md:overflow-y-visible md:pb-0 [scrollbar-width:thin] [-ms-overflow-style:auto] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-pale/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-walnut/25 hover:[&::-webkit-scrollbar-thumb]:bg-walnut/40">
                      {customerCategories.map((row) => {
                        const imgSrc = categoryCardImageSrc(row.image);
                        return (
                          <button
                            key={row.category}
                            type="button"
                            aria-label={formatCategoryDisplayName(row.category)}
                            onClick={() => selectShopCategoryFromCatalog(row.category)}
                            className="group min-w-full max-w-full cursor-pointer md:min-w-[calc((100%-1.5rem)/3)] md:max-w-[calc((100%-1.5rem)/3)] shrink-0 snap-start text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-walnut/40 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                          >
                            <div className="pointer-events-none flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-pale/90 bg-[#F2E6D4] shadow-sm transition group-hover:border-walnut/30 group-hover:shadow-md">
                              <div className="relative aspect-square w-full overflow-hidden rounded-t-2xl bg-[#F2E6D4]">
                                {imgSrc ? (
                                  <SafeImage
                                    src={imgSrc}
                                    alt=""
                                    draggable={false}
                                    className="h-full w-full object-cover select-none [-webkit-user-drag:none] transition duration-300 group-hover:scale-[1.02]"
                                    loading="lazy"
                                  />
                                ) : (
                                  <CategoryCardNoImagePlaceholder />
                                )}
                              </div>
                              <div className="flex flex-1 flex-col px-4 pb-4 pt-4">
                                <p className="text-center font-serif text-[17px] font-bold leading-snug text-ink line-clamp-2 md:text-[18px]">
                                  {formatCategoryDisplayName(row.category)}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )
              ) : customerCollections.length === 0 && !filterMetaLoaded ? (
                <ShopPageLoader />
              ) : customerCollections.length === 0 ? (
                <div className="rounded-2xl border border-pale bg-cream px-4 py-10 text-center text-[13px] text-muted">
                  No collections are available yet.
                </div>
              ) : (
                <>
                  <div className="flex w-full min-w-0 flex-col gap-3 md:flex-row md:snap-x md:snap-mandatory md:overflow-x-auto md:overflow-y-visible md:pb-0 [scrollbar-width:thin] [-ms-overflow-style:auto] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-pale/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-walnut/25 hover:[&::-webkit-scrollbar-thumb]:bg-walnut/40">
                    {customerCollections.map((row) => {
                      const imgSrc = categoryCardImageSrc(row.image);
                      return (
                        <button
                          key={row.id}
                          type="button"
                          aria-label={formatCategoryDisplayName(row.name)}
                          onClick={() => selectShopCollectionFromCatalog(row.id)}
                          className="group min-w-full max-w-full cursor-pointer md:min-w-[calc((100%-1.5rem)/3)] md:max-w-[calc((100%-1.5rem)/3)] shrink-0 snap-start text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-walnut/40 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                        >
                          <div className="pointer-events-none flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-pale/90 bg-[#F2E6D4] shadow-sm transition group-hover:border-walnut/30 group-hover:shadow-md">
                            <div className="relative aspect-square w-full overflow-hidden rounded-t-2xl bg-[#F2E6D4]">
                              {imgSrc ? (
                                <SafeImage
                                  src={imgSrc}
                                  alt=""
                                  draggable={false}
                                  className="h-full w-full object-cover select-none [-webkit-user-drag:none] transition duration-300 group-hover:scale-[1.02]"
                                  loading="lazy"
                                />
                              ) : (
                                <CategoryCardNoImagePlaceholder />
                              )}
                            </div>
                            <div className="flex flex-1 flex-col px-4 pb-4 pt-4">
                              <p className="text-center font-serif text-[17px] font-bold leading-snug text-ink line-clamp-2 md:text-[18px]">
                                {formatCategoryDisplayName(row.name)}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={openViewAllProducts}
              className="group relative isolate mt-4 min-h-[5.75rem] w-full shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-pale bg-white text-left shadow-sm transition hover:border-pale hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-walnut/40 focus-visible:ring-offset-2 focus-visible:ring-offset-cream md:mt-6 md:min-h-[6.25rem]"
            >
              <div className="relative z-10 flex min-h-[5.75rem] items-center justify-between gap-3 px-4 py-3 md:min-h-[6.25rem] md:gap-4 md:px-6 md:py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[14px] font-extrabold leading-tight text-ink transition-colors duration-300 group-hover:text-walnut md:text-[15px]">
                    View all Jewellery
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted transition-colors duration-300 group-hover:text-walnut/85 md:text-[12px]">
                    {catalogBrowseMode === 'category'
                      ? totalCatalogProducts != null
                        ? `${totalCatalogProducts} pieces across all categories`
                        : 'Browse the full catalogue'
                      : totalCollectionCatalogProducts != null
                        ? `${totalCollectionCatalogProducts} pieces across all collections`
                        : 'Browse the full catalogue'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 md:gap-3">
                  {(catalogBrowseMode === 'category'
                    ? viewAllPreviewCategories
                    : viewAllPreviewCollections
                  ).length > 0 ? (
                    <div className="flex items-center" aria-hidden>
                      <div className="flex items-center -space-x-2.5 md:-space-x-3">
                        {(catalogBrowseMode === 'category'
                          ? viewAllPreviewCategories
                          : viewAllPreviewCollections
                        ).map((row, idx) => (
                          <div
                            key={
                              catalogBrowseMode === 'category'
                                ? `${row.category}-${idx}`
                                : `${row.id}-${idx}`
                            }
                            className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-pale/80 bg-[#F2E6D4] shadow-sm md:h-10 md:w-10"
                            style={{ zIndex: idx + 1 }}
                          >
                            <SafeImage
                              src={categoryCardImageSrc(row.image)}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <span
                    className="flex shrink-0 items-center text-walnut/70 transition duration-300 group-hover:translate-x-1 group-hover:text-walnut"
                    aria-hidden
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="md:h-6 md:w-6"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </button>
          </div>
        </>
      ) : (
        <div className={`flex min-h-0 flex-1 flex-col bg-white ${productGridTopClass}`}>
          {showListingContextBanner ? (
            <CatalogContextBanner
              kind={listingContextBanner.kind}
              title={listingContextBanner.title}
              description={listingContextBanner.description}
              image={listingContextBanner.image}
              className={shopListingFullBleedClass}
            />
          ) : null}
          {loading || !regionReady ? (
            <ShopPageLoader />
          ) : items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-4">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-pale bg-white text-muted">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </div>
                <p className="mt-4 text-[14px] font-bold text-ink">No products found</p>
                <p className="mt-1 text-[12px] text-muted">Try changing filters or search.</p>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`grid grid-cols-2 items-stretch ${desktopGridColsClass} gap-0 pb-20 md:pb-0 ${shopListingFullBleedClass} ${listingGridBorderClass}`}
              >
                {featuredFirstItems.map((p, idx) => (
                  <ProductGridCard
                    key={String(p?.id ?? p?._id ?? p?.productId ?? Math.random())}
                    product={p}
                    variant="listing"
                    listingIndex={idx}
                    onNavigate={() => navigate(`/customer/shopping/${p?.id ?? p?._id ?? p?.productId ?? ''}`)}
                    onAddToCart={() => openAddToCart(p)}
                  />
                ))}
              </div>
              <ListPaginationBar
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={meta?.total}
                canPrev={canPrev}
                canNext={canNext}
                fixedOnMobile
                onPrev={() => fetchList({ nextPage: Math.max(1, currentPage - 1), query: q })}
                onNext={() => fetchList({ nextPage: currentPage + 1, query: q })}
              />
            </>
          )}
        </div>
      )}

      {/* Add-to-cart quantity picker */}
      {cartOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={closeAddToCart}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 border-b border-pale flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-ink">Add to cart</p>
                <p className="text-[13px] md:text-[14px] text-muted mt-1 truncate">{cartProduct?.name || 'Product'}</p>
              </div>
              <button
                type="button"
                onClick={closeAddToCart}
                className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer disabled:opacity-50"
                aria-label="Close"
                disabled={cartAdding}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            <div className="px-5 py-5">
              {cartVariants.length ? (
                <div className="mb-5">
                  <p className="text-[13px] font-semibold text-mid">Size Options</p>
                  <div className="mt-3 space-y-2">
                    {cartVariants.map((v, idx) => {
                      const checked = Number(cartVariantIdx) === idx;
                      const types = getProductDiamondTypes(cartProduct);
                      const diamondType =
                        types.length === 1
                          ? types[0]
                          : types.includes(diamondTypeFilter)
                            ? diamondTypeFilter
                            : null;
                      const resolved = resolveDiamondUnitPricing(cartProduct, v, diamondType);
                      const price = Number(resolved?.price);
                      const compareAt = Number(resolved?.compareAt);
                      const showPrice = Number.isFinite(price) && price > 0;
                      const showCompare =
                        Number.isFinite(compareAt) && compareAt > 0 && compareAt > price;
                      return (
                        <label
                          key={String(idx)}
                          className="flex items-start gap-3 p-3 rounded-2xl border border-pale bg-cream/60 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="cart_variant"
                            checked={checked}
                            onChange={() => setCartVariantIdx(idx)}
                            className="mt-1 w-4 h-4 text-ink focus:ring-walnut/30"
                            disabled={cartAdding}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[12px] font-bold text-ink truncate">{variantLabel(v)}</p>
                              {showPrice ? (
                                <div className="flex flex-col items-end gap-0.5 shrink-0">
                                  <p className="text-[12px] font-extrabold text-ink">
                                    {formatCurrency(price, cartProduct?.currency)}
                                  </p>
                                  {showCompare ? (
                                    <p className="text-[11px] text-muted line-through">
                                      {formatCurrency(compareAt, cartProduct?.currency)}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-[11px] text-muted">Select this option to add this variant.</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-mid">Quantity</p>
                <div className="inline-flex items-center overflow-hidden rounded-xl bg-walnut text-blush">
                  <button
                    type="button"
                    onClick={() => setCartQty((v) => Math.max(1, (Number(v) || 1) - 1))}
                    className="w-10 h-10 flex items-center justify-center hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    disabled={cartAdding || Number(cartQty) <= 1}
                    aria-label="Decrease quantity"
                  >
                    –
                  </button>
                  <input
                    value={cartQty}
                    onChange={(e) => setCartQty(e.target.value)}
                    inputMode="numeric"
                    className="w-12 h-10 bg-transparent text-center text-[13px] font-bold text-ink outline-none"
                    aria-label="Quantity"
                    disabled={cartAdding}
                  />
                  <button
                    type="button"
                    onClick={() => setCartQty((v) => (Number(v) || 1) + 1)}
                    className="w-10 h-10 flex items-center justify-center hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    disabled={cartAdding}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-pale bg-white flex justify-end gap-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <button
                type="button"
                onClick={closeAddToCart}
                className="px-4 py-2 rounded-xl border border-pale text-[12px] font-semibold text-mid hover:bg-cream cursor-pointer disabled:opacity-50"
                disabled={cartAdding}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAddToCart}
                className="px-5 py-2 rounded-xl bg-walnut text-blush text-[12px] font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                disabled={cartAdding || (cartVariants.length > 0 && !selectedCartVariant)}
              >
                {cartAdding ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
