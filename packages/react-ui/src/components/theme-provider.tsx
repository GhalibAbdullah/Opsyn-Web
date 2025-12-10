import { createContext, useContext, useEffect, useState } from 'react';
import * as RippleHook from 'use-ripple-hook';

import { flagsHooks } from '@/hooks/flags-hooks';
import { colorsUtils } from '@/lib/color-util';
import OpSynFavicon from '../assets/img/custom/opsyn-favicon.svg';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

const setFavicon = (url: string) => {
  let link: HTMLLinkElement | null =
    document.querySelector("link[rel*='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'shortcut icon';
    document.head.appendChild(link);
  }
  link.href = url;
};

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'ap-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme,
  );
  const branding = flagsHooks.useWebsiteBranding();
  useEffect(() => {
    if (!branding) {
      console.warn('Website brand is not defined');
      return;
    }
    const root = window.document.documentElement;

    const resolvedTheme = theme === 'system' ? 'light' : theme;
    root.classList.remove('light', 'dark');
    document.title = 'OpSyn';

    // Force OpSyn blue primary palette regardless of backend branding colors
    const primaryDefault = '#2563EB';
    const primaryLight = '#DBEAFE';
    const primaryDark = '#1D4ED8';

    document.documentElement.style.setProperty(
      '--primary',
      colorsUtils.hexToHslString(primaryDefault),
    );

    // Always use the OpSyn favicon instead of backend-provided favIconUrl
    setFavicon(OpSynFavicon);
    switch (resolvedTheme) {
      case 'light': {
        document.documentElement.style.setProperty(
          '--primary-100',
          colorsUtils.hexToHslString(primaryLight),
        );
        document.documentElement.style.setProperty(
          '--primary-300',
          colorsUtils.hexToHslString(primaryDark),
        );
        break;
      }
      case 'dark': {
        document.documentElement.style.setProperty(
          '--primary-100',
          colorsUtils.hexToHslString(primaryDark),
        );
        document.documentElement.style.setProperty(
          '--primary-300',
          colorsUtils.hexToHslString(primaryLight),
        );
        break;
      }
      default:
        break;
    }

    root.classList.add(resolvedTheme);
  }, [theme, branding]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};

export const useApRipple = () => {
  const { theme } = useTheme();
  return RippleHook.default({
    color:
      theme === 'dark'
        ? 'rgba(233, 233, 233, 0.2)'
        : 'rgba(155, 155, 155, 0.2)',
    cancelAutomatically: true,
  });
};
