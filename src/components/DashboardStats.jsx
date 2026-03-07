import React, { useState, useMemo } from 'react';
import { updateIssue } from '../utils/firebase';
// ADDED RECHARTS IMPORTS
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ADDED allSessions TO PROPS
const DashboardStats = ({ activeRooms, avgUsage, issues = [], activeSessions = [], allSessions = [], onIssueResolved }) => {
  // --- STATE FOR MODALS ---
  const [activeModal, setActiveModal] = useState(null); // 'rooms', 'reports', 'usage', or null
  const [selectedIssue, setSelectedIssue] = useState(null); // Track selected issue for detailed view
  const [isResolving, setIsResolving] = useState(false); // Track if resolving an issue
  
  // Debug: Log the issue structure
  console.log("DashboardStats received issues:", issues);

  // Handle marking issue as resolved
  const handleMarkResolved = async () => {
    if (!selectedIssue || !selectedIssue.id) return;
    
    setIsResolving(true);
    try {
      await updateIssue(selectedIssue.id, {
        status: 'resolved',
        resolvedAt: new Date().toISOString()
      });
      console.log("Issue marked as resolved:", selectedIssue.id);
      
      // Close the modal and refetch issues
      setSelectedIssue(null);
      if (onIssueResolved) {
        onIssueResolved();
      }
    } catch (error) {
      console.error("Error resolving issue:", error);
      alert("Failed to resolve issue. Please try again.");
    } finally {
      setIsResolving(false);
    }
  };

  // Helper function to format Firestore timestamps
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Not available';
    
    // Handle Firestore Timestamp object
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleString();
    }
    
    // Handle regular Date object
    if (timestamp instanceof Date) {
      return timestamp.toLocaleString();
    }
    
    // Handle string
    if (typeof timestamp === 'string') {
      return new Date(timestamp).toLocaleString();
    }
    
    return 'Not available';
  };
  
  // --- GRAPH DATA PROCESSING ---
  // Calculates total usage hours per day for the last 7 days
  const graphData = useMemo(() => {
    if (!allSessions || allSessions.length === 0) return [];

    const last7Days = {};
    for(let i=6; i>=0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      last7Days[dateStr] = 0; 
    }

    allSessions.forEach(session => {
      if(session.timeIn && session.timeOut) {
          const start = session.timeIn?.toDate ? session.timeIn.toDate() : new Date(session.timeIn);
          const end = session.timeOut?.toDate ? session.timeOut.toDate() : new Date(session.timeOut);
          
          const dateStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          if(last7Days[dateStr] !== undefined) {
             const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
             last7Days[dateStr] += hours;
          }
      }
    });

    return Object.keys(last7Days).map(date => ({
       name: date,
       Hours: Number(last7Days[date].toFixed(1))
    }));
  }, [allSessions]);

  // --- DYNAMIC MATH ---
  const totalRooms = 10; // Based on your LoginScreen rooms array
  const occupancyPercentage = Math.round((activeRooms / totalRooms) * 100) || 0;
  const pendingReportsCount = issues.length;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Active Rooms Card (Clickable) */}
        <div 
          onClick={() => setActiveModal('rooms')}
          className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm relative cursor-pointer hover:shadow-md transition-shadow hover:border-blue-300"
        >
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Active Rooms</h3>
          <p className="text-3xl font-bold text-gray-900 flex items-baseline gap-1">
            {activeRooms}<span className="text-lg font-medium text-gray-400">/{totalRooms}</span>
          </p>
          <div className="absolute top-6 right-6 bg-blue-50 text-blue-600 p-2 rounded-lg w-10 h-10 flex items-center justify-center">
             🏢
          </div>
          <p className="text-xs text-blue-600 font-medium mt-4 flex items-center gap-1">
             {occupancyPercentage > 0 ? '↗' : '→'} {occupancyPercentage}% Occupancy
          </p>
        </div>
        
        {/* Avg Daily Usage Card (UPDATED TO BE CLICKABLE) */}
        <div 
          onClick={() => setActiveModal('usage')}
          className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm relative cursor-pointer hover:shadow-md transition-shadow hover:border-indigo-300"
        >
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Avg Daily Usage</h3>
          <p className="text-3xl font-bold text-gray-900 flex items-baseline gap-1">
            {avgUsage} <span className="text-lg font-medium text-gray-400">Hours</span>
          </p>
          <div className="absolute top-6 right-6 bg-indigo-50 text-indigo-500 p-2 rounded-lg w-10 h-10 flex items-center justify-center">
             📈
          </div>
          <p className="text-xs text-indigo-500 font-medium mt-4 flex items-center gap-1">
             Click to view analytics
          </p>
        </div>

        {/* Pending Reports Card (Clickable) */}
        <div 
          onClick={() => setActiveModal('reports')}
          className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm relative cursor-pointer hover:shadow-md transition-shadow hover:border-orange-300"
        >
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Pending Reports</h3>
          <p className="text-3xl font-bold text-gray-900">{pendingReportsCount}</p>
          <div className="absolute top-6 right-6 bg-orange-50 text-orange-500 p-2 rounded-lg w-10 h-10 flex items-center justify-center">
             📋
          </div>
          <p className={`text-xs font-medium mt-4 flex items-center gap-1 ${pendingReportsCount > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
             {pendingReportsCount > 0 ? '! Action Required' : '✓ All clear'}
          </p>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* NEW: Analytics / Usage Graph Modal */}
      {activeModal === 'usage' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-8 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Usage Analytics</h2>
                <p className="text-sm text-gray-500 mt-1">Total lab utilization hours over the last 7 days.</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-800 text-3xl font-bold">&times;</button>
            </div>
            
            <div className="flex-1 min-h-[400px] w-full mt-4">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={graphData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dx={-10} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '5 5' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }}/>
                  <Line 
                    type="monotone" 
                    dataKey="Hours" 
                    name="Total Usage Hours"
                    stroke="#6366f1" 
                    strokeWidth={4} 
                    dot={{ r: 6, strokeWidth: 2, fill: '#fff' }} 
                    activeDot={{ r: 8, stroke: '#6366f1', strokeWidth: 2, fill: '#fff' }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
      
      {/* 1. Reports Modal */}
      {activeModal === 'reports' && !selectedIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Pending Issues</h2>
              <button onClick={() => setActiveModal(null)} className="text-gray-500 hover:text-gray-800 text-xl font-bold">&times;</button>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-2">
              {issues.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No pending reports right now. Great job!</p>
              ) : (
                <div className="space-y-4">
                  {issues.map((report, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedIssue(report)}
                      className="p-4 border border-orange-200 bg-orange-50 rounded-xl cursor-pointer hover:bg-orange-100 hover:border-orange-300 transition-all hover:shadow-md"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-orange-800">{report.room || 'General'}</span>
                        <span className="text-xs text-orange-600 font-bold bg-orange-200 px-2 py-1 rounded uppercase">Pending</span>
                      </div>
                      <p className="text-gray-700">{report.description || report.issue || "No details provided."}</p>
                      <p className="text-xs text-gray-500 mt-2">Click to view details →</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1b. Issue Details Modal */}
      {selectedIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Issue Details</h2>
              <button onClick={() => setSelectedIssue(null)} className="text-gray-500 hover:text-gray-800 text-xl font-bold">&times;</button>
            </div>
            
            <div className="space-y-6">
              {/* Room */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Location</h3>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-lg font-bold text-orange-900">{selectedIssue.room || 'General'}</p>
                </div>
              </div>

              {/* Issue Type */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Issue Type</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-lg font-bold text-blue-900 capitalize">{selectedIssue.type || 'General'}</p>
                </div>
              </div>

              {/* Issue Description */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Issue Description</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-800 leading-relaxed">{selectedIssue.description || selectedIssue.issue}</p>
                </div>
              </div>

              {/* Reported By */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Reported By</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-800">{selectedIssue.user || 'Anonymous'}</p>
                </div>
              </div>

              {/* Status */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</h3>
                <div className="flex gap-2">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                    selectedIssue.status === 'open' || selectedIssue.status === 'pending'
                      ? 'bg-orange-200 text-orange-600'
                      : selectedIssue.status === 'resolved'
                      ? 'bg-green-200 text-green-600'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {selectedIssue.status || 'Pending'}
                  </span>
                </div>
              </div>

              {/* Timestamp if available */}
              {(selectedIssue.reportedAt || selectedIssue.timestamp) && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Reported At</h3>
                  <p className="text-gray-700">
                    {formatTimestamp(selectedIssue.reportedAt || selectedIssue.timestamp)}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button 
                  onClick={() => setSelectedIssue(null)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button 
                  onClick={handleMarkResolved}
                  disabled={isResolving}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 rounded-lg transition-colors"
                >
                  {isResolving ? 'Resolving...' : 'Mark as Resolved'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Active Rooms Modal */}
      {activeModal === 'rooms' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Currently Active Rooms</h2>
              <button onClick={() => setActiveModal(null)} className="text-gray-500 hover:text-gray-800 text-xl font-bold">&times;</button>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-2">
              {activeSessions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">All rooms are currently available.</p>
              ) : (
                <div className="space-y-4">
                  {activeSessions.map((session, idx) => (
                    <div key={idx} className="p-4 border border-blue-200 bg-blue-50 rounded-xl flex justify-between items-center">
                      <div>
                        <p className="font-bold text-blue-900 text-lg">{session.room}</p>
                        <p className="text-sm text-blue-700">Occupied by: <span className="font-semibold">{session.userName || session.user || session.profName}</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-blue-500 uppercase font-bold tracking-wider">Time In</p>
                        <p className="font-mono text-blue-800">{session.timeIn ? new Date(session.timeIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardStats;