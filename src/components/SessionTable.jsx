import React from 'react';

const SessionTable = ({ sessions }) => {
  // Helper function to format Firestore timestamps
  const formatTime = (timestamp) => {
    if (!timestamp) return '-- : --';
    
    // Handle Firestore Timestamp object
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Handle regular Date object
    if (timestamp instanceof Date) {
      return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Handle string
    if (typeof timestamp === 'string') {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    return '-- : --';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-white text-gray-500 font-semibold border-b border-gray-200">
            <tr>
              <th className="py-4 px-6 uppercase text-xs tracking-wider">Name</th>
              <th className="py-4 px-6 uppercase text-xs tracking-wider">Room</th>
              <th className="py-4 px-6 uppercase text-xs tracking-wider">Time In</th>
              <th className="py-4 px-6 uppercase text-xs tracking-wider">Time Out</th>
              <th className="py-4 px-6 uppercase text-xs tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sessions.map((session) => {
              const isActive = !session.timeOut; 

              return (
                <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      {/* Avatar placeholder */}
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                        {(session.userName || session.user || 'U').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{session.userName || session.user}</p>
                        <p className="text-xs text-gray-500">{session.login_method || 'Login'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-gray-600 font-medium">
                    <span className="bg-gray-100 text-gray-600 py-1 px-2 rounded text-xs">Lab {session.room}</span>
                  </td>
                  <td className="py-4 px-6 text-gray-600">{formatTime(session.timeIn)}</td>
                  <td className="py-4 px-6 text-gray-400">
                    {isActive ? '-- : --' : formatTime(session.timeOut)}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center gap-1 py-1 px-3 rounded-full text-xs font-semibold
                      ${isActive 
                        ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                        : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>}
                      {isActive ? 'Active' : 'Completed'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SessionTable;