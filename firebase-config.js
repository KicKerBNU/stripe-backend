const admin = require('firebase-admin');

// Your Firebase configuration (same as in saudepilates project)
const firebaseConfig = {
  apiKey: "AIzaSyB6xfteJelZLxiszYwiprugoSRSnZn4YGM",
  authDomain: "saudepilates-170df.firebaseapp.com",
  projectId: "saudepilates-170df",
  storageBucket: "saudepilates-170df.appspot.com",
  messagingSenderId: "311012649134",
  appId: "1:311012649134:web:698eec2274ff1c0583e53f",
  measurementId: "G-B0KTCDJHD8"
};

// Initialize Firebase Admin SDK with a try-catch to handle missing credentials
let db = null;
try {
  // Check if we have valid Firebase credentials
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  
  // Only initialize Firebase if we have valid credentials
  if (privateKey && privateKey !== "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n" &&
      clientEmail && clientEmail !== "your-service-account@project-id.iam.gserviceaccount.com") {
    
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: firebaseConfig.projectId,
        clientEmail: clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n')
      }),
      databaseURL: `https://${firebaseConfig.projectId}.firebaseio.com`
    });
    
    db = admin.firestore();
  } else {
    console.warn('Missing or invalid Firebase credentials - Firebase features will be disabled');
  }
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
}

module.exports = { db, admin }; 