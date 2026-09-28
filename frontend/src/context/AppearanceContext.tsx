import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  defaultAppearanceSettings,
  getAppearanceSettings,
  saveAppearanceSettings,
  type AppearanceSettings,
  type ThemeMode,
} from "../utils/appearance";

interface AppearanceContextValue {
  settings: AppearanceSettings;
  setCompact: (value: boolean) => void;
  setAnimations: (value: boolean) => void;
  setTheme: (value: ThemeMode) => void;
}

const AppearanceContext =
  createContext<AppearanceContextValue | undefined>(
    undefined,
  );

interface AppearanceProviderProps {
  children: ReactNode;
}

export function AppearanceProvider({
  children,
}: AppearanceProviderProps) {
  const [settings, setSettings] =
    useState<AppearanceSettings>(() => {
      const savedSettings = getAppearanceSettings();
      return {
        ...defaultAppearanceSettings,
        ...savedSettings,
      };
    });

  useEffect(() => {
    saveAppearanceSettings(settings);
  }, [settings]);

  const value = useMemo(
    () => ({
      settings,

      setCompact: (value: boolean) => {
        setSettings((previous) => ({
          ...previous,
          compact: value,
        }));
      },

      setAnimations: (value: boolean) => {
        setSettings((previous) => ({
          ...previous,
          animations: value,
        }));
      },

      setTheme: (value: ThemeMode) => {
        setSettings((previous) => ({
          ...previous,
          theme: value,
        }));
      },
    }),
    [settings],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);

  if (!context) {
    throw new Error(
      "useAppearance must be used inside AppearanceProvider",
    );
  }

  return context;
}