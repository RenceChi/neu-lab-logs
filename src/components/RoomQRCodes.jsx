import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

// Notice we added allSessions to the props
const RoomQRCodes = ({ rooms, currentActiveSessions, allSessions = [] }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const downloadQR = (roomName) => {
        const canvas = document.getElementById(`qr-${roomName}`);
        if (!canvas) return;
        const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
        let downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `NEU_Lab_${roomName}_QR.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    };

    const handleBulkDownload = () => {
        if (window.confirm(`Download all ${rooms.length} QR codes?`)) {
            rooms.forEach((room, index) => {
                setTimeout(() => downloadQR(room), index * 300);
            });
        }
    };

    const filteredRooms = rooms.filter(room => 
        room.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getRoomLocation = (room) => {
        if (room.includes('10')) return "Main Wing, 1st Floor";
        if (room.includes('20')) return "Science Block, 2nd Floor";
        if (room.includes('30')) return "IT Center, 3rd Floor";
        return "Campus Ground Floor";
    };

    // --- NEW: Calculate Most Scanned Room dynamically ---
    const getMostScannedData = () => {
        if (!allSessions || allSessions.length === 0) return { room: "None", count: 0 };

        const roomCounts = {};
        allSessions.forEach(session => {
            if (session.room) {
                roomCounts[session.room] = (roomCounts[session.room] || 0) + 1;
            }
        });

        let topRoom = "None";
        let topCount = 0;

        for (const [room, count] of Object.entries(roomCounts)) {
            if (count > topCount) {
                topCount = count;
                topRoom = room;
            }
        }
        return { room: topRoom, count: topCount };
    };

    const mostScanned = getMostScannedData();

    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-300 pb-12">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900">Room QR Codes</h1>
                    <span className="bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded-full text-xs border border-gray-200">
                        {rooms.length} Total Rooms
                    </span>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:w-64">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                        <input 
                            type="text" 
                            placeholder="Search rooms..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white shadow-sm"
                        />
                    </div>
                    <button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-md flex items-center justify-center gap-2 transition-all text-sm">
                        <span>+</span> Add New Room
                    </button>
                </div>
            </div>

            <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">Laboratory Directory</h2>
                <p className="text-sm text-gray-500 mt-1">Manage physical access and digital identities for campus facilities.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
                {filteredRooms.map((room, index) => {
                    const isOccupied = currentActiveSessions.some(s => s.room === room);
                    const bgColors = ['bg-slate-800', 'bg-teal-900', 'bg-stone-800', 'bg-sky-900'];
                    const boxBg = bgColors[index % bgColors.length];

                    return (
                        <div key={room} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col group hover:shadow-md transition-all">
                            <div className={`${boxBg} p-8 flex items-center justify-center aspect-square relative`}>
                                <div className="bg-white p-3 rounded-lg shadow-lg transform group-hover:scale-105 transition-transform duration-300">
                                    <QRCodeCanvas id={`qr-${room}`} value={room} size={110} bgColor={"#ffffff"} fgColor={"#1f2937"} level={"H"} includeMargin={false} />
                                    <p className="text-[10px] text-center font-bold mt-1.5 text-gray-800 tracking-wide">LAB {room}</p>
                                </div>
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="text-lg font-bold text-gray-900">Lab {room}</h3>
                                    <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${isOccupied ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${isOccupied ? 'bg-orange-500' : 'bg-green-500'}`}></span>
                                        {isOccupied ? 'In Use' : 'Available'}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400 font-medium mb-5 flex items-center gap-1">
                                    <span>📍</span> {getRoomLocation(room)}
                                </p>
                                <div className="mt-auto pt-3 border-t border-gray-100 flex divide-x divide-gray-100">
                                    <button onClick={() => downloadQR(room)} className="flex-1 text-gray-600 hover:text-blue-600 font-semibold py-2 text-xs transition-colors flex justify-center items-center gap-1.5">
                                        📥 Download
                                    </button>
                                    <button className="flex-1 text-gray-600 hover:text-blue-600 font-semibold py-2 text-xs transition-colors flex justify-center items-center gap-1.5">
                                        ✏️ Edit Room
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* --- UPDATED: Dynamic Bottom Analytics Banner --- */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-8 w-full md:w-auto">
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Most Scanned</p>
                        <p className="text-blue-600 font-bold text-lg">
                            Lab {mostScanned.room} <span className="text-sm font-medium opacity-80">({mostScanned.count} logs)</span>
                        </p>
                    </div>
                    <div className="hidden sm:block w-px bg-blue-200"></div>
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Active QR Codes</p>
                        <p className="text-blue-600 font-bold text-lg">{rooms.length}<span className="text-sm text-gray-400">/{rooms.length}</span></p>
                    </div>
                </div>

                <button onClick={handleBulkDownload} className="text-blue-600 font-bold text-sm hover:text-blue-800 flex items-center gap-2 transition-colors whitespace-nowrap group">
                    Bulk Download All QR Codes <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                </button>
            </div>

        </div>
    );
};

export default RoomQRCodes;