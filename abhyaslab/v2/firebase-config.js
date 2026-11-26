// Shared Firebase initialization for Abhyas Lab Keys (User & Admin Web)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDFShk6wkLYNFcd7WYSidxIAqcL55te7z8",
  authDomain: "exams-f7881.firebaseapp.com",
  databaseURL: "https://exams-f7881-default-rtdb.firebaseio.com",
  projectId: "exams-f7881",
  storageBucket: "exams-f7881.firebasestorage.app",
  messagingSenderId: "297962721940",
  appId: "1:297962721940:web:a2d351b464ad337e2c9a81",
  measurementId: "G-9WF1R5EHL5"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

// Safely initialize Analytics only in supported browser contexts
export let analytics = null;
isSupported()
  .then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  })
  .catch(() => {
    // Ignore analytics errors (e.g. ad blockers or offline mode)
  });
