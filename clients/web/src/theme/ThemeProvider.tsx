/**
 * ThemeProvider — manages theme state and high contrast mode toggle.
 *
 * Validates: Requirement 22.2 (high contrast mode toggle, 7:1 contrast ratio)
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { defaultTheme, highContrastTheme, type Theme } from './tokens';

interface ThemeContextValue {
  theme: Theme;
  isHighContrast: boolean;
  toggleHighContrast: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const HIGH_CONTRAST_STORAGE_KEY = 'chikumiku-high-contrast';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [isHighContrast, setIsHighContrast] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(HIGH_CONTRAST_STORAGE_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });

  const toggleHighContrast = useCallback(() => {
    setIsHighContrast((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, String(next));
      } catch {
        // Storage unavailable — toggle still works in-memory
      }
      return next;
    });
  }, []);

  const theme = isHighContrast ? highContrastTheme : defaultTheme;

  // Apply CSS custom properties when theme changes
  useEffect(() => {
    const root = document.documentElement;
    const { colors } = theme;

    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-secondary', colors.secondary);
    root.style.setProperty('--color-accent', colors.accent);
    root.style.setProperty('--color-warning', colors.warning);
    root.style.setProperty('--color-success', colors.success);
    root.style.setProperty('--color-error', colors.error);
    root.style.setProperty('--color-dark', colors.dark);
    root.style.setProperty('--color-background', colors.background);
    root.style.setProperty('--color-border', colors.border);
    root.style.setProperty('--color-text-primary', colors.textPrimary);
    root.style.setProperty('--color-text-secondary', colors.textSecondary);
    root.style.setProperty('--color-text-muted', colors.textMuted);
    root.style.setProperty('--color-white', colors.white);

    // Toggle data attribute for CSS targeting
    root.dataset.highContrast = String(isHighContrast);
  }, [theme, isHighContrast]);

  const value: ThemeContextValue = {
    theme,
    isHighContrast,
    toggleHighContrast,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
