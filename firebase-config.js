// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, push, remove, update, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDAheWdYiiEBUHgbokK7kDPjMEEk7fngYQ",
    authDomain: "abhyaslabkeys.firebaseapp.com",
    databaseURL: "https://abhyaslabkeys-default-rtdb.firebaseio.com",
    projectId: "abhyaslabkeys",
    storageBucket: "abhyaslabkeys.firebasestorage.app",
    messagingSenderId: "782150849318",
    appId: "1:782150849318:web:79710f1e99b32644c567e7",
    measurementId: "G-K4FM6QY4HY"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Exporting the database and methods for use in other files
export { db, ref, set, onValue, push, remove, update, get };
