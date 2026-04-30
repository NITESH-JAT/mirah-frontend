/**
 * Notification deep links (PRD §2.2.5): `data.page_to_navigate` + `data.page_navigation_params`.
 * Paths must be canonical customer or vendor routes; role must match current user.
 */

export const NOTIFICATION_CUSTOMER_TEMPLATES = [
  '/customer/shopping',
  '/customer/shopping/:id',
  '/customer/shopping/:id/similar',
  '/customer/cart',
  '/customer/checkout',
  '/customer/orders',
  '/customer/orders/success',
  '/customer/profile',
  '/customer/faq',
  '/customer/projects',
  '/customer/projects/:id',
  '/customer/projects/:id/bids',
  '/customer/vendors/:vendorId',
  '/customer/messages',
];

export const NOTIFICATION_VENDOR_TEMPLATES = [
  '/vendor/shop',
  '/vendor/explore',
  '/vendor/explore/:id',
  '/vendor/bids',
  '/vendor/bids/:id',
  '/vendor/projects',
  '/vendor/projects/:id',
  '/vendor/kyc',
  '/vendor/profile',
  '/vendor/reviews',
  '/vendor/diamond-guidelines',
  '/vendor/faq',
  '/vendor/messages',
];

const EXTRA_QUERY_KEYS = new Set(['tab', 'filter', 'view']);

function normalizePathname(p) {
  let x = String(p || '').trim();
  if (x.length > 1 && x.endsWith('/')) x = x.slice(0, -1);
  return x;
}

function parseNotificationData(raw) {
  if (raw == null) return {};
  let obj = {};
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    obj = { ...raw };
  } else return {};

  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    const inner = obj.data;
    return {
      ...inner,
      page_to_navigate: obj.page_to_navigate ?? inner.page_to_navigate,
      page_navigation_params: obj.page_navigation_params ?? inner.page_navigation_params,
    };
  }
  return obj;
}

function extractNav(notification) {
  const obj = parseNotificationData(notification?.data);
  const page =
    obj.page_to_navigate ??
    obj.pageToNavigate ??
    notification?.page_to_navigate ??
    notification?.pageToNavigate ??
    '';
  const paramsRaw =
    obj.page_navigation_params ??
    obj.pageNavigationParams ??
    notification?.page_navigation_params ??
    {};
  const params =
    paramsRaw && typeof paramsRaw === 'object' && !Array.isArray(paramsRaw) ? { ...paramsRaw } : {};
  return { page: String(page || '').trim(), params };
}

function splitPathAndQuery(page) {
  const i = page.indexOf('?');
  if (i === -1) return { pathname: page, queryFromPage: '' };
  return { pathname: page.slice(0, i), queryFromPage: page.slice(i + 1) };
}

function firstVal(obj, keys) {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

function resolveSegment(paramName, template, params) {
  if (paramName === 'vendorId') {
    return firstVal(params, ['vendorId', 'vendor_id']);
  }
  if (paramName !== 'id') {
    return firstVal(params, [paramName]);
  }
  if (template.includes('/customer/shopping')) {
    return firstVal(params, ['productId', 'product_id', 'id']);
  }
  if (
    template.includes('/customer/projects/') ||
    template.includes('/vendor/explore/') ||
    template.includes('/vendor/projects/') ||
    template.includes('/vendor/bids/')
  ) {
    return firstVal(params, ['projectId', 'project_id', 'id']);
  }
  return firstVal(params, ['id', 'projectId', 'productId']);
}

function templateToRegex(template) {
  const segments = template.split('/').filter(Boolean);
  const parts = segments.map((seg) => {
    if (seg.startsWith(':')) return '[^/]+';
    return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return new RegExp(`^/${parts.join('/')}$`);
}

function fillTemplate(template, params, usedParamKeys) {
  const segments = template.split('/').filter(Boolean);
  const out = [];
  for (const seg of segments) {
    if (seg.startsWith(':')) {
      const name = seg.slice(1);
      usedParamKeys.add(name);
      const val = resolveSegment(name, template, params);
      if (val == null || val === '') return null;
      out.push(encodeURIComponent(val));
    } else {
      out.push(seg);
    }
  }
  return `/${out.join('/')}`;
}

function matchResolvedPath(pathname, templates) {
  const normalized = normalizePathname(pathname);
  for (const t of templates) {
    if (t.includes(':')) {
      const re = templateToRegex(t);
      if (re.test(normalized)) return normalized;
    } else if (normalizePathname(t) === normalized) {
      return normalized;
    }
  }
  return null;
}

/**
 * @param {object} notification — API notification row
 * @param {{ isVendor: boolean }} options
 * @returns {string | null} — path + optional query for `react-router` navigate()
 */
export function resolveNotificationHref(notification, { isVendor }) {
  const { page: rawPage, params } = extractNav(notification);
  if (!rawPage) return null;

  const { pathname: rawPath, queryFromPage } = splitPathAndQuery(rawPage);
  const pathname = rawPath.trim();
  if (!pathname.startsWith('/') || pathname.includes('//') || pathname.includes('..')) {
    return null;
  }

  const rolePrefix = isVendor ? '/vendor' : '/customer';
  if (!pathname.startsWith(rolePrefix)) {
    return null;
  }

  const templates = isVendor ? NOTIFICATION_VENDOR_TEMPLATES : NOTIFICATION_CUSTOMER_TEMPLATES;
  const pathnameNorm = normalizePathname(pathname);

  let builtPathname = null;
  const usedParamKeys = new Set();

  if (pathnameNorm.includes(':')) {
    const template = templates.find((t) => normalizePathname(t) === pathnameNorm);
    if (!template) return null;
    builtPathname = fillTemplate(template, params, usedParamKeys);
    if (!builtPathname) return null;
  } else {
    builtPathname = matchResolvedPath(pathnameNorm, templates);
    if (!builtPathname) return null;
  }

  let search;
  try {
    search = new URLSearchParams(queryFromPage || '');
  } catch {
    search = new URLSearchParams();
  }

  for (const k of EXTRA_QUERY_KEYS) {
    if (usedParamKeys.has(k)) continue;
    const v = params[k];
    if (v != null && String(v) !== '' && !search.has(k)) {
      search.set(k, String(v));
    }
  }

  const q = search.toString();
  return q ? `${builtPathname}?${q}` : builtPathname;
}
