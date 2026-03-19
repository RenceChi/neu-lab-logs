import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "../utils/firebase"; 

const ActiveSession = ({ room, user, sessionId, onLogout }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportType, setReportType] = useState([]);
  const [reportText, setReportText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displayName, setDisplayName] = useState(user);

  // Lookup student name if user prop looks like an ID
  useEffect(() => {
    const lookupName = async () => {
      // Check if user looks like a student ID (contains numbers and dashes like 23-13565-543)
      if (user && /\d+-\d+-\d+/.test(user)) {
        try {
          const q = query(collection(db, "students"), where("studentId", "==", user));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const studentData = snap.docs[0].data();
            const name = studentData.name || user;
            setDisplayName(name);
          }
        } catch (err) {
          console.error("Error looking up student name:", err);
        }
      }
    };
    lookupName();
  }, [user]);

  // Timer Logic
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // LOGOUT LOGIC (Updates Database)
  const handleEndSession = async () => {
    const confirmLogout = window.confirm("Are you sure you want to end this session?");
    if (!confirmLogout) return;

    try {
        if (sessionId) {
            const sessionRef = doc(db, "sessions", sessionId);
            await updateDoc(sessionRef, {
                timeOut: serverTimestamp(),
                status: "completed"
            });
        } else {
            console.warn("No Session ID found. Logging out without DB update.");
        }
        onLogout(); 
    } catch (error) {
        console.error("Error signing out:", error);
        alert("Failed to clock out. Please try again.");
    }
  };

  // Report Issue Logic
  const toggleIssue = (issue) => {
    setReportType(prev => 
      prev.includes(issue) ? prev.filter(i => i !== issue) : [...prev, issue]
    );
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
        // --- THIS IS THE FIX ---
        // Format the array into a comma-separated string, or default to "General"
        const finalIssueType = reportType.length > 0 ? reportType.join(", ") : "General";

        await addDoc(collection(db, "reports"), {
            room: room,
            user: displayName, // Saves the looked-up full name instead of just ID
            type: finalIssueType, // Admin dashboard looks for 'type'
            description: reportText, // Admin dashboard looks for 'description'
            timestamp: serverTimestamp(),
            status: "pending"
        });
        
        alert("Report submitted successfully.");
        setIsReportOpen(false);
        setReportType([]);
        setReportText("");
    } catch (error) {
        alert("Error submitting report.");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6 font-sans">
      {/* Main Dashboard Card */}
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-xl overflow-hidden min-h-[600px] flex flex-col relative">
        
        {/* Top Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-white">
            <div className="flex items-center gap-3">
                <div className="bg-blue-600 text-white p-2 rounded-lg font-bold">N</div>
                <div>
                    <h1 className="font-bold text-gray-900 leading-none">NEU Lab Log</h1>
                    <p className="text-xs text-gray-400">Laboratory Management System</p>
                </div>
            </div>
            <div className="bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border border-green-100">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                System Online
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-gray-50/50 p-8 flex flex-col items-center justify-center text-center">
            
            <h2 className="text-3xl text-gray-700 font-medium mb-2">Welcome back, <span className="font-bold text-gray-900">{displayName}</span></h2>
            <p className="text-gray-400 mb-10">Your session is currently being recorded.</p>

            {/* Timer Card */}
            <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 w-full max-w-2xl relative">
                <div className="flex justify-between items-center mb-8 border-b border-gray-50 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">🖥️</div>
                        <div className="text-left">
                            <h3 className="font-bold text-gray-900">{room}</h3>
                            <p className="text-xs text-gray-400">Computer Science Laboratory</p>
                        </div>
                    </div>
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full border border-green-200">● SESSION ACTIVE</span>
                </div>

                <div className="mb-8">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Elapsed Time</p>
                    <div className="text-7xl font-mono font-bold text-gray-900 tracking-tighter">
                        {formatTime(elapsedSeconds)}
                    </div>
                    <p className="text-sm text-gray-400 mt-4">🕒 Started at {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>

                <div className="flex gap-4">
                    <button 
                        onClick={() => setIsReportOpen(true)}
                        className="flex-1 py-4 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition flex items-center justify-center gap-2"
                    >
                        ⚠️ Report Issue
                    </button>
                    <button 
                        onClick={handleEndSession}
                        className="flex-1 py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition flex items-center justify-center gap-2"
                    >
                        🚪 End Session / Check Out
                    </button>
                </div>
            </div>

            <p className="mt-8 text-xs text-blue-400 font-medium cursor-pointer hover:underline">Need immediate assistance? Call IT Support at ext. 4040</p>
        </div>
      </div>

      {/* REPORT ISSUE MODAL */}
      {isReportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">🚨 Report an Issue</h2>
                        <p className="text-xs text-gray-500">Room: {room} • User: {displayName}</p>
                    </div>
                    <button onClick={() => setIsReportOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>
                
                <form onSubmit={handleReportSubmit} className="p-6">
                    <p className="text-sm font-bold text-gray-700 mb-3">What seems to be the problem?</p>
                    
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        {["Faulty PC", "No Internet", "Broken AC", "Projector Issue"].map((issue) => (
                            <div 
                                key={issue}
                                onClick={() => toggleIssue(issue)}
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                    reportType.includes(issue) 
                                    ? "border-blue-500 bg-blue-50 text-blue-700" 
                                    : "border-gray-100 hover:border-gray-300 text-gray-600"
                                }`}
                            >
                                <div className={`w-5 h-5 rounded border mb-2 flex items-center justify-center ${reportType.includes(issue) ? "bg-blue-500 border-blue-500" : "border-gray-300 bg-white"}`}>
                                    {reportType.includes(issue) && <span className="text-white text-xs">✓</span>}
                                </div>
                                <span className="font-bold text-sm block">{issue}</span>
                            </div>
                        ))}
                    </div>

                    <label className="block text-sm font-bold text-gray-700 mb-2">Additional Details (Optional)</label>
                    <textarea 
                        value={reportText}
                        onChange={(e) => setReportText(e.target.value)}
                        placeholder="Please describe the issue briefly..."
                        className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:border-blue-500 focus:outline-none mb-6 h-24 resize-none bg-gray-50"
                    />
                    
                    <div className="flex gap-3 pt-2 border-t border-gray-100">
                        <button type="button" onClick={() => setIsReportOpen(false)} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg">
                            {isSubmitting ? "Sending..." : "Submit Report ➤"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
};

export default ActiveSession;