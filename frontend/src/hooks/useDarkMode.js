import { useEffect, useState } from 'react';

const STORAGE_KEY = 'skulinode_theme';

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  const toggle = () => setDark(prev => !prev);

  return [dark, toggle];
}
