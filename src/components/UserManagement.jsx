import React, { useState } from 'react';
import { db } from '../utils/firebase'; 
import { collection, doc, updateDoc, serverTimestamp, addDoc, deleteDoc } from 'firebase/firestore';

const UserManagement = ({ adminUsers, profUsers, adminProfile }) => {
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('All Roles');
    
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
  
    const [formData, setFormData] = useState({ name: '', email: '', role: 'professor' });

    // --- CRUD LOGIC ---
    const handleAddUser = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const targetCollection = formData.role === 'admin' ? 'admins' : 'professors';
            await addDoc(collection(db, targetCollection), {
                name: formData.name,
                email: formData.email,
                role: formData.role, 
                createdAt: serverTimestamp()
            });
            setIsAddUserModalOpen(false);
            setFormData({ name: '', email: '', role: 'professor' }); 
        } catch (error) {
            alert("Failed to add user. Check permissions.");
        } finally { setIsSubmitting(false); }
    };
  
    const handleDeleteUser = async (userId, userRole, userName) => {
        if (window.confirm(`Are you sure you want to completely remove ${userName} from the system?`)) {
            try {
                const targetCollection = userRole === 'admin' ? 'admins' : 'professors';
                await deleteDoc(doc(db, targetCollection, userId));
            } catch (error) {
                alert("Failed to delete user.");
            }
        }
    };
  
    const openEditModal = (user) => {
        setEditingUser(user);
        setFormData({ name: user.name || user[" name"] || '', email: user.email || '', role: user.role });
        setIsEditUserModalOpen(true);
    };
  
    const handleEditUser = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingUser.role !== formData.role) {
                const oldCol = editingUser.role === 'admin' ? 'admins' : 'professors';
                await deleteDoc(doc(db, oldCol, editingUser.id));
                
                const newCol = formData.role === 'admin' ? 'admins' : 'professors';
                await addDoc(collection(db, newCol), {
                    name: formData.name,
                    email: formData.email,
                    role: formData.role,
                    createdAt: serverTimestamp()
                });
            } else {
                const col = formData.role === 'admin' ? 'admins' : 'professors';
                await updateDoc(doc(db, col, editingUser.id), {
                    name: formData.name,
                    email: formData.email
                });
            }
            setIsEditUserModalOpen(false);
            setEditingUser(null);
            setFormData({ name: '', email: '', role: 'professor' });
        } catch (error) {
            alert("Failed to update user.");
        } finally { setIsSubmitting(false); }
    };

    // --- FILTER LOGIC ---
    const allLiveUsers = [...adminUsers, ...profUsers];
    const filteredUsers = allLiveUsers.filter(user => {
      const userName = user.name || user[" name"] || "Unknown";
      const matchesSearch = userName.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                            user.email.toLowerCase().includes(userSearchQuery.toLowerCase());
      const matchesRole = roleFilter === 'All Roles' || user.role.toLowerCase() === roleFilter.toLowerCase();
      return matchesSearch && matchesRole;
    });

    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-300">
            
            {/* ADD USER MODAL */}
            {isAddUserModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">Add New User</h2>
                            <button onClick={() => { setIsAddUserModalOpen(false); setFormData({ name: '', email: '', role: 'professor' }); }} className="text-gray-400 hover:text-gray-800 text-3xl leading-none">&times;</button>
                        </div>
                        
                        <form onSubmit={handleAddUser} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Full Name</label>
                                <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g. Dr. John Doe" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Email Address</label>
                                <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="john.doe@neu.edu" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Role Assignment</label>
                                <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer">
                                    <option value="professor">Professor (Lab Access Only)</option>
                                    <option value="admin">Administrator (Full Access)</option>
                                </select>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => { setIsAddUserModalOpen(false); setFormData({ name: '', email: '', role: 'professor' }); }} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md transition disabled:opacity-50">
                                    {isSubmitting ? "Creating..." : "Create User"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT USER MODAL */}
            {isEditUserModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">Edit User</h2>
                            <button onClick={() => { setIsEditUserModalOpen(false); setEditingUser(null); }} className="text-gray-400 hover:text-gray-800 text-3xl leading-none">&times;</button>
                        </div>
                        
                        <form onSubmit={handleEditUser} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Full Name</label>
                                <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Email Address</label>
                                <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Role Assignment</label>
                                <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer">
                                    <option value="professor">Professor (Lab Access Only)</option>
                                    <option value="admin">Administrator (Full Access)</option>
                                </select>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => { setIsEditUserModalOpen(false); setEditingUser(null); }} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-md transition disabled:opacity-50">
                                    {isSubmitting ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <header className="mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
                <p className="text-sm text-gray-500 mt-1">Manage admin access and authorized faculty members.</p>
              </div>
              <button 
                onClick={() => setIsAddUserModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md flex items-center gap-2 transition-all"
              >
                  + Add New User
              </button>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between gap-4 items-center bg-gray-50/50">
                    <div className="relative w-full sm:w-72">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
                        <input 
                            type="text" 
                            placeholder="Search users..." 
                            value={userSearchQuery}
                            onChange={(e) => setUserSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <span className="text-sm font-semibold text-gray-500">Filter by Role:</span>
                        <select 
                            value={roleFilter} 
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="bg-white border border-gray-200 text-sm rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-gray-700 cursor-pointer"
                        >
                            <option value="All Roles">All Roles</option>
                            <option value="admin">Admins</option>
                            <option value="professor">Professors</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50/50 text-xs uppercase text-gray-500 font-bold border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4">Avatar</th>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.map(user => {
                                const userName = user.name || user[" name"] || "Unknown";
                                return (
                                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                                            {userName.charAt(0).toUpperCase()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-900">{userName}</td>
                                    <td className="px-6 py-4">{user.email}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                            user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-3">
                                        <button onClick={() => openEditModal(user)} className="text-gray-400 hover:text-blue-600 transition" title="Edit User">
                                            ✏️
                                        </button>
                                        {user.email !== adminProfile?.email && (
                                            <button onClick={() => handleDeleteUser(user.id, user.role, userName)} className="text-gray-400 hover:text-red-600 transition" title="Delete User">
                                                🗑️
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )})}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                        No users found. Try adjusting your search or filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                <div className="p-4 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500 bg-gray-50/50">
                    <span>Showing {filteredUsers.length} total users in database</span>
                </div>
            </div>
        </div>
    );
};

export default UserManagement;