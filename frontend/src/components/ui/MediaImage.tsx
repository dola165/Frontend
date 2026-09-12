import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import { useMediaSource } from '../../hooks/useMediaSource';

/** Preserves native image presentation while fetching protected bytes with current credentials. */
export const MediaImage = ({ src, loading, ...props }: ImgHTMLAttributes<HTMLImageElement>) => {
    const element = useRef<HTMLImageElement>(null);
    const [nearViewport, setNearViewport] = useState(false);
    const lazy = loading === 'lazy' && typeof IntersectionObserver !== 'undefined';
    useEffect(() => {
        if (!lazy || !element.current) return;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) {
                setNearViewport(true);
                observer.disconnect();
            }
        }, { rootMargin: '300px' });
        observer.observe(element.current);
        return () => observer.disconnect();
    }, [lazy]);
    const resolved = useMediaSource(src, !lazy || nearViewport);
    return <img {...props} ref={element} loading={loading} src={resolved} />;
};
