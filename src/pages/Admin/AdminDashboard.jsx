import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth'; 
import { db } from '../../utils/firebase'; 
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

// Import our separated components
import SessionTable from '../../components/SessionTable'; 
import DashboardStats from '../../components/DashboardStats';
import RoomQRCodes from '../../components/RoomQRCodes'; 
import UserManagement from '../../components/UserManagement';

const calculateAverageUsage = (sessions) => {
  const completedSessions = sessions.filter(session => session.timeOut && session.timeIn);
  if (completedSessions.length === 0) return "0.0";

  const totalMilliseconds = completedSessions.reduce((total, session) => {
    const start = session.timeIn?.toDate ? session.timeIn.toDate().getTime() : new Date(session.timeIn).getTime();
    const end = session.timeOut?.toDate ? session.timeOut.toDate().getTime() : new Date(session.timeOut).getTime();
    if (isNaN(start) || isNaN(end)) return total; 
    return total + (end - start);
  }, 0);

  const totalHours = totalMilliseconds / (1000 * 60 * 60);
  return (totalHours / completedSessions.length).toFixed(1);
};

// --- GIANT TICKING CLOCK MODAL ---
const LiveSessionPreviewModal = ({ session, onClose, onForceEnd }) => {
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        const startTime = session.timeIn?.toDate ? session.timeIn.toDate().getTime() : new Date(session.timeIn).getTime();
        const interval = setInterval(() => {
            setSeconds(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [session]);

    const formatTime = (totalSeconds) => {
        const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
                <div className="bg-gray-900 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                        <h2 className="text-white font-bold tracking-wide">Admin Live Monitor</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
                </div>

                <div className="p-10 text-center flex-1 bg-gray-50">
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">
                       Active: {session.userName || session.user || "Student"}
                    </h3>
                    <p className="text-gray-500 mb-8 text-sm">Login Method: <span className="font-mono font-semibold">{session.login_method || 'Unknown'}</span></p>

                    <div className="bg-white p-10 rounded-3xl shadow-lg border border-gray-100 w-full relative mx-auto">
                        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-semibold border border-blue-100 flex items-center gap-2">
                            <span>🖥️</span> {session.room} 
                        </div>

                        <div className="mt-12 mb-8">
                            <p className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-4">Current Duration</p>
                            <div className="text-7xl font-bold text-gray-900 tabular-nums tracking-tight leading-none font-mono">
                                {formatTime(seconds)}
                            </div>
                        </div>

                        <div className="pt-8 border-t border-gray-50 flex justify-center">
                            <button 
                                onClick={() => onForceEnd(session.id, session.userName || session.user)} 
                                className="py-3 px-8 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                            >
                                ⚠️ Force End Session
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [sessions, setSessions] = useState([]);
  const [issues, setIssues] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminProfile, setAdminProfile] = useState(null);
  
  const [previewSession, setPreviewSession] = useState(null);

  // States for users passed to UserManagement component
  const [adminUsers, setAdminUsers] = useState([]);
  const [profUsers, setProfUsers] = useState([]);

  const rooms = ["M101", "M102", "M103", "M104", "M105", "M106", "M107", "M108", "M109", "M110"];

  useEffect(() => {
    const auth = getAuth();
    let unsubSessions = null;
    let unsubIssues = null;
    let unsubAdmins = null;
    let unsubProfs = null;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        try {
          const adminsRef = collection(db, 'admins');
          const q = query(adminsRef, where('email', '==', user.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const adminData = querySnapshot.docs[0].data();
            if (adminData.role === 'admin') {
              setIsAuthorized(true);
              setAdminProfile({ name: adminData.name || user.displayName || "Admin", email: user.email });
              
              unsubSessions = onSnapshot(collection(db, 'sessions'), (snapshot) => {
                const sessionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                sessionsData.sort((a, b) => (b.timeIn?.toMillis ? b.timeIn.toMillis() : 0) - (a.timeIn?.toMillis ? a.timeIn.toMillis() : 0));
                setSessions(sessionsData);
              });

              unsubIssues = onSnapshot(query(collection(db, 'reports'), where("status", "==", "pending")), (snapshot) => {
                setIssues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
              });

              unsubAdmins = onSnapshot(collection(db, 'admins'), (snapshot) => {
                setAdminUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), role: 'admin' })));
              });

              unsubProfs = onSnapshot(collection(db, 'professors'), (snapshot) => {
                setProfUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), role: 'professor' })));
              });

            } else { setIsAuthorized(false); }
          } else { setIsAuthorized(false); }
        } catch (error) { setIsAuthorized(false); }
      } else { setIsAuthorized(false); }
      setLoading(false); 
    });

    return () => {
        unsubscribeAuth();
        if (unsubSessions) unsubSessions();
        if (unsubIssues) unsubIssues();
        if (unsubAdmins) unsubAdmins();
        if (unsubProfs) unsubProfs();
    };
  }, []);

  const handleLogout = async () => {
      await signOut(getAuth());
      navigate('/');
  };

  const handleForceEndSession = async (sessionId, userName) => {
      const confirm = window.confirm(`Are you sure you want to forcibly log out ${userName || 'this user'}?`);
      if (confirm) {
          try {
              await updateDoc(doc(db, "sessions", sessionId), {
                  timeOut: serverTimestamp(),
                  status: "completed"
              });
              if (previewSession && previewSession.id === sessionId) setPreviewSession(null); 
          } catch (error) { alert("Failed to end session remotely."); }
      }
  };

  const handleExportCSV = () => {
      if (sessions.length === 0) {
          alert("No session data to export.");
          return;
      }
      const headers = ["Name", "Email/ID", "Room", "Login Method", "Time In", "Time Out", "Status"];
      const csvRows = sessions.map(s => {
          const timeIn = s.timeIn ? (s.timeIn?.toDate ? s.timeIn.toDate().toLocaleString() : new Date(s.timeIn).toLocaleString()) : "N/A";
          const timeOut = s.timeOut ? (s.timeOut?.toDate ? s.timeOut.toDate().toLocaleString() : new Date(s.timeOut).toLocaleString()) : "Active";
          return [`"${s.userName || s.user || 'Unknown'}"`, `"${s.user || ''}"`, `"${s.room}"`, `"${s.login_method || 'Manual'}"`, `"${timeIn}"`, `"${timeOut}"`, `"${s.status}"`].join(",");
      });
      const csvString = [headers.join(","), ...csvRows].join("\n");
      const blob = new Blob([csvString], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', `NEU_Lab_Logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-xl text-blue-600 font-semibold animate-pulse">Loading Admin Portal...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200 text-center max-w-md w-full">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You must be registered as an admin to view this portal.</p>
          <button onClick={handleLogout} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">Return Home</button>
        </div>
      </div>
    );
  }

  const currentActiveSessions = sessions.filter(s => s.status === "active" || s.timeOut === null);
  const activeRoomsCount = new Set(currentActiveSessions.map(s => s.room)).size;
  const avgUsageHours = calculateAverageUsage(sessions);

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-900">
      
      {previewSession && (
          <LiveSessionPreviewModal 
              session={previewSession} 
              onClose={() => setPreviewSession(null)}
              onForceEnd={handleForceEndSession}
          />
      )}

      {/* LEFT SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-10 shadow-sm">
         <div className="p-6 border-b border-gray-100 flex items-center gap-3">
             <div className="bg-blue-600 text-white p-2 rounded-lg"><span className="font-bold text-lg">NEU</span></div>
             <div>
                <h2 className="font-bold text-md leading-tight">Admin Portal</h2>
                <p className="text-xs text-gray-500">Laboratory Log</p>
             </div>
         </div>

         <nav className="flex-1 p-4 space-y-2 mt-4">
             <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
                 📊 Dashboard
             </button>
             <button onClick={() => setActiveTab('qrcodes')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${activeTab === 'qrcodes' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
                 🔲 Room QR Codes
             </button>
             <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${activeTab === 'users' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
                 👥 User Management
             </button>
         </nav>

         <div className="p-4 border-t border-gray-100 mt-auto">
             <div className="flex items-center gap-3 mb-4 px-2">
                 <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">
                     {adminProfile?.name?.charAt(0) || 'A'}
                 </div>
                 <div className="overflow-hidden">
                     <p className="text-sm font-bold text-gray-800 truncate">{adminProfile?.name}</p>
                     <p className="text-xs text-gray-500 truncate">{adminProfile?.email}</p>
                 </div>
             </div>
             <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-600 font-bold hover:bg-red-50 rounded-lg transition-colors">
                 ↪ Log Out
             </button>
         </div>
      </aside>

      <main className="flex-1 ml-64 p-8">
        
        {/* --- VIEW 1: DASHBOARD OVERVIEW --- */}
        {activeTab === 'dashboard' && (
            <div className="max-w-7xl mx-auto animate-in fade-in duration-300">
                <header className="mb-8 flex justify-between items-end">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">Admin Overview</h1>
                    <p className="text-sm text-gray-500 mt-1">Real-time laboratory usage statistics and access logs.</p>
                  </div>
                  <button onClick={handleExportCSV} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md flex items-center gap-2 transition-all">
                      📥 Export CSV
                  </button>
                </header>
                
                <section className="mb-8">
                  <DashboardStats 
                    activeRooms={activeRoomsCount} 
                    avgUsage={avgUsageHours}
                    issues={issues} 
                    activeSessions={currentActiveSessions}
                    allSessions={sessions}
                    onPreviewSession={(session) => setPreviewSession(session)} 
                    onForceEndSession={handleForceEndSession}
                  />
                </section>

                <section>
                  <SessionTable sessions={sessions} />
                </section>
            </div>
        )}

        {/* --- VIEW 2: QR CODES TAB --- */}
        {activeTab === 'qrcodes' && (
            <RoomQRCodes 
                rooms={rooms} 
                currentActiveSessions={currentActiveSessions} 
                allSessions={sessions}
            />
        )}

        {/* --- VIEW 3: USERS TAB --- */}
        {activeTab === 'users' && (
             <UserManagement 
                adminUsers={adminUsers} 
                profUsers={profUsers} 
                adminProfile={adminProfile} 
             />
        )}

      </main>
    </div>
  );
};

export default AdminDashboard;