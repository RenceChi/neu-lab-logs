import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// --- Components ---
import LoginScreen from "./components/LoginScreen";
import ActiveSession from "./components/ActiveSession";

// --- Admin Components ---
import AdminDashboard from "./pages/Admin/AdminDashboard";
import AdminRoute from "./pages/Admin/AdminRoute";

import './App.css'; 

// =========================================
// 1. The "Student View" 
// =========================================
function StudentView() {
  const [currentSession, setCurrentSession] = useState(null);

  useEffect(() => {
    const savedSession = localStorage.getItem("activeSession");
    if (savedSession) {
      setCurrentSession(JSON.parse(savedSession));
    }
  }, []);

  // UPDATED: Now accepts 3 arguments to match your LoginScreen call
  // (room, user, sessionId) comes from: onSessionStart(selectedRoom, identifier, docRef.id)
  const handleSessionStart = (room, user, sessionId) => {
    
    // 1. Safety Check: If 'user' is a complex object (from Google Auth), 
    // just grab the email. If it's a string (Guest), keep it.
    const userName = user?.email || user || "Anonymous";

    // 2. Create a clean session object
    const sessionData = { 
      room, 
      user: userName, 
      sessionId 
    };

    // 3. Update State (Switch UI to ActiveSession)
    setCurrentSession(sessionData);

    // 4. Update Storage (Keep user logged in on refresh)
    localStorage.setItem("activeSession", JSON.stringify(sessionData));
  };

  const handleLogout = () => {
    setCurrentSession(null);
    localStorage.removeItem("activeSession"); 
  };

  return (
    <div className="app-container">
      {currentSession ? (
        <ActiveSession 
          room={currentSession.room} 
          user={currentSession.user} 
          sessionId={currentSession.sessionId}
          onLogout={handleLogout} 
        />
      ) : (
        <LoginScreen onSessionStart={handleSessionStart} />
      )}
    </div>
  );
}

// =========================================
// 2. The Main App (Router Logic)
// =========================================
function App() {
  return (
    <Router>
      <Routes>
        {/* Route 1: The Default Student/User View */}
        <Route path="/" element={<StudentView />} />

        {/* Route 2: The Protected Admin Dashboard */}
        <Route 
          path="/admin" 
          element={
            <AdminRoute>
              <AdminDashboard /> 
            </AdminRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;