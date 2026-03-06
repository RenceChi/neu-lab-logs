import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs,       // <--- NEW: Import getDocs
  query,         // <--- NEW: Import query
  where,         // <--- NEW: Import where for filtering
  orderBy        // <--- NEW: Import orderBy
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
    // Reference the collection
    const sessionsRef = collection(db, "sessions");
    
    // Create a query to sort by timeIn (descending: newest first)
    const q = query(sessionsRef, orderBy("timeIn", "desc"));
    
    // Execute the fetch
    const querySnapshot = await getDocs(q);
    
    // Map the data into a clean array
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
    const issuesRef = collection(db, "issues");
    // Query all issues ordered by date, then filter in JavaScript
    const q = query(issuesRef, orderBy("reportedAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    // Filter to only open issues
    return querySnapshot.docs
      .filter(doc => doc.data().status === 'open')
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
  } catch (error) {
    console.error("Error fetching issues:", error);
    return []; // Return empty array on error so app doesn't crash
  }
};

// Get all issues including resolved ones (for history/archive)
export const getAllIssuesIncludingResolved = async () => {
  try {
    const issuesRef = collection(db, "issues");
    const q = query(issuesRef, orderBy("reportedAt", "desc"));
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
      timeIn: serverTimestamp(), // Uses server time for accuracy
      timeOut: null              // Null means "Active"
    });
    console.log("Session started with ID: ", docRef.id);
    return docRef.id; // Return the ID so we can save it locally
  } catch (error) {
    console.error("Error starting session:", error);
    throw error;
  }
};

// Update an issue (used for resolving issues)
export const updateIssue = async (docId, updates) => {
  try {
    const issueRef = doc(db, "issues", docId);
    await updateDoc(issueRef, updates);
    console.log("Issue updated:", docId);
  } catch (error) {
    console.error("Error updating issue:", error);
    throw error;
  }
};
