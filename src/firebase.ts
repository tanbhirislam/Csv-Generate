import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

// Auth Helpers
export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

// Firestore Types
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user';
  createdAt: Timestamp;
  lastLogin: Timestamp;
}

export interface AppSetting {
  maintenanceMode: boolean;
  defaultRPM: number;
  allowedProviders: string[];
  siteName: string;
  siteDescription: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  footerText: string;
  heroTitle: string;
  heroSubtitle: string;
  heroTitleColor?: string;
  heroSubtitleColor?: string;
  settingsTitle: string;
  tutorialText: string;
  tutorialUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
}

export interface UsageLog {
  userId: string;
  platform: string;
  timestamp: Timestamp;
  fileCount: number;
}
