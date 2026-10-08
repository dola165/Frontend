import { visualColors } from '../../styles/visualColors';
import { useEffect } from 'react';
import { useMap } from 'react-map-gl/maplibre';

export const FOOTBALL_IMAGE = 'atlas-football';

/** A crisp, locally drawn football sprite; no remote image request or style dependency. */
function footballImage() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(2, 2); ctx.translate(32, 32);
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fillStyle = visualColors.mapFootballMarkersPaint101; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2);
    ctx.fillStyle = visualColors.paper; ctx.fill();
    ctx.strokeStyle = visualColors.mapExperiencePaint96; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.save(); ctx.clip(); ctx.fillStyle = visualColors.mapExperiencePaint96;
    for (let i = 0; i < 5; i++) {
        ctx.save(); ctx.rotate(i * Math.PI * 2 / 5);
        ctx.beginPath(); ctx.moveTo(-9, -27); ctx.lineTo(9, -27);
        ctx.lineTo(6, -19); ctx.lineTo(-6, -19); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(0, -10.5);
        ctx.lineWidth = 1.15; ctx.stroke(); ctx.restore();
    }
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + i * Math.PI * 2 / 5;
        const x = Math.cos(angle) * 10.5, y = Math.sin(angle) * 10.5;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
    return ctx.getImageData(0, 0, 128, 128);
}

export function MapFootballMarkers() {
    const { current: map } = useMap();
    useEffect(() => {
        if (!map) return;
        let installing = false;
        const install = () => {
            if (installing || !map.getStyle() || map.hasImage(FOOTBALL_IMAGE)) return;
            installing = true;
            try {
                const image = footballImage();
                if (image) map.addImage(FOOTBALL_IMAGE, image, { pixelRatio: 2 });
            } finally { installing = false; }
        };
        install(); map.on('styledata', install); map.on('styleimagemissing', install);
        return () => { map.off('styledata', install); map.off('styleimagemissing', install); };
    }, [map]);
    return null;
}
