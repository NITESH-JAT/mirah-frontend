import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  detectCountryFromClientIp,
  regionService,
} from '../services/regionService';
import { useAuth } from './AuthContext';

export const RegionContext = createContext(null);

export function useRegion() {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error('useRegion must be used within RegionProvider');
  return ctx;
}

function emitRegionUpdated(detail) {
  try {
    window.dispatchEvent(new CustomEvent('mirah_region_updated', { detail }));
  } catch {
    // ignore
  }
}

export function RegionProvider({ children }) {
  const { user, setUser } = useAuth();
  const userId = user?.id ?? null;
  const [region, setRegionState] = useState(null);
  const [options, setOptions] = useState([]);
  const [examples, setExamples] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [geoFailed, setGeoFailed] = useState(false);
  const geoFallbackToastSent = useRef(false);

  const applyPayload = useCallback((data) => {
    if (!data) return null;
    const next = {
      countryCode: data.countryCode,
      countryName: data.countryName,
      flag: data.flag,
      currency: data.currency,
      source: data.source,
    };
    setRegionState(next);
    setOptions(data.options || []);
    setExamples(data.examples || null);
    return next;
  }, []);

  const applyToAuthUser = useCallback(
    (next) => {
      if (!next || typeof setUser !== 'function') return;
      setUser((prev) => {
        if (!prev) return prev;
        const merged = {
          ...prev,
          region: {
            countryCode: next.countryCode,
            countryName: next.countryName,
            flag: next.flag,
            currency: next.currency,
          },
        };
        try {
          localStorage.setItem('mirah_session_user', JSON.stringify(merged));
        } catch {
          // ignore
        }
        return merged;
      });
    },
    [setUser]
  );

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setGeoFailed(false);
    try {
      let data = await regionService.getRegion();
      let usedClientGeo = false;
      let failedGeo = false;

      // No signed preference yet → client geo, then POST so pricing APIs see the cookie.
      if (data?.source === 'fallback' || !data?.countryCode) {
        const hint = await detectCountryFromClientIp();
        if (hint) {
          try {
            data = await regionService.setRegion(hint);
            usedClientGeo = true;
          } catch {
            failedGeo = true;
          }
        } else {
          failedGeo = true;
        }
      }

      setGeoFailed(failedGeo);

      if (data) {
        const next = applyPayload(data);
        applyToAuthUser(next);
        emitRegionUpdated({ ...data, usedClientGeo, geoFailed: failedGeo, bootstrap: true });
        if (failedGeo && !geoFallbackToastSent.current) {
          geoFallbackToastSent.current = true;
          try {
            window.dispatchEvent(
              new CustomEvent('mirah_region_geo_fallback', {
                detail: {
                  countryCode: data.countryCode,
                  currency: data.currency,
                },
              })
            );
          } catch {
            // ignore
          }
        }
      }
    } catch {
      setGeoFailed(true);
      // Keep UI usable; pricing APIs still resolve their own region (fallback).
    } finally {
      setLoading(false);
    }
  }, [applyPayload, applyToAuthUser]);

  // Re-fetch whenever auth identity changes (login / logout), so navbar
  // doesn't keep a stale region after the cookie was cleared.
  useEffect(() => {
    void bootstrap();
  }, [bootstrap, userId]);

  const setCountry = useCallback(
    async (countryCode) => {
      if (!countryCode) return null;
      setUpdating(true);
      try {
        const data = await regionService.setRegion(countryCode);
        if (data) {
          const next = applyPayload(data);
          applyToAuthUser(next);
          setGeoFailed(false);
          emitRegionUpdated({ ...data, bootstrap: false });
        }
        return data;
      } finally {
        setUpdating(false);
      }
    },
    [applyPayload, applyToAuthUser]
  );

  const value = useMemo(
    () => ({
      region,
      options,
      examples,
      loading,
      /** True once first bootstrap finished (cookie set or fallback accepted). */
      ready: !loading,
      updating,
      geoFailed,
      setCountry,
      refresh: bootstrap,
      /** Convenience aliases — prefer these over digging into `region`. */
      currency: region?.currency || 'INR',
      countryCode: region?.countryCode || null,
      countryName: region?.countryName || null,
      flag: region?.flag || null,
      source: region?.source || null,
      /** Presentment-localized UI examples (e.g. budget placeholder). */
      budgetExample: examples?.budgetPerPiece || '25000',
    }),
    [region, options, examples, loading, updating, geoFailed, setCountry, bootstrap]
  );

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}
