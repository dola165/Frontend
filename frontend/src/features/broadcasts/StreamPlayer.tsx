import { useEffect, useRef, useState } from 'react';
import { safePlayerUrl, type Playback } from './api';

type Player = { addEventListener: (event: string, listener: () => void) => void; removeEventListener?: (event: string, listener: () => void) => void; pause: () => void };
declare global { interface Window { Stream?: (iframe: HTMLIFrameElement) => Player } }
let sdk: Promise<void> | undefined;
function loadSdk() {
  if (window.Stream) return Promise.resolve();
  if (sdk) return sdk;
  sdk = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://embed.cloudflarestream.com/embed/sdk.latest.js';
    script.async = true;
    const timeout = window.setTimeout(() => finish(new Error('The player did not load.')), 12000);
    function finish(error?: Error) {
      clearTimeout(timeout); script.onload = null; script.onerror = null;
      if (error) { script.remove(); reject(error); } else resolve();
    }
    script.onload = () => finish(window.Stream ? undefined : new Error('The player is unavailable.'));
    script.onerror = () => finish(new Error('The player could not load.'));
    document.head.append(script);
  }).catch(error => { sdk = undefined; throw error; });
  return sdk;
}
export function StreamPlayer({ playback, title, retry }: { playback: Playback; title: string; retry: () => void }) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState('Loading video…');
  const [error, setError] = useState('');
  let src: string | undefined;
  try { src = safePlayerUrl(playback); } catch { /* Render a safe error without using the supplied URL. */ }
  useEffect(() => {
    if (!src || error) return;
    let disposed = false;
    let player: Player | undefined;
    const ready = () => { clearTimeout(timeout); if (!disposed) setStatus('Video ready. Use the player controls to play.'); };
    const failed = () => { clearTimeout(timeout); if (!disposed) setError('The stream could not play. It may be offline or still processing.'); };
    const timeout = window.setTimeout(() => { if (!disposed) setError('Video is taking too long to load. Check your connection and retry.'); }, 20000);
    void loadSdk().then(() => {
      if (disposed || !iframe.current || !window.Stream) return;
      player = window.Stream(iframe.current);
      player.addEventListener('loadeddata', ready); player.addEventListener('error', failed);
    }).catch(failed);
    return () => {
      disposed = true; clearTimeout(timeout);
      player?.removeEventListener?.('loadeddata', ready); player?.removeEventListener?.('error', failed);
      try { player?.pause(); } catch { /* Removing the iframe stops playback too. */ }
    };
  }, [src, error]);
  if (!src || error) return <div role="alert"><p>{error || 'The player address is invalid or expired.'}</p><button type="button" onClick={retry}>Retry video</button></div>;
  return <div><p role="status">{status}</p><iframe ref={iframe} className="broadcast-player" src={src} title={`${title} video player`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>;
}
