import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey:
    (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined) ??
    'AIzaSyASlYuftePuGmEmJenc0TXvisb9jwn0798',
  authDomain:
    (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) ??
    'campuspay-xrpl.firebaseapp.com',
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ?? 'campuspay-xrpl',
  storageBucket:
    (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) ??
    'campuspay-xrpl.firebasestorage.app',
  messagingSenderId:
    (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) ?? '1015789484958',
  appId:
    (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined) ??
    '1:1015789484958:web:914185f168ca99b263748f',
};

export const firebaseApp = initializeApp(config);
export const firestoreDb = getFirestore(firebaseApp);
