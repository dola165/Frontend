import { createContext, useContext } from 'react';

export type BrandStyle = 'pitch' | 'g';
export const BRAND_STYLE_KEY = 'gk-brand-style';
export const isBrandStyle = (value: unknown): value is BrandStyle => value === 'pitch' || value === 'g';
export function readBrandStyle(): BrandStyle {
    try { const saved = localStorage.getItem(BRAND_STYLE_KEY); return isBrandStyle(saved) ? saved : 'pitch'; }
    catch { return 'pitch'; }
}
export const BrandStyleContext = createContext<{ style: BrandStyle; setStyle: (style: BrandStyle) => void }>({ style: 'pitch', setStyle: () => undefined });
export const useBrandStyle = () => useContext(BrandStyleContext);
