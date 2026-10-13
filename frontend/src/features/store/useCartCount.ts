import { useEffect, useState } from 'react';
import { readCart } from './cart';

/** How many lines the cart holds, kept current when this or another tab changes it. */
export function useCartCount() {
    const [count, setCount] = useState(() => readCart().length);
    useEffect(() => {
        const update = () => setCount(readCart().length);
        window.addEventListener('storage', update);
        window.addEventListener('gk-cart', update);
        return () => { window.removeEventListener('storage', update); window.removeEventListener('gk-cart', update); };
    }, []);
    return count;
}
