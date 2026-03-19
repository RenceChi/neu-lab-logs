import React, { useState } from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../utils/firebase";
import { useNavigate } from "react-router-dom"; 

const GoogleAuth = () => {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleGoogleLogin = async () => {
    setIsAuthenticating(true);
    setError("");
    const provider = new GoogleAuthProvider();
    
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;

      // 1. Check if user is an Admin
      const adminQ = query(collection(db, "admins"), where("email", "==", email));
      const adminSnap = await getDocs(adminQ);

      if (!adminSnap.empty) {
          const adminData = adminSnap.docs[0].data();
          if (adminData.role === 'admin') {
              navigate("/admin");
              return;
          }
      }

      // 2. Check if user is a valid Professor
      const profQ = query(collection(db, "professors"), where("email", "==", email));
      const profSnap = await getDocs(profQ);
      
      if (profSnap.empty) {
          // Sign them out of Firebase Auth if they aren't authorized in your DB
          await auth.signOut();
          setError("Access Denied: Email not registered as a Professor or Admin.");
          setIsAuthenticating(false);
          return;
      }
      
      const profData = profSnap.docs[0].data();
      const displayName = profData.name || profData[" name"] || profData.fullName || result.user.displayName;

      // 3. Success! Route them to the Clock-In screen, passing their data
      navigate("/clock-in", { state: { email, displayName } });

    } catch (error) { 
        console.error("Auth Error:", error);
        setError("Sign-in was cancelled or failed."); 
        setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col items-center justify-center p-4 font-sans text-gray-900">
      
      <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md text-center border border-gray-100">
        
        {/* Updated Custom Academic Logo */}
        <div className="flex justify-center mb-6 text-blue-600">
           <svg className="w-14 h-14" fill="currentColor" viewBox="0 0 24 24">
             <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
           </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">NEU Lab Log</h1>
        <p className="text-gray-500 text-sm mb-8">Please sign in to access the system</p>

        {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {error}
            </div>
        )}

        <button 
          onClick={handleGoogleLogin} 
          disabled={isAuthenticating}
          className="w-full py-3.5 px-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center justify-center gap-3 disabled:opacity-70"
        >
          {isAuthenticating ? "Authenticating..." : (
            <>
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5 bg-white rounded-full p-0.5" alt="G" /> 
              Sign in with Google
            </>
          )}
        </button>

        <div className="mt-8 p-4 bg-gray-50 rounded-xl flex items-start gap-3 text-left">
           <span className="text-gray-400 mt-0.5">ⓘ</span>
           <p className="text-xs text-gray-500 leading-relaxed">
             This is a restricted access system. All activities are logged and monitored according to university policy.
           </p>
        </div>

      </div>

      <footer className="mt-12 text-center text-xs text-gray-400">
         <p className="mb-2">© 2026 NEU Laboratory. All rights reserved.</p>
         <div className="flex justify-center gap-4 text-blue-500 font-medium">
            <span className="cursor-pointer hover:underline">IT Support</span>
            <span className="text-gray-300">|</span>
            <span className="cursor-pointer hover:underline">Privacy Policy</span>
            <span className="text-gray-300">|</span>
            <span className="cursor-pointer hover:underline">Terms of Use</span>
         </div>
      </footer>

    </div>
  );
};

export default GoogleAuth;