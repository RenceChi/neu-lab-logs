import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs,       
  query,         
  where,         
  orderBy,
  serverTimestamp // <-- FIXED: Added missing import here
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export const getAllSessions = async () => {
  try {
    const sessionsRef = collection(db, "sessions");
    const q = query(sessionsRef, orderBy("timeIn", "desc"));
    const querySnapshot = await getDocs(q);
    
    const data = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    return data;
  } catch (error) {
    console.error("Error fetching sessions:", error);
    throw error;
  }
};

export const getAllIssues = async () => {
  try {
    // FIXED: Changed "issues" to "reports"
    const issuesRef = collection(db, "reports"); 
    // FIXED: Changed "reportedAt" to "timestamp"
    const q = query(issuesRef, orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs
      // FIXED: Changed "open" to "pending" to match LoginScreen.jsx
      .filter(doc => doc.data().status === 'pending')
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
  } catch (error) {
    console.error("Error fetching issues:", error);
    return []; 
  }
};

// Get all issues including resolved ones (for history/archive)
export const getAllIssuesIncludingResolved = async () => {
  try {
    // FIXED: Changed "issues" to "reports"
    const issuesRef = collection(db, "reports");
    // FIXED: Changed "reportedAt" to "timestamp"
    const q = query(issuesRef, orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error fetching all issues:", error);
    return [];
  }
};

// Update a session (used for "End Session" / Logout)
export const updateSession = async (docId, updates) => {
  try {
    const sessionRef = doc(db, "sessions", docId);
    await updateDoc(sessionRef, updates);
  } catch (error) {
    console.error("Error updating session:", error);
    throw error;
  }
};

export const startSession = async (roomName, userName) => {
  try {
    const docRef = await addDoc(collection(db, "sessions"), {
      room: roomName,
      user: userName,
      timeIn: serverTimestamp(), 
      timeOut: null              
    });
    console.log("Session started with ID: ", docRef.id);
    return docRef.id; 
  } catch (error) {
    console.error("Error starting session:", error);
    throw error;
  }
};

// Update an issue (used for resolving issues)
export const updateIssue = async (docId, updates) => {
  try {
    // FIXED: Changed "issues" to "reports"
    const issueRef = doc(db, "reports", docId);
    await updateDoc(issueRef, updates);
    console.log("Issue updated:", docId);
  } catch (error) {
    console.error("Error updating issue:", error);
    throw error;
  }
};