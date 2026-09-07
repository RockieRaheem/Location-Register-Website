import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';

export type ApplicationRole = 'admin' | 'country_admin' | 'contributor' | 'manufacturer' | 'financial_institution';

export interface FirebaseUserProfile {
  uid: string;
  email: string;
  name: string;
  avatar: string | null;
  role: ApplicationRole;
  status: 'active' | 'disabled';
  assignedCountryCodes: string[];
}

const applicationRoles: ApplicationRole[] = ['admin', 'country_admin', 'contributor', 'manufacturer', 'financial_institution'];

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function profileFromAuthUser(user: FirebaseUser): FirebaseUserProfile {
  return {
    uid: user.uid,
    email: user.email || '',
    name: user.displayName || user.email?.split('@')[0] || 'Location Register user',
    avatar: user.photoURL,
    role: 'contributor',
    status: 'active',
    assignedCountryCodes: [],
  };
}

export async function ensureFirebaseUserProfile(user: FirebaseUser): Promise<FirebaseUserProfile> {
  const reference = doc(db, 'users', user.uid);
  const snapshot = await getDoc(reference);
  if (snapshot.exists()) {
    const profile = snapshot.data() as FirebaseUserProfile;
    if (!applicationRoles.includes(profile.role)) throw new Error('This account has an invalid application role.');
    if (profile.status !== 'active') throw new Error('This account has been disabled.');
    return profile;
  }

  const profile = profileFromAuthUser(user);
  await setDoc(reference, {
    ...profile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return profile;
}

export async function signInWithGoogle(): Promise<FirebaseUserProfile> {
  const credential = await signInWithPopup(auth, googleProvider);
  return ensureFirebaseUserProfile(credential.user);
}

export async function signInWithEmail(email: string, password: string): Promise<FirebaseUserProfile> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return ensureFirebaseUserProfile(credential.user);
}

export async function createAccount(input: {
  email: string;
  password: string;
  name: string;
}): Promise<FirebaseUserProfile> {
  const credential = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
  await updateProfile(credential.user, { displayName: input.name.trim() });
  await sendEmailVerification(credential.user);
  return ensureFirebaseUserProfile(credential.user);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export function signOutFirebase(): Promise<void> {
  return signOut(auth);
}

export function userFacingAuthError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/email-already-in-use': 'An account already exists for this email.',
    'auth/weak-password': 'Use a password with at least six characters.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in window.',
    'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
    'auth/network-request-failed': 'Firebase could not be reached. Check your connection.',
  };
  return messages[code] || (error instanceof Error ? error.message : 'Authentication failed.');
}
