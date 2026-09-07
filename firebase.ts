import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const env = import.meta.env;

const firebaseConfig: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'any-location-36e76.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'any-location-36e76',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'any-location-36e76.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

const missingConfiguration = [
  ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['VITE_FIREBASE_APP_ID', firebaseConfig.appId],
  ['VITE_FIREBASE_MESSAGING_SENDER_ID', firebaseConfig.messagingSenderId],
].filter(([, value]) => !value).map(([name]) => name);

if (missingConfiguration.length > 0) {
  throw new Error(
    `Firebase project any-location-36e76 is not configured. Missing: ${missingConfiguration.join(', ')}. ` +
    'Copy .env.example to .env.local and paste the Web SDK values from Firebase Project settings.',
  );
}

const existingApp = getApps().length > 0;
export const app = existingApp ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
const databaseId = env.VITE_FIREBASE_DATABASE_ID || '(default)';
export const db = existingApp
  ? getFirestore(app, databaseId)
  : initializeFirestore(
      app,
      {
        ignoreUndefinedProperties: true,
        experimentalAutoDetectLongPolling: true,
      },
      databaseId,
    );
export const storage = getStorage(app);
export { firebaseConfig };
