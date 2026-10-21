import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import { useMediaSource } from '../../hooks/useMediaSource';

/** Preserves native image presentation while fetching protected bytes with current credentials. */
export const MediaImage = ({ src, loading, onLoad, width, height, ...props }: ImgHTMLAttributes<HTMLImageElement>) => {
    const element = useRef<HTMLImageElement>(null);
    const [nearViewport, setNearViewport] = useState(false);
    const [intrinsicSize, setIntrinsicSize] = useState<{ source: string; width: number; height: number }>();
    const lazy = loading === 'lazy' && typeof IntersectionObserver !== 'undefined';
    useEffect(() => {
        if (!lazy || !element.current) return;
        const image = element.current;
        let active = true;
        // Enter at 300px, release beyond 600px so scrolling at the boundary
        // does not repeatedly download the same protected image.
        const enter = new IntersectionObserver(entries => {
            if (active && entries.some(entry => entry.target === image && entry.isIntersecting)) setNearViewport(true);
        }, { rootMargin: '300px' });
        const exit = new IntersectionObserver(entries => {
            if (active && entries.some(entry => entry.target === image && !entry.isIntersecting)) setNearViewport(false);
        }, { rootMargin: '600px' });
        enter.observe(image);
        exit.observe(image);
        return () => {
            active = false;
            enter.disconnect();
            exit.disconnect();
        };
    }, [lazy]);
    const resolved = useMediaSource(src, !lazy || nearViewport);
    const remembered = intrinsicSize?.source === src ? intrinsicSize : undefined;
    return <img decoding="async" {...props} ref={element} loading={loading} src={resolved}
        width={width ?? remembered?.width} height={height ?? remembered?.height}
        onLoad={event => {
            const image = event.currentTarget;
            if (image.naturalWidth > 0 && image.naturalHeight > 0 && src) {
                setIntrinsicSize({ source: src, width: image.naturalWidth, height: image.naturalHeight });
            }
            onLoad?.(event);
        }} />;
};
