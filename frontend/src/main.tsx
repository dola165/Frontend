import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import App from './App';
import './index.css';
import './styles/product-identity.css';
import './styles/app-motion.css';
import './android/android.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installNativeFetch, isAndroidApp, nativeSession } from './android/bridge';
import { installAndroidPreferences } from './android/preferences';
import { clearStoredAuth, setStoredAccessToken } from './utils/authStorage';
import { applyDocumentTheme, readThemePreference, themeForRoute } from './theme';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const IdentityProvider = ({ children }: React.PropsWithChildren) => isAndroidApp ? children : <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider>;

async function startApp() {
  if (isAndroidApp) {
    installNativeFetch();
    document.documentElement.classList.add('android-app');
    const [session] = await Promise.all([nativeSession(), installAndroidPreferences()]);
    if (session.active) setStoredAccessToken('native-session'); else clearStoredAuth();
  }
  if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'warn' });
  }

  applyDocumentTheme(themeForRoute(readThemePreference(), window.location.pathname));
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <IdentityProvider>
          <App />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'var(--color-elevated)',
                color: 'var(--color-text)',
                borderColor: 'var(--color-border)',
                fontFamily: 'inherit',
                fontSize: '14px',
                fontWeight: 600,
              },
            }}
          />
        </IdentityProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

startApp().catch(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(<main role="alert" style={{ padding: 24 }}>
    <h1>This screen could not start</h1><p>Close it and try again, or reload it here.</p>
    <button onClick={() => window.location.reload()}>Try again</button>
  </main>);
});
