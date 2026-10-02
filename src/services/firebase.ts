/**
 * Firebase bootstrap.
 *
 * The Firebase web config is public by design (these are not secrets), so the
 * values live here as defaults. Every entry can be overridden with a `.env`
 * file (see `.env.example`), which makes it trivial to point a build at a
 * different Firebase project.
 */

import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAnalytics, type Analytics } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyB7dZW0tuEDU1dr5BIPnh9leG95KsXaDb4',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'pallavitraders.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'pallavitraders',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'pallavitraders.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '81196195065',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ?? '1:81196195065:web:f1a2682d760637bd1f5628',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? 'G-9EWB4GXCBL',
}

function getFirebaseApp() {
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
}

let firestoreInstance: Firestore | null = null

export function getDb(): Firestore {
  if (firestoreInstance) return firestoreInstance
  const app = getFirebaseApp()
  try {
    // Offline-first cache so the admin can keep working through a dropped
    // connection; queued writes are flushed when connectivity returns.
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch {
    // Falls back to in-memory caching if persistence is unavailable
    // (private browsing, older browsers, or a second initialise call).
    firestoreInstance = getFirestore(app)
  }
  return firestoreInstance
}

let analyticsInstance: Analytics | null = null

/**
 * Analytics is opt-in: it only starts when VITE_ENABLE_ANALYTICS is exactly
 * 'true' and a measurement id is configured. It is resolved lazily rather than
 * at module load because `getAnalytics` throws outside a secure context
 * (plain http on a LAN address, for example), which must not take down the
 * whole app. Returns null whenever analytics is off or unavailable.
 */
export function getAnalyticsIfEnabled(): Analytics | null {
  if (analyticsInstance) return analyticsInstance
  if (import.meta.env.VITE_ENABLE_ANALYTICS !== 'true') return null
  if (!firebaseConfig.measurementId) return null
  try {
    analyticsInstance = getAnalytics(getFirebaseApp())
  } catch {
    analyticsInstance = null
  }
  return analyticsInstance
}

export const auth = getAuth(getFirebaseApp())
export const db = getDb()
