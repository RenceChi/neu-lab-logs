import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// --- Components ---
import GoogleAuth from "./components/GoogleAuth";
import RoomEntry from "./components/RoomEntry";
import ActiveSession from "./components/ActiveSession";

// --- Admin Components ---
import AdminDashboard from "./pages/Admin/AdminDashboard";
import AdminRoute from "./pages/Admin/AdminRoute";

import './App.css'; 

// =========================================
// 1. The "Student Flow" (Clock-in -> Active Session)
// =========================================
function StudentFlow() {
  const [currentSession, setCurrentSession] = useState(null);

  useEffect(() => {
    // Check if the user refreshed the page while in an active session
    const savedSession = localStorage.getItem("activeSession");
    if (savedSession) {
      setCurrentSession(JSON.parse(savedSession));
    }
  }, []);

  const handleSessionStart = (room, user, sessionId) => {
    // 1. Clean the user data 
    const userName = user?.email || user || "Authorized User";

    // 2. Create the session object
    const sessionData = { 
      room, 
      user: userName, 
      sessionId 
    };

    // 3. Update State (Switches UI from RoomEntry to ActiveSession)
    setCurrentSession(sessionData);

    // 4. Update Storage (Keeps user logged in on refresh)
    localStorage.setItem("activeSession", JSON.stringify(sessionData));
  };

  const handleLogout = () => {
    // Clears the session and returns them to the Room Selection screen
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
        <RoomEntry onSessionStart={handleSessionStart} />
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
        {/* Route 1: The Initial Secure Google Auth Wall */}
        <Route path="/" element={<GoogleAuth />} />

        {/* Route 2: The Protected Lab Entry & Active Session Flow */}
        <Route path="/clock-in" element={<StudentFlow />} />

        {/* Route 3: The Protected Admin Dashboard */}
        <Route 
          path="/admin" 
          element={
            <AdminRoute>
              <AdminDashboard /> 
            </AdminRoute>
          } 
        />

        {/* Catch-all: Redirect unknown routes back to the Auth wall */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;