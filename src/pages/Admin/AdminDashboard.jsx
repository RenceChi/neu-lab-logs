import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; 
import { db } from '../../utils/firebase'; 
// ADDED onSnapshot HERE:
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import SessionTable from '../../components/SessionTable'; 
import DashboardStats from '../../components/DashboardStats';

// Helper function to calculate average usage
const calculateAverageUsage = (sessions) => {
  const completedSessions = sessions.filter(session => session.timeOut && session.timeIn);
  
  if (completedSessions.length === 0) return "0.0";

  const totalMilliseconds = completedSessions.reduce((total, session) => {
    // Check if timeIn/timeOut are Firestore timestamps or strings
    const start = session.timeIn?.toDate ? session.timeIn.toDate().getTime() : new Date(session.timeIn).getTime();
    const end = session.timeOut?.toDate ? session.timeOut.toDate().getTime() : new Date(session.timeOut).getTime();
    
    if (isNaN(start) || isNaN(end)) return total; 
    
    return total + (end - start);
  }, 0);

  const totalHours = totalMilliseconds / (1000 * 60 * 60);
  return (totalHours / completedSessions.length).toFixed(1);
};

const AdminDashboard = () => {
  const [sessions, setSessions] = useState([]);
  const [issues, setIssues] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    let unsubSessions = null;
    let unsubIssues = null;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        try {
          // 1. Check if user is an admin
          const adminsRef = collection(db, 'admins');
          const q = query(adminsRef, where('email', '==', user.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const adminData = querySnapshot.docs[0].data();
            const hasAdminRole = adminData.role === 'admin';

            if (hasAdminRole) {
              setIsAuthorized(true);
              
              // --- REAL-TIME LISTENERS INSTEAD OF STATIC FETCHES ---
              
              // 1. Listen to Sessions
              const sessionsRef = collection(db, 'sessions');
              unsubSessions = onSnapshot(sessionsRef, (snapshot) => {
                const sessionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Sort by newest first
                sessionsData.sort((a, b) => {
                    const timeA = a.timeIn?.toMillis ? a.timeIn.toMillis() : 0;
                    const timeB = b.timeIn?.toMillis ? b.timeIn.toMillis() : 0;
                    return timeB - timeA;
                });
                setSessions(sessionsData);
              });

              // 2. Listen to Pending Reports 
              // (Note: Using 'reports' collection based on your LoginScreen code)
              const issuesRef = collection(db, 'reports'); 
              const pendingIssuesQuery = query(issuesRef, where("status", "==", "pending"));
              
              unsubIssues = onSnapshot(pendingIssuesQuery, (snapshot) => {
                const issuesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setIssues(issuesData);
              });

            } else {
              setIsAuthorized(false);
            }
          } else {
            setIsAuthorized(false);
          }
        } catch (error) {
          console.error("Error verifying admin status:", error);
          setIsAuthorized(false);
        }
      } else {
        setIsAuthorized(false);
      }
      
      setLoading(false); 
    });

    // Cleanup function to detach listeners when component unmounts
    return () => {
        unsubscribeAuth();
        if (unsubSessions) unsubSessions();
        if (unsubIssues) unsubIssues();
    };
  }, []);

  // --- UI STATES ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-xl text-gray-500 font-semibold animate-pulse">Loading Admin Data...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center max-w-md w-full">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You must be registered as an admin with the proper role in the system to view the laboratory overview.</p>
        </div>
      </div>
    );
  }

  // Calculate stats for the dashboard cards dynamically
  const currentActiveSessions = sessions.filter(
    session => session.status === "active" || session.timeOut === null
  );
  const activeRoomsCount = new Set(currentActiveSessions.map(s => s.room)).size;
  const pendingReportsCount = issues.length; 
 
  const fakeHistory = [
    {
      timeIn: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), 
      timeOut: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000) 
    },
    {
      timeIn: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), 
      timeOut: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 5.5 * 60 * 60 * 1000) 
    },
    {
      timeIn: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), 
      timeOut: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000) 
    }
  ];
   const avgUsageHours = calculateAverageUsage([...sessions, ...fakeHistory]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Laboratory Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time usage statistics and access logs.</p>
        </header>
        
        <section className="mb-8">
          <DashboardStats 
            activeRooms={activeRoomsCount} 
            avgUsage={avgUsageHours}
            issues={issues} 
            activeSessions={sessions.filter(session => !session.timeOut)}
            allSessions={[...sessions, ...fakeHistory]}
          />
        </section>

        <section>
          <SessionTable sessions={sessions} />
        </section>
      </div>
    </div>
  );
  
};

export default AdminDashboard;