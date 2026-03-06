import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; 
import { getAllSessions, getAllIssues, db } from '../../utils/firebase'; 
import { collection, query, where, getDocs } from 'firebase/firestore';
import SessionTable from '../../components/SessionTable'; 
import DashboardStats from '../../components/DashboardStats';

// Helper function to calculate average usage
const calculateAverageUsage = (sessions) => {
  const completedSessions = sessions.filter(session => session.timeOut && session.timeIn);
  
  if (completedSessions.length === 0) return 0;

  const totalMilliseconds = completedSessions.reduce((total, session) => {
    // Note: This assumes timeIn and timeOut are stored as valid Date strings in Firebase
    const start = new Date(session.timeIn).getTime();
    const end = new Date(session.timeOut).getTime();
    
    // Safety check in case the dates can't be parsed
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

  // Function to refetch issues when one is resolved
  const refetchIssues = async () => {
    try {
      const issuesData = await getAllIssues();
      setIssues(issuesData);
      console.log("AdminDashboard: Issues refetched successfully");
    } catch (error) {
      console.error("AdminDashboard: Error refetching issues:", error);
    }
  };

  useEffect(() => {
    const auth = getAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("AdminDashboard: onAuthStateChanged triggered, user:", user?.email || "NO USER");
      // Check if user exists and has an email
      if (user && user.email) {
        try {
          console.log("AdminDashboard: Checking auth for email:", user.email);
          // 1. Query the 'admins' collection for this user's email
          const adminsRef = collection(db, 'admins');
          const q = query(adminsRef, where('email', '==', user.email));
          const querySnapshot = await getDocs(q);
          console.log("AdminDashboard: Query result:", querySnapshot.size, "documents found");
          
          // 2. If the query isn't empty, the email exists in the admins collection
          if (!querySnapshot.empty) {
            const adminData = querySnapshot.docs[0].data();
            console.log("AdminDashboard: Admin data found:", adminData);
            
            // 3. Verify the role field matches 'admin'
            const hasAdminRole = adminData.role === 'admin';
            console.log("AdminDashboard: Role field value:", adminData.role, "| Has admin role?", hasAdminRole);

            if (hasAdminRole) {
              console.log("AdminDashboard: Authorization successful!");
              setIsAuthorized(true);
              
              // Fetch the dashboard data
              const [sessionsData, issuesData] = await Promise.all([
                getAllSessions(),
                getAllIssues()
              ]);
              setSessions(sessionsData);
              setIssues(issuesData);
            } else {
              // Found in collection, but doesn't have the 'admin' role
              console.log("AdminDashboard: User found but role is:", adminData.role);
              setIsAuthorized(false);
            }
          } else {
            // Email not found in the admins collection
            console.log("AdminDashboard: Email not found in admins collection");
            setIsAuthorized(false);
          }
        } catch (error) {
          console.error("Error verifying admin status or loading data:", error);
          setIsAuthorized(false);
        }
      } else {
        // No user logged in
        console.log("AdminDashboard: No authenticated user");
        setIsAuthorized(false);
      }
      
      console.log("AdminDashboard: Setting loading to false");
      setLoading(false); 
    });

    return () => unsubscribe();
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

  // Calculate stats for the dashboard cards
  const activeRoomsCount = sessions.filter(session => !session.timeOut).length;
  const pendingReportsCount = issues.length; 
  const avgUsageHours = calculateAverageUsage(sessions); 

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
            onIssueResolved={refetchIssues}
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