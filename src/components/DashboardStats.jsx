import React, { useState, useMemo } from 'react';
import { updateIssue } from '../utils/firebase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const DashboardStats = ({ activeRooms, avgUsage, issues = [], activeSessions = [], allSessions = [], onIssueResolved, onPreviewSession, onForceEndSession }) => {
  const [activeModal, setActiveModal] = useState(null); 
  const [selectedIssue, setSelectedIssue] = useState(null); 
  const [isResolving, setIsResolving] = useState(false); 

  const roomsList = ["M101", "M102", "M103", "M104", "M105", "M106", "M107", "M108", "M109", "M110"];

  const handleMarkResolved = async () => {
    if (!selectedIssue || !selectedIssue.id) return;
    setIsResolving(true);
    try {
      await updateIssue(selectedIssue.id, {
        status: 'resolved',
        resolvedAt: new Date().toISOString()
      });
      setSelectedIssue(null);
      if (onIssueResolved) onIssueResolved();
    } catch (error) {
      alert("Failed to resolve issue. Please try again.");
    } finally {
      setIsResolving(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Not available';
    if (timestamp.toDate && typeof timestamp.toDate === 'function') return timestamp.toDate().toLocaleString();
    if (timestamp instanceof Date) return timestamp.toLocaleString();
    if (typeof timestamp === 'string') return new Date(timestamp).toLocaleString();
    return 'Not available';
  };
  
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

  const totalRooms = roomsList.length; 
  const occupancyPercentage = Math.round((activeRooms / totalRooms) * 100) || 0;
  const pendingReportsCount = issues.length;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div onClick={() => setActiveModal('rooms')} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm relative cursor-pointer hover:shadow-md transition-shadow hover:border-blue-300">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Active Rooms</h3>
          <p className="text-3xl font-bold text-gray-900 flex items-baseline gap-1">
            {activeRooms}<span className="text-lg font-medium text-gray-400">/{totalRooms}</span>
          </p>
          <div className="absolute top-6 right-6 bg-blue-50 text-blue-600 p-2 rounded-lg w-10 h-10 flex items-center justify-center">🏢</div>
          <p className="text-xs text-blue-600 font-medium mt-4 flex items-center gap-1">
             {occupancyPercentage > 0 ? '↗' : '→'} {occupancyPercentage}% Occupancy
          </p>
        </div>
        
        <div onClick={() => setActiveModal('usage')} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm relative cursor-pointer hover:shadow-md transition-shadow hover:border-indigo-300">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Avg Daily Usage</h3>
          <p className="text-3xl font-bold text-gray-900 flex items-baseline gap-1">
            {avgUsage} <span className="text-lg font-medium text-gray-400">Hours</span>
          </p>
          <div className="absolute top-6 right-6 bg-indigo-50 text-indigo-500 p-2 rounded-lg w-10 h-10 flex items-center justify-center">📈</div>
          <p className="text-xs text-indigo-500 font-medium mt-4 flex items-center gap-1">Click to view analytics</p>
        </div>

        <div onClick={() => setActiveModal('reports')} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm relative cursor-pointer hover:shadow-md transition-shadow hover:border-orange-300">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Pending Reports</h3>
          <p className="text-3xl font-bold text-gray-900">{pendingReportsCount}</p>
          <div className="absolute top-6 right-6 bg-orange-50 text-orange-500 p-2 rounded-lg w-10 h-10 flex items-center justify-center">📋</div>
          <p className={`text-xs font-medium mt-4 flex items-center gap-1 ${pendingReportsCount > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
             {pendingReportsCount > 0 ? '! Action Required' : '✓ All clear'}
          </p>
        </div>
      </div>

      {/* Usage Graph Modal */}
      {activeModal === 'usage' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '5 5' }} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }}/>
                  <Line type="monotone" dataKey="Hours" name="Total Usage Hours" stroke="#6366f1" strokeWidth={4} dot={{ r: 6, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 8, stroke: '#6366f1', strokeWidth: 2, fill: '#fff' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
      
      {/* Reports List Modal */}
      {activeModal === 'reports' && !selectedIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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
                    <div key={idx} onClick={() => setSelectedIssue(report)} className="p-4 border border-orange-200 bg-orange-50 rounded-xl cursor-pointer hover:bg-orange-100 hover:border-orange-300 transition-all hover:shadow-md">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-orange-800">{report.room || report.location || 'General'}</span>
                        <span className="text-xs text-orange-600 font-bold bg-orange-200 px-2 py-1 rounded uppercase">Pending</span>
                      </div>
                      {/* Robust check for the description text */}
                      <p className="text-gray-700">
                        {report.description || report.issue || report.details || report.message || report.reportText || "No details provided."}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">Click to view details →</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Issue Details Modal */}
      {selectedIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Issue Details</h2>
              <button onClick={() => setSelectedIssue(null)} className="text-gray-500 hover:text-gray-800 text-xl font-bold">&times;</button>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Location</h3>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-lg font-bold text-orange-900">{selectedIssue.room || selectedIssue.location || 'General'}</p>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Issue Type</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  {/* Robust check for the type text */}
                  <p className="text-lg font-bold text-blue-900 capitalize">
                    {selectedIssue.type || selectedIssue.issueType || selectedIssue.category || 'General'}
                  </p>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Issue Description</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 min-h-[80px]">
                  {/* Robust check for the description text */}
                  <p className="text-gray-800 leading-relaxed">
                    {selectedIssue.description || selectedIssue.issue || selectedIssue.details || selectedIssue.message || selectedIssue.reportText || "No description provided."}
                  </p>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Reported By</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-800">{selectedIssue.user || selectedIssue.userName || selectedIssue.reportedBy || 'Anonymous'}</p>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</h3>
                <div className="flex gap-2">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${selectedIssue.status === 'open' || selectedIssue.status === 'pending' ? 'bg-orange-200 text-orange-600' : selectedIssue.status === 'resolved' ? 'bg-green-200 text-green-600' : 'bg-gray-200 text-gray-600'}`}>
                    {selectedIssue.status || 'Pending'}
                  </span>
                </div>
              </div>
              {(selectedIssue.reportedAt || selectedIssue.timestamp || selectedIssue.createdAt) && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Reported At</h3>
                  <p className="text-gray-700">{formatTimestamp(selectedIssue.reportedAt || selectedIssue.timestamp || selectedIssue.createdAt)}</p>
                </div>
              )}
              <div className="flex gap-3 pt-4 border-t">
                <button onClick={() => setSelectedIssue(null)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 rounded-lg transition-colors">Back</button>
                <button onClick={handleMarkResolved} disabled={isResolving} className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 rounded-lg transition-colors">{isResolving ? 'Resolving...' : 'Mark as Resolved'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ALL ROOMS Modal */}
      {activeModal === 'rooms' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b pb-4">
              <div>
                  <h2 className="text-2xl font-bold text-gray-900">Laboratory Rooms Status</h2>
                  <p className="text-sm text-gray-500 mt-1">Manage all physical lab environments</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-gray-500 hover:text-gray-800 text-3xl leading-none">&times;</button>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-2 mt-2">
                <div className="space-y-3">
                  {roomsList.map(room => {
                    const session = activeSessions.find(s => s.room === room);
                    const isOccupied = !!session;

                    return (
                        <div key={room} className={`p-4 border rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 transition-shadow ${isOccupied ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                            
                            <div>
                                <p className={`font-bold text-lg ${isOccupied ? 'text-blue-900' : 'text-gray-700'}`}>{room}</p>
                                {isOccupied ? (
                                    <p className="text-sm text-blue-700">Occupied by: <span className="font-semibold">{session.userName || session.user || session.profName}</span></p>
                                ) : (
                                    <p className="text-sm text-green-600 font-semibold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Available</p>
                                )}
                            </div>
                            
                            {isOccupied && (
                                <div className="flex items-center gap-3 self-end sm:self-auto">
                                    <div className="hidden sm:block text-right mr-2 border-r border-blue-200 pr-4">
                                        <p className="text-xs text-blue-500 uppercase font-bold tracking-wider">Time In</p>
                                        <p className="font-mono text-blue-800">
                                            {session.timeIn ? new Date(session.timeIn?.toDate ? session.timeIn.toDate() : session.timeIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}
                                        </p>
                                    </div>
                                    
                                    {onPreviewSession && (
                                        <button 
                                            onClick={() => { setActiveModal(null); onPreviewSession(session); }}
                                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg shadow-sm transition-colors flex items-center gap-1"
                                        >
                                            <span>👁️</span> View
                                        </button>
                                    )}

                                    {onForceEndSession && (
                                        <button 
                                            onClick={() => onForceEndSession(session.id, session.userName || session.user)}
                                            className="text-xs bg-red-100 hover:bg-red-200 text-red-700 font-bold py-2 px-3 rounded-lg shadow-sm transition-colors flex items-center gap-1"
                                        >
                                            <span>🛑</span> End
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                  })}
                </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardStats;