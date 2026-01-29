import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type TabType = 'finance' | 'todo' | 'inventory';

interface NavigationContextType {
  targetTab: TabType | null;
  setTargetTab: (tab: TabType | null) => void;
  clearTargetTab: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [targetTab, setTargetTab] = useState<TabType | null>(null);

  const clearTargetTab = useCallback(() => {
    setTargetTab(null);
  }, []);

  return (
    <NavigationContext.Provider value={{ targetTab, setTargetTab, clearTargetTab }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}
