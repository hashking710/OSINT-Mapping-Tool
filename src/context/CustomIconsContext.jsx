import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  flushCustomIconsPersistence,
  loadCustomIcons,
  loadCustomIconsAsync,
  newCustomIconId,
  scheduleCustomIconsPersistence,
} from '../utils/customIcons.js';

const CustomIconsContext = createContext(null);

export function CustomIconsProvider({ children }) {
  const [icons, setIcons] = useState(() => loadCustomIcons());

  useEffect(() => {
    let active = true;
    loadCustomIconsAsync().then((stored) => {
      if (active) setIcons(stored);
    });
    const flush = () => flushCustomIconsPersistence();
    window.addEventListener('pagehide', flush);
    return () => {
      active = false;
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  const addIcon = useCallback((name, dataUrl) => {
    const id = newCustomIconId();
    setIcons((cur) => {
      const next = { ...cur, [id]: { name: name || 'Untitled icon', dataUrl } };
      scheduleCustomIconsPersistence(next);
      return next;
    });
    return id;
  }, []);

  const removeIcon = useCallback((id) => {
    setIcons((cur) => {
      if (!cur[id]) return cur;
      const next = { ...cur };
      delete next[id];
      scheduleCustomIconsPersistence(next);
      return next;
    });
  }, []);

  const renameIcon = useCallback((id, name) => {
    setIcons((cur) => {
      if (!cur[id]) return cur;
      const next = { ...cur, [id]: { ...cur[id], name } };
      scheduleCustomIconsPersistence(next);
      return next;
    });
  }, []);

  return (
    <CustomIconsContext.Provider value={{ icons, addIcon, removeIcon, renameIcon }}>
      {children}
    </CustomIconsContext.Provider>
  );
}

export function useCustomIcons() {
  const ctx = useContext(CustomIconsContext);
  if (!ctx)
    throw new Error('useCustomIcons must be used within CustomIconsProvider');
  return ctx;
}
