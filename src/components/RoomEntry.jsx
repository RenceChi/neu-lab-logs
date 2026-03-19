import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { collection, query, where, getDocs, serverTimestamp, addDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../utils/firebase";
import { useNavigate, useLocation } from "react-router-dom"; 

const RoomEntry = ({ onSessionStart }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const authUser = location.state || { email: "Unknown", displayName: "Authorized User" };

  const [selectedRoom, setSelectedRoom] = useState("");
  const [manualId, setManualId] = useState("");
  const [roomStatuses, setRoomStatuses] = useState({}); 
  const [error, setError] = useState("");
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const rooms = ["M101", "M102", "M103", "M104", "M105", "M106", "M107", "M108", "M109", "M110"];

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
    
    const readerElement = document.getElementById("reader");
    if (readerElement) readerElement.innerHTML = "";

    const html5QrCode = new Html5Qrcode("reader");

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
            () => {} 
        ).catch(err => console.log("Camera start ignored (likely unmounted):", err));
    }, 100); 

    return () => {
        clearTimeout(startTimer); 
        if (html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
                try { html5QrCode.clear(); } catch(e) {}
                if (readerElement) readerElement.innerHTML = ""; 
            }).catch(e => {});
        } else {
            try { html5QrCode.clear(); } catch(e) {}
            if (readerElement) readerElement.innerHTML = ""; 
        }
    };
  }, [cameras, currentCameraIndex]);

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
        hasPermit: !!selectedFile, 
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

  const handleSignOut = async () => {
      try {
          await signOut(auth);
          navigate("/"); 
      } catch (error) {
          console.error("Logout Error:", error);
      }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-gray-900">
      
      {/* NAVBAR */}
      <nav className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="text-blue-600">
             <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <h1 className="font-bold text-xl hidden sm:block text-gray-900">NEU Lab Log</h1>
        </div>

        <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-900">{authUser.displayName}</p>
                <p className="text-xs text-gray-500">Authorized Researcher</p>
            </div>
            <div className="w-10 h-10 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold shadow-sm">
                {authUser.displayName.charAt(0)}
            </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
        
        {/* HEADER */}
        <div className="mb-8">
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Lab Clock-In</h2>
            <p className="text-gray-500 text-sm font-medium flex items-center gap-2 mt-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span> Authenticated Session Active
            </p>
        </div>

        {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium animate-in fade-in">
                {error}
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            
            {/* LEFT: SCANNER */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col relative h-full">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <span className="text-blue-600 text-xl">⛶</span> Scan Room QR
                    </h3>
                    <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
                        Camera Active
                    </span>
                </div>
                
                {/* Camera Container */}
                <div className="w-full bg-black rounded-xl overflow-hidden relative border border-gray-100 shadow-inner">
                    <div id="reader" className="w-full h-full object-cover min-h-[300px]"></div>
                </div>

                <div className="flex justify-between items-center mt-6">
                    <span className="text-sm text-gray-400 font-medium">Scanning for workstation ID...</span>
                    <button onClick={() => setCurrentCameraIndex((prev) => (prev + 1) % cameras.length)} className="text-sm font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-2 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                        Switch Camera
                    </button>
                </div>
            </div>

            {/* RIGHT: SELECTION FORM */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-8">
                    <span className="text-blue-600 text-xl">🖥️</span> Select Workstation
                </h3>

                <form onSubmit={handleManualSubmit} className="space-y-6">
                    {/* Room Selection */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Room & Workstation</label>
                        <div className="relative">
                            <select 
                                value={selectedRoom} 
                                onChange={(e) => { setSelectedRoom(e.target.value); setError(""); }}
                                className="w-full p-3.5 text-gray-800 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none font-medium shadow-sm cursor-pointer"
                            >
                                <option value="">-- Select an available room --</option>
                                {rooms.map(room => (
                                    <option key={room} value={room} disabled={roomStatuses[room] === "Occupied"}>
                                        {room} {roomStatuses[room] === "Occupied" ? "- Occupied" : "- Available"}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    </div>

                    {/* PNG UPLOAD AREA */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Upload Safety Permit (Optional)</label>
                        <div className={`relative border border-dashed rounded-xl flex flex-col items-center justify-center p-8 text-center transition-colors ${selectedFile ? 'border-blue-300 bg-blue-50' : 'border-gray-300 bg-[#F8FAFC] hover:bg-gray-100'}`}>
                            
                            <input 
                                type="file" 
                                accept="image/png" 
                                onChange={(e) => {
                                    if(e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]);
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />

                            {!selectedFile ? (
                                <>
                                    <svg className="w-8 h-8 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                    </svg>
                                    <p className="text-sm text-gray-600 font-medium">Drop PNG here or <span className="text-blue-600 font-semibold cursor-pointer">click to browse</span></p>
                                    <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-widest font-bold">Max file size: 5MB</p>
                                </>
                            ) : (
                                <div className="flex flex-col items-center z-10 relative pointer-events-none">
                                    <svg className="w-8 h-8 text-blue-500 mb-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                                    </svg>
                                    <p className="text-sm text-gray-900 font-bold truncate w-48">{selectedFile.name}</p>
                                    <button 
                                        type="button" 
                                        onClick={(e) => { e.preventDefault(); setSelectedFile(null); }} 
                                        className="mt-2 text-xs text-red-500 font-bold hover:text-red-600 pointer-events-auto relative z-20"
                                    >
                                        Remove image
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Manual ID Input */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Manual NEU ID Number</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h3"></path></svg>
                            </span>
                            <input 
                                type="text" 
                                value={manualId} 
                                onChange={(e) => setManualId(e.target.value)} 
                                placeholder="Enter ID e.g. 001234567" 
                                className="w-full pl-12 pr-4 py-3.5 bg-[#F8FAFC] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-sm shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                        <button 
                            type="submit" 
                            disabled={isSubmitting || !selectedRoom}
                            className="w-full py-4 bg-[#1d4ed8] text-white font-bold text-base rounded-xl hover:bg-blue-800 transition-colors shadow-md disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? "Processing..." : (
                                <>
                                    → Clock In
                                </>
                            )}
                        </button>
                        <p className="text-center text-xs text-gray-400 mt-4 font-medium">By clocking in, you agree to the lab safety protocols and usage guidelines.</p>
                    </div>
                </form>
            </div>
        </div>
      </main>
    </div>
  );
};

export default RoomEntry;