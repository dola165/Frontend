import React from 'react';
import { createRoot } from 'react-dom/client';
import { Workspace } from './Workspace';
import './workspace.css';
// Read-only audit for the isolated development preview. The production build
// removes this branch; it never logs payloads, credentials or participant data.
if (import.meta.env.DEV && 'PerformanceObserver' in window) {
  const origins = new Set<string>();
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      const url = new URL(entry.name);
      if (!origins.has(url.origin)) { origins.add(url.origin); console.info('[Map demo network origin]', url.origin); }
      if (/^\/api(?:\/|$)|^\/graphql(?:\/|$)/.test(url.pathname)) console.error('[Map demo unexpected business request]', url.origin + url.pathname);
    }
  }).observe({ type: 'resource', buffered: true });
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Workspace/></React.StrictMode>);
