/** The editor and its library, loaded only when someone opens it: nothing of it is in the page's own bundle. */
export const loadEditor = () => import('./ImageEditor');
