import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../utils/firebase"; 

const AdminRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // --- DB CHECK LOGIC START ---
        try {
            // Check if this user exists in the 'admins' collection
            const q = query(collection(db, "admins"), where("email", "==", currentUser.email));
            const snap = await getDocs(q);

            if (!snap.empty) {
                // User IS an admin
                setUser(currentUser);
            } else {
                // User is logged in to Google, but NOT in admins table
                console.warn("User attempted admin access but is not in 'admins' collection:", currentUser.email);
                setUser(null); 
            }
        } catch (error) {
            console.error("Error verifying admin status:", error);
            setUser(null);
        }
        // --- DB CHECK LOGIC END ---
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500 font-bold">Verifying Access...</div>;

  // If no user (or user was rejected by DB check), redirect to Home
  if (!user) return <Navigate to="/" replace />; 

  // If we get here, user is valid and confirmed in DB
  return children;
};

export default AdminRoute;