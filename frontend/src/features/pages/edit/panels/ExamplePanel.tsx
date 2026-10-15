import { useEffect, useState } from 'react';
import { Dialog } from '../../../../design/Dialog';
import { usePagesCopy } from '../../copy';
import { usePageEdit } from '../context';
import '../edit.css';

/** The example is always the same 1280×836 picture of a page, scaled to the screen: the same framing on a phone, a laptop or a wide monitor. */
export const EXAMPLE_WIDTH = 1280, EXAMPLE_HEIGHT = 836;
/** The app's own header sits above the page in the live frame; the frame is shifted up by it, so the pop-up shows the page alone. */
const APP_HEADER = 73;
export const EXAMPLE_STILL = '/examples/club-page.jpg';
const fit = () => Math.min(1, (window.innerWidth - 72) / EXAMPLE_WIDTH, (window.innerHeight - 190) / EXAMPLE_HEIGHT);

/**
 * "See a full page": a finished club page (Dinamo's, as visitors see it) in a pop-up, live and tappable, scaled so
 * the whole page fits whatever screen this is. The still picture shows first, the live page replaces it once loaded.
 */
export function ExamplePanel() {
  const t = usePagesCopy();
  const { closePanel } = usePageEdit();
  const [scale, setScale] = useState(fit);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const onResize = () => setScale(fit());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return (
    <Dialog open size="lg" title={t('A full club page')} description={t('Dinamo’s page as visitors see it. Tap around: yours can look like this.')} onClose={closePanel} closeLabel={t('Close')}>
      <div className="gk-example" style={{ width: Math.round(EXAMPLE_WIDTH * scale), height: Math.round(EXAMPLE_HEIGHT * scale) }} data-live={live || undefined}>
        <img className="gk-example__still" src={EXAMPLE_STILL} width={EXAMPLE_WIDTH} height={EXAMPLE_HEIGHT} alt={t('A full club page')} style={{ transform: `scale(${scale})` }} />
        <iframe className="gk-example__live" title={t('A full club page')} src="/clubs/1" width={EXAMPLE_WIDTH} height={EXAMPLE_HEIGHT + APP_HEADER} style={{ transform: `scale(${scale}) translateY(-${APP_HEADER}px)` }} onLoad={() => setLive(true)} />
      </div>
    </Dialog>
  );
}
