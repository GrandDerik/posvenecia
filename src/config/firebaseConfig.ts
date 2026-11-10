import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
  measurementId?: string;
  oAuthClientId?: string;
}

// Read configuration exclusively from Vite environment variables (import.meta.env) with active project defaults
export const firebaseConfig: FirebaseClientConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDKMG2tIxJNlEWH9zfZODyLFvw3ckkSZSw',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'gen-lang-client-0878270695.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0878270695',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'gen-lang-client-0878270695.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '304580032049',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:304580032049:web:ffebf0cb8a0ce41cbbc710',
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-puntodeventavene-02f013f6-59ff-468a-bab5-b3cb84f54e52',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
  oAuthClientId: import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID || '304580032049-he01jhueqb8b2g7du98aks9co0f62hft.apps.googleusercontent.com'
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== 'AIzaSy...' &&
  !firebaseConfig.apiKey.includes('...') &&
  firebaseConfig.projectId !== 'tu-proyecto' &&
  firebaseConfig.projectId !== 'posvenecia-local'
);

// Safe fallback configuration to ensure the application never crashes if environment variables are not yet loaded
const safeConfig = isFirebaseConfigured
  ? firebaseConfig
  : {
      apiKey: firebaseConfig.apiKey || 'AIzaSyPlaceholderKeyForLocalModeOnly123456',
      authDomain: firebaseConfig.authDomain || 'posvenecia-local.firebaseapp.com',
      projectId: firebaseConfig.projectId || 'posvenecia-local',
      storageBucket: firebaseConfig.storageBucket || 'posvenecia-local.firebasestorage.app',
      messagingSenderId: firebaseConfig.messagingSenderId || '123456789012',
      appId: firebaseConfig.appId || '1:123456789012:web:placeholder'
    };

// Initialize Firebase App instance
export const app = getApps().length === 0 ? initializeApp(safeConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with specific database ID if provisioned
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Operation types for error handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export default firebaseConfig;
