import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const SUPER_ADMIN_EMAIL = 'emsrkl1669@gmail.com';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Connect specifically to the provisioned Cloud Firestore database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return errInfo;
}

export function isSuperAdminUser(user: User | null | undefined): boolean {
  return Boolean(
    user?.email &&
      user.emailVerified &&
      user.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
  );
}

export function getAuthSignInErrorMessage(err: any): string | null {
  const code = err?.code || '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return null;
  }
  if (code === 'auth/popup-blocked') {
    return 'เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ Google กรุณาอนุญาต Pop-up สำหรับเว็บนี้แล้วลองใหม่อีกครั้ง';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Auth กรุณาตรวจสอบ Authorized Domains ใน Firebase Console';
  }
  if (code === 'auth/network-request-failed') {
    return 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตเพื่อเข้าสู่ระบบ Google ได้ กรุณาตรวจสอบสัญญาณเครือข่าย';
  }
  return 'ไม่สามารถเชื่อมต่อบัญชี Google ได้ กรุณาลองใหม่อีกครั้ง';
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Boot-time Firestore connectivity verification probe against /test/connection.
 */
export async function testFirestoreConnection(): Promise<{ ok: boolean; offline: boolean }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true, offline: false };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline')) {
      console.error('Please check your Firebase configuration (client is offline):', msg);
      return { ok: false, offline: true };
    }
    // Missing document / unauthenticated / permission error means network reached Firestore server cleanly
    return { ok: true, offline: false };
  }
}

export { firebaseConfig };
