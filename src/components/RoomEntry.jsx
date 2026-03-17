import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { collection, query, where, getDocs, serverTimestamp, addDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../utils/firebase";
import { useNavigate, useLocation } from "react-router-dom"; 

const RoomEntry = ({ onSessionStart }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the authenticated user's data passed from GoogleAuth
  const authUser = location.state || { email: "Unknown", displayName: "Authorized User" };

  const [selectedRoom, setSelectedRoom] = useState("");
  const [manualId, setManualId] = useState("");
  const [roomStatuses, setRoomStatuses] = useState({}); 
  const [error, setError] = useState("");
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stats State
  const [usersToday, setUsersToday] = useState(0);
  const [labStatus, setLabStatus] = useState("CLOSED");

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

  // --- 3. CAMERA LOGIC & BUG FIX ---
  useEffect(() => {
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length) setCameras(devices);
    }).catch(err => console.error(err));
  }, []);

  const handleScanRef = useRef(null);

  useEffect(() => {
    handleScanRef.current = async (decodedText, scannerInstance) => {
      scannerInstance.pause();
      setError("");
      
      const scannedValue = decodedText.trim();
      
      if (rooms.includes(scannedValue)) {
         setSelectedRoom(scannedValue);
         handleClockIn(scannedValue, authUser.email, authUser.displayName, "QR Scan");
      } else {
         setError("❌ Invalid Room QR Code scanned.");
         setTimeout(() => scannerInstance.resume(), 2000);
      }
    };
  }); 

  useEffect(() => {
    if (cameras.length === 0) return;
    
    // 1. Aggressively wipe the container before doing anything
    const readerElement = document.getElementById("reader");
    if (readerElement) readerElement.innerHTML = "";

    const html5QrCode = new Html5Qrcode("reader");

    // 2. Add a tiny delay to outrun React 18's Strict Mode double-mount
    const startTimer = setTimeout(() => {
        html5QrCode.start(
            cameras[currentCameraIndex].id,
            { 
              fps: 10, 
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.333334 
            },
            (decodedText) => {
                if (handleScanRef.current) handleScanRef.current(decodedText, html5QrCode);
            },
            () => {} // Ignore continuous scan warnings
        ).catch(err => console.log("Camera start ignored (likely unmounted):", err));
    }, 100); // 100ms delay is the magic number here

    // 3. Bulletproof Cleanup
    return () => {
        clearTimeout(startTimer); // Cancel start if React unmounts it immediately
        
        if (html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
                try { html5QrCode.clear(); } catch(e) {}
                if (readerElement) readerElement.innerHTML = ""; // Wipe DOM on exit
            }).catch(e => {});
        } else {
            try { html5QrCode.clear(); } catch(e) {}
            if (readerElement) readerElement.innerHTML = ""; // Wipe DOM on exit
        }
    };
  }, [cameras, currentCameraIndex]);

  // --- 4. CLOCK IN & SIGN OUT LOGIC ---
  const handleClockIn = async (roomToUse, identifier, displayName, method = "Manual") => {
    const room = roomToUse || selectedRoom;
    if (!room) { 
      setError("⚠️ Please select or scan a room first."); 
      return; 
    }
    if (roomStatuses[room] === "Occupied") {
        setError(`⛔ Access Denied: ${room} is currently occupied.`);
        return; 
    }
    
    setIsSubmitting(true);
    setError("");

    try {
      const docRef = await addDoc(collection(db, "sessions"), { 
        room: room,
        user: identifier,     
        userName: displayName,  
        login_method: method,
        timeIn: serverTimestamp(), 
        status: "active",
        timeOut: null 
      });
      onSessionStart(room, displayName, docRef.id); 
    } catch (e) {
      setError("Clock-in failed. Please check your connection.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleManualSubmit = (e) => {
      e.preventDefault();
      const clockInID = manualId.trim() || authUser.email;
      handleClockIn(selectedRoom, clockInID, authUser.displayName, "Form Entry");
  };

  // New Sign Out Function
  const handleSignOut = async () => {
      try {
          await signOut(auth);
          navigate("/"); // Push back to the Google Auth wall
      } catch (error) {
          console.error("Logout Error:", error);
      }
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
          <h1 className="font-bold text-lg hidden sm:block">Lab Log</h1>
        </div>

        {/* Auth User Profile Tag & Sign Out */}
        <div className="flex items-center gap-5">
            <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold">{authUser.displayName}</p>
                    <p className="text-xs text-gray-500">Authorized Session</p>
                </div>
                <div className="w-10 h-10 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold">
                    {authUser.displayName.charAt(0)}
                </div>
            </div>
            {/* The New Sign Out Button */}
            <div className="border-l border-gray-200 pl-5">
                <button 
                    onClick={handleSignOut}
                    className="text-sm font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition"
                >
                    Sign Out
                </button>
            </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        
        <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-900">Lab Clock-In</h2>
            <p className="text-green-600 text-sm font-semibold flex items-center gap-2 mt-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Authenticated Session Active
            </p>
        </div>

        {error && (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-xl font-medium animate-in fade-in">
                {error}
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* LEFT: SCANNER */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col relative">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span className="text-blue-600">⛶</span> Scan Room QR
                    </h3>
                    <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        Camera Active
                    </span>
                </div>
                
                {/* FIX: Removed flex and min-h that were stretching the canvas */}
                <div className="w-full bg-black rounded-2xl overflow-hidden border-4 border-gray-900 relative">
                    <div id="reader" className="w-full"></div>
                </div>

                <div className="flex justify-between items-center mt-4 pt-2">
                    <span className="text-sm text-gray-500">Scanning for workstation ID...</span>
                    <button onClick={() => setCurrentCameraIndex((prev) => (prev + 1) % cameras.length)} className="text-sm font-semibold text-gray-600 hover:text-blue-600 flex items-center gap-2 transition">
                        🔄 Switch Camera
                    </button>
                </div>
            </div>

            {/* RIGHT: SELECTION & STATS */}
            <div className="flex flex-col gap-6">
                
                {/* Manual Entry Card */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 flex-1">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
                        <span className="text-blue-600">🖥️</span> Select Workstation
                    </h3>

                    <form onSubmit={handleManualSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Room & Workstation</label>
                            <select 
                                value={selectedRoom} 
                                onChange={(e) => { setSelectedRoom(e.target.value); setError(""); }}
                                className="w-full p-4 text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none font-medium cursor-pointer"
                            >
                                <option value="">-- Select an available room --</option>
                                {rooms.map(room => (
                                    <option key={room} value={room} disabled={roomStatuses[room] === "Occupied"}>
                                        {room} {roomStatuses[room] === "Occupied" ? "- 🔴 Occupied" : "- 🟢 Available"}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Manual NEU ID Number (Optional)</label>
                            <input 
                                type="text" 
                                value={manualId} 
                                onChange={(e) => setManualId(e.target.value)} 
                                placeholder="Enter ID e.g. 001234567" 
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={isSubmitting || !selectedRoom}
                            className="w-full py-4 bg-blue-600 text-white font-bold text-lg rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? "Processing..." : "→ Clock In"}
                        </button>
                        <p className="text-center text-xs text-gray-400 mt-4">By clocking in, you agree to the lab safety protocols.</p>
                    </form>
                </div>

                {/* Status Stats */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-xl">👥</div>
                        <div>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Users Today</p>
                            <p className="text-2xl font-bold text-gray-900 leading-none">{usersToday}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${labStatus === "OPEN" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                            {labStatus === "OPEN" ? "🟢" : "🔴"}
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Lab Opens</p>
                            <p className="text-2xl font-bold text-gray-900 leading-none">{labStatus === "OPEN" ? "08:00 AM" : "CLOSED"}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
};

export default RoomEntry;