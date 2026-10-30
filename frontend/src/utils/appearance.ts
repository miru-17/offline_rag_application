export type ThemeMode = "light" | "dark" | "system";

export interface AppearanceSettings {
  compact: boolean;
  animations: boolean;
  theme: ThemeMode;
}

const STORAGE_KEY = "ragentis_appearance";

export const defaultAppearanceSettings: AppearanceSettings = {
  compact: false,
  animations: true,
  theme: "dark",
};

export const getAppearanceSettings =
  (): AppearanceSettings => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        return defaultAppearanceSettings;
      }

      const parsed = JSON.parse(stored);

      return {
        ...defaultAppearanceSettings,
        ...parsed,
      };
    } catch {
      return defaultAppearanceSettings;
    }
  };

export const saveAppearanceSettings = (
  settings: AppearanceSettings,
) => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(settings),
  );
};