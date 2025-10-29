// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDla9CB6I0iVd0MyjZW_g837MMJb9h9VLA",
  authDomain: "rpl-dashboard.firebaseapp.com",
  projectId: "rpl-dashboard",
  storageBucket: "rpl-dashboard.firebasestorage.app",
  messagingSenderId: "712693742227",
  appId: "1:712693742227:web:da0f84ae908e9f75132b66",
  measurementId: "G-DJ5DCLFJMN"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Initial printers list - easily add more here!
const INITIAL_PRINTERS = [
  { id: 'taz4', name: 'TAZ4', order: 1 },
  { id: 'prusa-core1', name: 'Prusa Core1', order: 2 },
  { id: 'prusa-core2', name: 'Prusa Core2', order: 3 },
  { id: 'pruxl', name: 'PruXL', order: 4 },
  { id: 'prusa1', name: 'Prusa 1', order: 5 },
  { id: 'prusa2', name: 'Prusa 2', order: 6 },
  { id: 'prusa3', name: 'Prusa 3', order: 7 },
  { id: 'prusa4', name: 'Prusa 4', order: 8 },
  { id: 'taz5', name: 'TAZ5', order: 9 }
];