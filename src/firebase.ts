import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
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
import { ADMIN_USERS, AdminUser } from './types';

export const AUTH_EMAIL_DOMAIN = 'bdcare.foundation';
export const SUPER_ADMIN_USERNAME = 'Kitphiphat03';
export const SUPER_ADMIN_EMAIL = `${SUPER_ADMIN_USERNAME.toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Connect specifically to the provisioned Cloud Firestore database ID on smart-time-ca6f9
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

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

export function usernameToAuthEmail(usernameOrEmail: string): string {
  const clean = (usernameOrEmail || '').trim().toLowerCase();
  if (!clean) return '';
  if (clean.includes('@')) return clean;
  return `${clean}@${AUTH_EMAIL_DOMAIN}`;
}

export function authEmailToUsername(email?: string | null): string {
  const clean = (email || '').trim().toLowerCase();
  if (!clean) return '';
  const preset = ADMIN_USERS.find(
    (u) => usernameToAuthEmail(u.username) === clean
  );
  if (preset) return preset.username;
  if (clean.endsWith(`@${AUTH_EMAIL_DOMAIN}`)) {
    return clean.slice(0, clean.length - AUTH_EMAIL_DOMAIN.length - 1);
  }
  return clean;
}

export function findAdminUserByAuthEmail(email?: string | null): AdminUser | undefined {
  const clean = (email || '').trim().toLowerCase();
  if (!clean) return undefined;
  return ADMIN_USERS.find((u) => usernameToAuthEmail(u.username) === clean);
}

export function isSuperAdminUser(user: User | null | undefined): boolean {
  return Boolean(
    user?.email &&
      user.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
  );
}

export function isProviderDisabledError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === 'auth/operation-not-allowed' ||
    code === 'auth/configuration-not-found' ||
    msg.includes('operation-not-allowed') ||
    msg.includes('configuration-not-found')
  );
}

export function getAuthSignInErrorMessage(err: any): string {
  const code = String(err?.code || '');
  if (isProviderDisabledError(err)) {
    return `ยังไม่ได้เปิดใช้งานวิธีเข้าสู่ระบบ Email/Password ในโปรเจกต์ Firebase (${firebaseConfig.projectId}) กรุณาเปิดใช้ที่ Authentication > Sign-in method > Email/Password`;
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-email'
  ) {
    return 'ชื่อผู้ใช้งาน (Username) หรือรหัสผ่าน (Password) ไม่ถูกต้อง';
  }
  if (code === 'auth/too-many-requests') {
    return 'มีการลองเข้าสู่ระบบผิดหลายครั้ง กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';
  }
  if (code === 'auth/weak-password') {
    return 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
  }
  if (code === 'auth/email-already-in-use') {
    return 'ชื่อผู้ใช้งาน (Username) นี้มีอยู่ในระบบแล้ว';
  }
  if (code === 'auth/network-request-failed') {
    return 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตเพื่อเข้าสู่ระบบ Firebase ได้ กรุณาตรวจสอบสัญญาณเครือข่าย';
  }
  return 'ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบ Username และ Password แล้วลองใหม่อีกครั้ง';
}

/**
 * Sign in exclusively with Username and Password via Firebase Auth.
 * Preset foundation accounts are auto-provisioned on first login in smart-time-ca6f9 if their password matches.
 */
export async function signInWithUsernamePassword(
  username: string,
  password: string
): Promise<User> {
  const cleanUser = (username || '').trim();
  if (!cleanUser || !password) {
    throw { code: 'auth/invalid-credential', message: 'Missing username or password' };
  }

  const email = usernameToAuthEmail(cleanUser);
  const preset = ADMIN_USERS.find(
    (u) => u.username.toLowerCase() === cleanUser.toLowerCase()
  );

  // Verify preset password strictly before touching Firebase Auth
  if (preset && preset.password !== password) {
    throw { code: 'auth/invalid-credential', message: 'Invalid password' };
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (preset && cred.user.displayName !== preset.name) {
      updateProfile(cred.user, { displayName: preset.name }).catch(() => {});
    }
    return cred.user;
  } catch (err: any) {
    const code = String(err?.code || '');
    if (
      preset &&
      preset.password === password &&
      (code === 'auth/user-not-found' || code === 'auth/invalid-credential')
    ) {
      try {
        const created = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(created.user, { displayName: preset.name }).catch(() => {});
        return created.user;
      } catch (createErr: any) {
        if (String(createErr?.code || '') === 'auth/email-already-in-use') {
          throw { code: 'auth/invalid-credential', message: 'Invalid password' };
        }
        throw createErr;
      }
    }
    throw err;
  }
}

/**
 * Create a new staff Username & Password account in Firebase Auth without signing out the active Admin.
 */
export async function createStaffUsernameAccount(
  username: string,
  password: string,
  displayName: string
): Promise<string> {
  const cleanUser = (username || '').trim();
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(cleanUser)) {
    throw new Error('Username ต้องเป็นตัวอักษรภาษาอังกฤษ ตัวเลข หรือ . _ - ความยาว 3-40 ตัวอักษร');
  }
  if (!password || password.length < 6) {
    throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
  }

  const email = usernameToAuthEmail(cleanUser);
  const appName = `staff-creator-${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, appName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    if (displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() }).catch(() => {});
    }
    await signOut(secondaryAuth).catch(() => {});
    return email;
  } finally {
    await deleteApp(secondaryApp).catch(() => {});
  }
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
