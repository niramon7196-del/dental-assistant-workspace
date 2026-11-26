/**
 * Firebase bootstrap (client side). Loaded lazily so the app stays light until
 * Hybrid AI is switched on. All values come from Vite env vars (see .env.example).
 *
 * App Check:
 *  - Dev / demo: debug provider. The SDK prints a debug token in the browser console;
 *    register it at Firebase console -> Security -> App Check -> Apps -> (⋮) -> Manage debug tokens.
 *  - NEVER commit a debug token or ship it in a public build.
 */
import type { FirebaseApp } from 'firebase/app';

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export function readFirebaseConfig(): FirebaseWebConfig | null {
  const env = import.meta.env;
  const cfg = {
    apiKey: String(env.VITE_FIREBASE_API_KEY || ''),
    authDomain: String(env.VITE_FIREBASE_AUTH_DOMAIN || ''),
    projectId: String(env.VITE_FIREBASE_PROJECT_ID || ''),
    appId: String(env.VITE_FIREBASE_APP_ID || '')
  };
  if (!cfg.apiKey || !cfg.projectId || !cfg.appId) return null;
  return cfg;
}

let appPromise: Promise<FirebaseApp> | null = null;

export function getFirebaseApp(): Promise<FirebaseApp> {
  if (appPromise) return appPromise;
  appPromise = (async () => {
    const config = readFirebaseConfig();
    if (!config) {
      throw new Error('Firebase config missing (set VITE_FIREBASE_* in .env.local)');
    }
    const { initializeApp } = await import('firebase/app');
    const app = initializeApp(config);

    // App Check must be initialised before any AI Logic call.
    const useDebug =
      import.meta.env.DEV || String(import.meta.env.VITE_APPCHECK_DEBUG || '') === 'true';
    if (useDebug) {
      // `true` => SDK generates a token and logs it to the console for you to register.
      (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string })
        .FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
    initializeAppCheck(app, {
      // With the debug flag above the provider is not contacted; a real reCAPTCHA Enterprise
      // site key is only needed for production attestation.
      provider: new ReCaptchaEnterpriseProvider(
        String(import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY || 'debug-placeholder')
      ),
      isTokenAutoRefreshEnabled: true
    });
    return app;
  })();
  // Allow a retry after a failed init.
  appPromise.catch(() => {
    appPromise = null;
  });
  return appPromise;
}
