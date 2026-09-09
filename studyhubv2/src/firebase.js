import { initializeApp } from "firebase/app";
import { 
  getDatabase, 
  ref, 
  onValue, 
  set, 
  runTransaction 
} from "firebase/database";
import liveData from './live_repositories.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

export const SEED_DATA = liveData;

// Seed database if empty
export const seedDatabaseIfEmpty = async () => {
  const dataRef = ref(db, 'portal_tree_data');
  onValue(dataRef, (snapshot) => {
    if (!snapshot.exists()) {
      set(dataRef, SEED_DATA);
    }
  }, { onlyOnce: true });
};

// Increment visitor count in Firebase Realtime Database
export const incrementVisitorCount = async () => {
  const countRef = ref(db, 'visitor_count');
  try {
    await runTransaction(countRef, (currentCount) => {
      if (currentCount === null || currentCount === undefined) {
        return 1380; // Baseline
      }
      return currentCount + 1;
    });
  } catch (err) {
    console.error("Visitor count error:", err);
  }
};
