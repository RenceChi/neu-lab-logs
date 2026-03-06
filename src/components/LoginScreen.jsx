import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { collection, query, where, getDocs, serverTimestamp, addDoc } from "firebase/firestore";
import { auth, db } from "../utils/firebase";
import { useNavigate } from "react-router-dom"; 

const LoginScreen = ({ onSessionStart }) => {
  const navigate = useNavigate(); 

  // --- STATE ---
  const [selectedRoom, setSelectedRoom] = useState("");
  const [roomStatuses, setRoomStatuses] = useState({}); 
  const [error, setError] = useState("");
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  
  // Login & UI State
  const [isManualLoginOpen, setIsManualLoginOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false); 
  const [manualId, setManualId] = useState("");
  const [reportText, setReportText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stats State
  const [usersToday, setUsersToday] = useState(0);
  const [labStatus, setLabStatus] = useState("CLOSED");

  // Updated to M-series rooms
  const rooms = ["M101", "M102", "M103", "M104", "M105", "M106", "M107", "M108", "M109", "M110"];

  // --- 1. STATISTICS & STATUS ---
  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0); 
      try {
        const q = query(collection(db, "sessions"), where("timeIn", ">=", today));
        const snapshot = await getDocs(q);
        setUsersToday(snapshot.size);
      } catch (err) { console.error(err); }

      const currentHour = new Date().getHours();
      setLabStatus(currentHour >= 8 && currentHour < 17 ? "OPEN" : "CLOSED");
    };
    fetchStats();
    const interval = setInterval(fetchStats, 300000); 
    return () => clearInterval(interval);
  }, []);

  // --- 2. ROOM AVAILABILITY CHECK ---
  useEffect(() => {
    const checkAvailability = async () => {
      const statusMap = {};
      for (const room of rooms) {
        const q = query(collection(db, "sessions"), where("room", "==", room), where("timeOut", "==", null));
        const snapshot = await getDocs(q);
        statusMap[room] = !snapshot.empty ? "Occupied" : "Available";
      }
      setRoomStatuses(statusMap);
    };
    checkAvailability();
  }, []); 

  // --- 3. CAMERA SETUP & LOGIC ---
  useEffect(() => {
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length) setCameras(devices);
    }).catch(err => console.error(err));
  }, []);

  const handleScanRef = useRef(null);

  useEffect(() => {
    handleScanRef.current = async (decodedText, scannerInstance) => {
      // 1. Pause scanner immediately to prevent duplicate scans
      scannerInstance.pause();
      setError("");

      try {
        const trimmedText = decodedText.trim();
        const isEmail = trimmedText.includes('@');
        
        // 2. CHECK ADMINS FIRST (No room required)
        const adminQ = query(collection(db, "admins"), where("email", "==", trimmedText));
        const adminSnap = await getDocs(adminQ);

        if (!adminSnap.empty) {
            const adminData = adminSnap.docs[0].data();
            if (adminData.role === 'admin') {
                navigate("/admin");
                return; // Stop execution, successfully routed to dashboard
            }
        }

        // 3. ENFORCE ROOM RULE FOR PROFESSORS
        if (!selectedRoom) {
            setError("⚠️ Please select a room first before scanning.");
            scannerInstance.resume();
            return; 
        }
        if (roomStatuses[selectedRoom] === "Occupied") {
            setError(`⛔ Access Denied: ${selectedRoom} is currently occupied.`);
            scannerInstance.resume();
            return; 
        }

        // 4. CHECK PROFESSORS COLLECTION
        const profQ = query(
            collection(db, "professors"), // Updated to 'professors'
            where(isEmail ? "email" : "profId", "==", trimmedText) // Updated to 'profId'
        );
        const profSnap = await getDocs(profQ);
        
        if (!profSnap.empty) {
            const profData = profSnap.docs[0].data();
            const name = profData.name || profData[" name"] || trimmedText;
            handleLogin("QR", trimmedText, name);
        } else {
            // Not found in Admin or Professor database
            scannerInstance.resume();
            setError("❌ Professor ID/Email not found in database.");
        }
      } catch (err) {
          scannerInstance.resume();
          setError("Database error.");
          console.error(err);
      }
    };
  }); 

  // The Camera Lifecycle
  useEffect(() => {
    if (cameras.length === 0) return;

    const html5QrCode = new Html5Qrcode("reader");
    let isStarting = false;

    const startScanner = async () => {
        isStarting = true;
        try {
            await html5QrCode.start(
                cameras[currentCameraIndex].id,
                { fps: 10, qrbox: { width: 250, height: 250 }},
                (decodedText) => {
                    if (handleScanRef.current) {
                        handleScanRef.current(decodedText, html5QrCode);
                    }
                },
                (errorMessage) => { /* ignore background scan warnings */ }
            );
        } catch (err) {
            if (err && err.name !== 'AbortError') {
                console.warn("Scanner start error:", err);
            }
        } finally {
            isStarting = false;
        }
    };

    startScanner();

    return () => {
        if (html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
                if (document.getElementById("reader")) {
                    try { html5QrCode.clear(); } catch (e) {}
                }
            }).catch(e => {});
        } else if (!isStarting) {
            if (document.getElementById("reader")) {
                try { html5QrCode.clear(); } catch (e) {}
            }
        }
    };
  }, [cameras, currentCameraIndex]); 

  // --- 4. LOGIN LOGIC ---
  const handleLogin = async (method, identifier, displayName) => {
    if (!selectedRoom) { 
      setError("⚠️ Please select a room first."); 
      return; 
    }

    if (roomStatuses[selectedRoom] === "Occupied") {
        setError(`⛔ Access Denied: ${selectedRoom} is currently occupied.`);
        return; 
    }
    
    setIsSubmitting(true);
    setError("");

    try {
      const docRef = await addDoc(collection(db, "sessions"), { 
        room: selectedRoom,
        user: identifier,     
        userName: displayName,  
        login_method: method,
        timeIn: serverTimestamp(), 
        status: "active",
        timeOut: null 
      });
      onSessionStart(selectedRoom, displayName, docRef.id); 
    } catch (e) {
      setError("Login failed. Please try again.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const submitManualLogin = async (e) => {
      e.preventDefault();
      if(!manualId.trim()) return;
      setIsSubmitting(true);
      try {
        // Query the 'professors' collection using 'profId'
        const q = query(collection(db, "professors"), where("profId", "==", manualId.trim()));
        const snap = await getDocs(q);
        if (snap.empty) {
            setError("❌ Professor ID not found.");
            setIsSubmitting(false);
            return;
        }
        const profData = snap.docs[0].data();
        const name = profData.name || profData[" name"] || profData.fullName || profData.profName || manualId;
        
        handleLogin("Manual ID", manualId, name);

      } catch (err) { setError("Database error."); setIsSubmitting(false); }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;

      const adminQ = query(collection(db, "admins"), where("email", "==", email));
      const adminSnap = await getDocs(adminQ);

      if (!adminSnap.empty) {
          const adminData = adminSnap.docs[0].data();
          if (adminData.role === 'admin') {
              navigate("/admin");
              return;
          }
      }

      if (!selectedRoom) { setError("⚠️ SELECT A ROOM FIRST"); return; }

      // Query the 'professors' collection for Google Login
      const profQ = query(collection(db, "professors"), where("email", "==", email));
      const profSnap = await getDocs(profQ);
      
      if (profSnap.empty) {
          setError("❌ Email not registered as a Professor or Admin.");
          return;
      }
      
      const profData = profSnap.docs[0].data();
      const name = profData.name || profData[" name"] || profData.fullName || result.user.displayName;

      handleLogin("Google", email, name); 

    } catch (error) { 
        console.error(error);
        setError("Login Cancelled or Failed"); 
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
        await addDoc(collection(db, "reports"), {
            room: selectedRoom || "General",
            issue: reportText,
            timestamp: serverTimestamp(),
            status: "pending"
        });
        alert("Issue reported.");
        setIsReportOpen(false);
        setReportText("");
    } catch (error) { alert("Error sending report."); } finally { setIsSubmitting(false); }
  };


  // --- RENDER ---
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      
      {/* NAVBAR */}
      <nav className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
             <span className="font-bold text-lg">NEU</span>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Laboratory Log</h1>
            <p className="text-xs text-gray-500">SYSTEM V2.5</p>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col items-center p-6 gap-6">
        
        {/* ROOM SELECTOR */}
        <div className={`w-full max-w-4xl p-6 rounded-2xl border-2 transition-all duration-300 shadow-sm ${selectedRoom ? 'bg-white border-blue-500 ring-4 ring-blue-50' : 'bg-white border-red-300 animate-pulse'}`}>
            <label className="block text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">
                STEP 1: Select Your Workstation
            </label>
            <div className="relative">
                <select 
                    value={selectedRoom} 
                    onChange={(e) => { setSelectedRoom(e.target.value); setError(""); }}
                    className="w-full p-4 text-xl font-bold bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
                >
                    <option value="">-- Click here to select a room --</option>
                    {rooms.map(room => (
                        <option key={room} value={room}>
                            {room} {roomStatuses[room] === "Occupied" ? "🔴 (Occupied)" : "🟢 (Available)"}
                        </option>
                    ))}
                </select>
                <div className="absolute right-5 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">▼</div>
            </div>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
            <div className="w-full max-w-4xl bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative animate-bounce">
                <strong className="font-bold">Error: </strong> {error}
            </div>
        )}

        {/* GRID CONTENT */}
        <div className={`w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 transition-opacity duration-500 opacity-100`}>
          
          {/* LEFT: SCANNER */}
          <div className={`bg-white rounded-3xl shadow-lg border border-gray-100 p-6 flex flex-col relative overflow-hidden`}>
             <div className="flex justify-between items-start mb-4">
               <h2 className="text-lg font-bold flex items-center gap-2"><span className="text-blue-600">⛶</span> Scan ID</h2>
               <span className={`text-xs font-bold px-2 py-1 rounded-full ${cameras.length > 0 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                  {cameras.length > 0 ? "Camera Ready" : "Searching..."}
               </span>
             </div>
             <div className="flex-1 bg-black rounded-2xl relative overflow-hidden min-h-[350px] flex items-center justify-center">
                {/* ROOM OCCUPIED OVERLAY ONLY */}
                {selectedRoom && roomStatuses[selectedRoom] === "Occupied" && (
                    <div className="absolute z-20 bg-white/90 p-4 rounded-xl shadow-lg text-center backdrop-blur-sm">
                        <p className="text-red-600 font-bold text-xl mb-1">⛔ ROOM OCCUPIED</p>
                        <p className="text-gray-600 text-sm font-medium">Please select a different workstation.</p>
                    </div>
                )}
                <div id="reader" className="w-full overflow-hidden rounded-2xl"></div>
             </div>
             <div className="mt-4">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Active Camera Source</label>
                <select value={currentCameraIndex} onChange={(e) => setCurrentCameraIndex(Number(e.target.value))} className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5">
                    {cameras.map((camera, index) => <option key={camera.id} value={index}>{camera.label || `Camera ${index + 1}`}</option>)}
                </select>
             </div>
          </div>

          {/* RIGHT: LOGIN OPTIONS */}
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 flex-1 flex flex-col justify-center">
               <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Login Options</h2>
               <div className="space-y-4">
                 <button onClick={handleGoogleLogin} disabled={isSubmitting} className="w-full py-4 px-4 bg-white border-2 border-gray-200 text-gray-700 font-bold text-lg rounded-xl hover:bg-gray-50 transition flex items-center justify-center gap-3">
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="G" /> Sign in with Google
                 </button>
                 <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-gray-200"></div><span className="mx-4 text-gray-400 text-xs font-bold">OR</span><div className="flex-grow border-t border-gray-200"></div>
                 </div>
                 <button onClick={() => setIsManualLoginOpen(true)} className={`w-full py-4 px-4 bg-blue-600 text-white font-bold text-lg rounded-xl hover:bg-blue-700 transition shadow-lg`}>Manual NEU ID Login</button>
               </div>
               <p onClick={() => setIsReportOpen(true)} className="text-center text-xs text-gray-400 mt-6 cursor-pointer hover:text-blue-500 underline">Having trouble? Report an issue</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                    <h3 className="text-3xl font-bold text-blue-600">{usersToday}</h3>
                    <p className="text-xs text-gray-500 font-bold uppercase mt-1">Users Today</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                    <h3 className={`text-3xl font-bold ${labStatus === "OPEN" ? "text-green-500" : "text-red-500"}`}>{labStatus === "OPEN" ? "08:00" : "CLOSED"}</h3>
                    <p className="text-xs text-gray-500 font-bold uppercase mt-1">Lab Opens</p>
                </div>
            </div>
          </div>
        </div>
      </main>

      {/* MODALS */}
      {isManualLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-200">
                <h2 className="text-2xl font-bold mb-2">Manual Login</h2>
                <p className="text-gray-500 mb-6">Enter your Professor NEU ID Number.</p>
                <form onSubmit={submitManualLogin}>
                    <input type="text" autoFocus value={manualId} onChange={(e) => setManualId(e.target.value)} placeholder="e.g. 25-12345-678" className="w-full p-4 border-2 border-gray-300 rounded-xl text-xl font-mono focus:border-blue-500 focus:outline-none mb-6"/>
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setIsManualLoginOpen(false)} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg">{isSubmitting ? "..." : "Clock In ➤"}</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {isReportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
                <h2 className="text-2xl font-bold mb-2">Report Issue</h2>
                <p className="text-gray-500 mb-6">Describe the problem.</p>
                <form onSubmit={handleReportSubmit}>
                    <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Scanner not working..." className="w-full p-4 border-2 border-gray-300 rounded-xl mb-6 h-32 resize-none" required/>
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setIsReportOpen(false)} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg">Submit</button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
};

export default LoginScreen;