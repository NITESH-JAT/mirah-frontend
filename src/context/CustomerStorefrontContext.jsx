import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { systemService } from '../services/systemService';

const DEFAULT_STATE = {
  status: 'coming_soon',
  comingSoonMessage: 'Our online store is coming soon. Browse bespoke projects on My Artisan in the meantime.',
  navVisible: true,
  catalogEnabled: false,
  purchasingEnabled: false,
};

const CustomerStorefrontContext = createContext({
  loading: true,
  ...DEFAULT_STATE,
  refresh: async () => {},
});

export function CustomerStorefrontProvider({ children, enabled = true }) {
  const [loading, setLoading] = useState(Boolean(enabled));
  const [config, setConfig] = useState(DEFAULT_STATE);

  const refresh = async () => {
    if (!enabled) {
      setConfig(DEFAULT_STATE);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await systemService.getCustomerStorefront();
      setConfig({
        status: data?.status || DEFAULT_STATE.status,
        comingSoonMessage: data?.comingSoonMessage || DEFAULT_STATE.comingSoonMessage,
        navVisible: Boolean(data?.navVisible),
        catalogEnabled: Boolean(data?.catalogEnabled),
        purchasingEnabled: Boolean(data?.purchasingEnabled),
      });
    } catch {
      setConfig(DEFAULT_STATE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [enabled]);

  const value = useMemo(
    () => ({
      loading,
      status: config.status,
      comingSoonMessage: config.comingSoonMessage,
      navVisible: config.navVisible,
      catalogEnabled: config.catalogEnabled,
      purchasingEnabled: config.purchasingEnabled,
      refresh,
    }),
    [config, loading],
  );

  return <CustomerStorefrontContext.Provider value={value}>{children}</CustomerStorefrontContext.Provider>;
}

export function useCustomerStorefront() {
  return useContext(CustomerStorefrontContext);
}

export function customerDefaultLandingPath(storefront) {
  if (storefront?.navVisible) return '/customer/shopping';
  return '/customer/projects?tab=list';
}
