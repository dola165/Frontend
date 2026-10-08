import { isAndroidApp } from '../../android/bridge';

/** Limit optional cartographic work on phones and constrained browsers. */
export function prefersLightMapRendering() {
  if(isAndroidApp)return true;
  if(typeof window==='undefined')return false;
  const device=navigator as Navigator & {deviceMemory?:number;connection?:{saveData?:boolean}};
  return Boolean(window.matchMedia?.('(max-width: 767px)').matches||device.connection?.saveData||(device.deviceMemory&&device.deviceMemory<=4));
}
