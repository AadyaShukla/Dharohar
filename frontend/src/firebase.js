/**
 * Firebase Client SDK Initialization & Authentication Helper for Dharohar.
 * Configured via Vite environment variables (VITE_FIREBASE_*).
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    !firebaseConfig.apiKey.includes('placeholder') &&
    firebaseConfig.apiKey.length > 10
  );
}

let app = null;
let authInstance = null;

export function getFirebaseAuth() {
  if (authInstance) return authInstance;
  try {
    if (!getApps().length) {
      if (firebaseConfig.apiKey && firebaseConfig.projectId) {
        app = initializeApp(firebaseConfig);
      } else {
        // Safe dummy fallback if credentials not yet configured
        app = initializeApp({
          apiKey: 'demo-dummy-firebase-api-key',
          projectId: 'dharohar-prototype-demo',
          authDomain: 'dharohar-prototype-demo.firebaseapp.com',
          appId: '1:1234567890:web:abcdef123456',
        });
      }
    } else {
      app = getApp();
    }
    authInstance = getAuth(app);
    return authInstance;
  } catch (err) {
    console.error('Failed to initialize Firebase Auth:', err);
    return null;
  }
}

/**
 * Initializes or re-initializes a RecaptchaVerifier on the specified DOM element id.
 */
export function initRecaptchaVerifier(containerId = 'recaptcha-container', onSolve) {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase Auth is not available.');
  }

  // Clear existing verifier if previously created
  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (_) {}
    window.recaptchaVerifier = null;
  }

  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: (response) => {
      if (onSolve) onSolve(response);
    },
    'expired-callback': () => {
      console.warn('reCAPTCHA expired. Please retry.');
    },
  });

  return window.recaptchaVerifier;
}

/**
 * Sends SMS verification code via Firebase Phone Auth.
 * Accepts E.164 phone string (e.g. +919876543210).
 * Returns confirmationResult.
 */
export async function sendFirebasePhoneOtp(phoneNumber, verifier) {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Please verify configuration.');
  }
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}
