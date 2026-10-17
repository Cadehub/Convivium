/**
 * Firebase public web configuration (Cloud Messaging only).
 *
 * Everything read here is PUBLIC by design (it ships in every Firebase web app):
 *   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
 *   VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID, VITE_FIREBASE_VAPID_KEY
 * The Google service-account private key is NEVER used here: it only exists as an
 * Edge Function secret (see docs/PUSH_NOTIFICATIONS.md).
 */

export interface FirebasePublicConfig {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
}

export const FIREBASE_SW_PATH = '/firebase-messaging-sw.js';

export function readFirebaseConfig(
  env: Record<string, string | undefined>
): FirebasePublicConfig | null {
  const apiKey = env.VITE_FIREBASE_API_KEY?.trim();
  const projectId = env.VITE_FIREBASE_PROJECT_ID?.trim();
  const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim();
  const appId = env.VITE_FIREBASE_APP_ID?.trim();
  const vapidKey = env.VITE_FIREBASE_VAPID_KEY?.trim();
  if (!apiKey || !projectId || !messagingSenderId || !appId || !vapidKey) return null;
  return {
    apiKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || undefined,
    projectId,
    messagingSenderId,
    appId,
    vapidKey,
  };
}

export function getFirebaseConfig(): FirebasePublicConfig | null {
  return readFirebaseConfig(import.meta.env as unknown as Record<string, string | undefined>);
}

export function isPushConfigured(): boolean {
  return getFirebaseConfig() !== null;
}

/** The service worker receives the public config through its URL (workers cannot read Vite env). */
export function buildServiceWorkerUrl(config: FirebasePublicConfig): string {
  const params = new URLSearchParams({
    apiKey: config.apiKey,
    projectId: config.projectId,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  });
  if (config.authDomain) params.set('authDomain', config.authDomain);
  return `${FIREBASE_SW_PATH}?${params.toString()}`;
}

/** Lazy: the Firebase SDK is only downloaded once a user actually uses notifications. */
export async function getMessagingInstance() {
  const config = getFirebaseConfig();
  if (!config) return null;
  const [{ initializeApp, getApps, getApp }, { getMessaging, isSupported }] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ]);
  if (!(await isSupported())) return null;
  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      });
  return getMessaging(app);
}
