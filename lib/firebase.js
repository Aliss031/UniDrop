// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAiYgimuSEcEtEXPotEfnTPz_rPt7g8Y5Q",
  authDomain: "unidrop-aliss.firebaseapp.com",
  projectId: "unidrop-aliss",
  storageBucket: "unidrop-aliss.appspot.com",
  messagingSenderId: "335761175172",
  appId: "1:335761175172:web:e2f84cb26da01f76c508d1",
  measurementId: "G-HX656CVC1S"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics - client-side only
export const initAnalytics = async () => {
  if (typeof window !== "undefined") {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) return getAnalytics(app);
  }
  return null;
};
