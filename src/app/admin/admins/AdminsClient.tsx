'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  Shield, 
  Eye, 
  UserPlus, 
  Search, 
  Key, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle,
  Lock,
  Mail,
  User as UserIcon,
  RefreshCw
} from 'lucide-react';

export interface AdminItem {
  id: string;
  name: string;
  email: string;
  role: string;
  profileImageUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

interface AdminsClientProps {
  initialAdmins: AdminItem[];
  currentAdminId: string;
  currentUserRole: string;
}

export default function AdminsClient({
  initialAdmins,
  currentAdminId,
  currentUserRole,
}: AdminsClientProps) {
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminItem[]>(initialAdmins);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminItem | null>(null);

  // Form states
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<'SUPER_ADMIN' | 'ADMIN' | 'ASSESSOR'>('ADMIN');
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'SUPER_ADMIN' | 'ADMIN' | 'ASSESSOR'>('ADMIN');
  const [editIsActive, setEditIsActive] = useState(true);
  const [resetPasswordVal, setResetPasswordVal] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isSuperAdmin = currentUserRole === 'SUPER_ADMIN';

  // Metrics
  const totalCount = admins.length;
  const superAdminCount = admins.filter(a => a.role === 'SUPER_ADMIN').length;
  const adminCount = admins.filter(a => a.role === 'ADMIN').length;
  const assessorCount = admins.filter(a => a.role === 'ASSESSOR').length;

  // Filtered List
  const filteredAdmins = admins.filter(a => {
    const matchesSearch = 
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || a.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Open Create Modal
  const handleOpenCreate = () => {
    setCreateName('');
    setCreateEmail('');
    setCreatePassword('');
    setCreateRole('ADMIN');
    setErrorMsg('');
    setSuccessMsg('');
    setIsCreateOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (admin: AdminItem) => {
    setSelectedAdmin(admin);
    setEditName(admin.name);
    setEditRole(admin.role as 'SUPER_ADMIN' | 'ADMIN' | 'ASSESSOR');
    setEditIsActive(admin.isActive);
    setResetPasswordVal('');
    setErrorMsg('');
    setSuccessMsg('');
    setIsEditOpen(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (admin: AdminItem) => {
    setSelectedAdmin(admin);
    setErrorMsg('');
    setIsDeleteOpen(true);
  };

  // Submit Create Admin
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName,
          email: createEmail,
          password: createPassword,
          role: createRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create admin');

      setAdmins([data.admin, ...admins]);
      setIsCreateOpen(false);
      setSuccessMsg(`Administrator ${data.admin.name} created successfully.`);
      router.refresh();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Submit Edit Admin
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin) return;
    setErrorMsg('');
    setLoading(true);

    try {
      const payload: { name: string; role: string; isActive: boolean; password?: string } = {
        name: editName,
        role: editRole,
        isActive: editIsActive,
      };
      if (resetPasswordVal.trim()) {
        payload.password = resetPasswordVal.trim();
      }

      const res = await fetch(`/api/admin/admins/${selectedAdmin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update admin');

      setAdmins(admins.map(a => (a.id === selectedAdmin.id ? { ...a, ...data.admin } : a)));
      setIsEditOpen(false);
      setSuccessMsg(`Administrator ${data.admin.name} updated successfully.`);
      router.refresh();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Submit Delete Admin
  const handleDeleteSubmit = async () => {
    if (!selectedAdmin) return;
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/admins/${selectedAdmin.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete admin');

      setAdmins(admins.filter(a => a.id !== selectedAdmin.id));
      setIsDeleteOpen(false);
      setSuccessMsg(`Administrator removed successfully.`);
      router.refresh();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Quick generate password
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCreatePassword(pwd);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Alert Messages */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div 
          onClick={() => setRoleFilter('ALL')}
          className={`stat-card p-3 sm:p-5 cursor-pointer hover:shadow-md transition-all ${roleFilter === 'ALL' ? 'ring-2 ring-slate-400 border-transparent' : 'hover:border-slate-300'}`}
        >
          <div className="flex items-start justify-between">
            <div className="stat-icon h-8 w-8 sm:h-10 sm:w-10 bg-slate-100 text-slate-700">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</span>
          </div>
          <p className="stat-value text-xl sm:text-2xl mt-1">{totalCount}</p>
          <p className="stat-label text-[10px] sm:text-xs truncate">Total Admins</p>
        </div>

        <div 
          onClick={() => setRoleFilter('SUPER_ADMIN')}
          className={`stat-card p-3 sm:p-5 cursor-pointer hover:shadow-md transition-all ${roleFilter === 'SUPER_ADMIN' ? 'ring-2 ring-violet-500 border-transparent' : 'hover:border-violet-300'}`}
        >
          <div className="flex items-start justify-between">
            <div className="stat-icon h-8 w-8 sm:h-10 sm:w-10 bg-violet-50 text-violet-600">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="badge-purple text-[8px] sm:text-[9px] font-bold">Root</span>
          </div>
          <p className="stat-value text-xl sm:text-2xl text-violet-700 mt-1">{superAdminCount}</p>
          <p className="stat-label text-[10px] sm:text-xs truncate">Super Admins</p>
        </div>

        <div 
          onClick={() => setRoleFilter('ADMIN')}
          className={`stat-card p-3 sm:p-5 cursor-pointer hover:shadow-md transition-all ${roleFilter === 'ADMIN' ? 'ring-2 ring-blue-500 border-transparent' : 'hover:border-blue-300'}`}
        >
          <div className="flex items-start justify-between">
            <div className="stat-icon h-8 w-8 sm:h-10 sm:w-10 bg-blue-50 text-blue-600">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="badge-blue text-[8px] sm:text-[9px] font-bold">Standard</span>
          </div>
          <p className="stat-value text-xl sm:text-2xl text-blue-600 mt-1">{adminCount}</p>
          <p className="stat-label text-[10px] sm:text-xs truncate">Managers</p>
        </div>

        <div 
          onClick={() => setRoleFilter('ASSESSOR')}
          className={`stat-card p-3 sm:p-5 cursor-pointer hover:shadow-md transition-all ${roleFilter === 'ASSESSOR' ? 'ring-2 ring-emerald-500 border-transparent' : 'hover:border-emerald-300'}`}
        >
          <div className="flex items-start justify-between">
            <div className="stat-icon h-8 w-8 sm:h-10 sm:w-10 bg-emerald-50 text-emerald-600">
              <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="badge-green text-[8px] sm:text-[9px] font-bold">Analytics</span>
          </div>
          <p className="stat-value text-xl sm:text-2xl text-emerald-600 mt-1">{assessorCount}</p>
          <p className="stat-label text-[10px] sm:text-xs truncate">Assessors</p>
        </div>
      </div>

      {/* Control Bar & Actions */}
      <div className="card-p flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search & Filter */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none text-slate-900 transition-all"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg flex-wrap">
            {(['ALL', 'SUPER_ADMIN', 'ADMIN', 'ASSESSOR'] as const).map(role => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-2.5 sm:px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  roleFilter === role
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'

                }`}
              >
                {role === 'ALL'
                  ? 'All'
                  : role === 'SUPER_ADMIN'
                  ? 'Super'
                  : role === 'ADMIN'
                  ? 'Admins'
                  : 'Assessors'}
              </button>
            ))}
          </div>
        </div>

        {/* Create Button (Super Admin Only) */}
        {isSuperAdmin && (
          <button
            onClick={handleOpenCreate}
            className="btn-primary py-2 px-4 text-xs flex items-center justify-center gap-2 flex-shrink-0 w-full sm:w-auto"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create New Admin</span>
          </button>
        )}
      </div>

      {/* Admins Table */}
      <div className="table-wrapper">
        <div className="table-header">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Platform Administrators</h2>
            <p className="text-xs text-slate-400 mt-0.5">{filteredAdmins.length} users listed</p>
          </div>
        </div>

        {/* Desktop Table View (screens >= md) */}
        <div className="hidden md:block w-full">
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-slate-50/80">
              <tr>
                <th className="th" style={{ width: '30%' }}>Administrator</th>
                <th className="th text-center" style={{ width: '20%' }}>Role / Access</th>
                <th className="th text-center" style={{ width: '15%' }}>Status</th>
                <th className="th text-center" style={{ width: '15%' }}>Added Date</th>
                <th className="th text-center" style={{ width: '20%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="td text-center text-slate-400 py-12">
                    No administrators found matching the filters.
                  </td>
                </tr>
              ) : (
                filteredAdmins.map(admin => {
                  const isCurrent = admin.id === currentAdminId;
                  const isSuper = admin.role === 'SUPER_ADMIN';
                  const isStandard = admin.role === 'ADMIN';

                  return (
                    <tr key={admin.id} className="tr group">
                      {/* User Info */}
                      <td className="td">
                        <div className="flex items-center gap-3">
                          {admin.profileImageUrl ? (
                            <img
                              src={admin.profileImageUrl}
                              alt={admin.name}
                              className="h-9 w-9 flex-shrink-0 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                              isSuper ? 'bg-violet-600' : isStandard ? 'bg-blue-600' : 'bg-emerald-600'
                            }`}>
                              {admin.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold text-slate-900 truncate">{admin.name}</p>
                              {isCurrent && (
                                <span className="badge-slate text-[9px] px-1.5 py-0.2 bg-slate-100 text-slate-500 font-bold shrink-0">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate">{admin.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="td text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isSuper
                            ? 'bg-violet-50 text-violet-700 border border-violet-200'
                            : isStandard
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {isSuper && <ShieldCheck className="w-3 h-3" />}
                          {isStandard && <Shield className="w-3 h-3" />}
                          {!isSuper && !isStandard && <Eye className="w-3 h-3" />}
                          {isSuper ? 'Super Admin' : isStandard ? 'Admin' : 'Assessor'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="td text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          admin.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${admin.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {admin.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Created Date */}
                      <td className="td text-xs text-slate-400 text-center" suppressHydrationWarning>
                        {new Date(admin.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="td text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isSuperAdmin ? (
                            <>
                              <button
                                onClick={() => handleOpenEdit(admin)}
                                className="btn-ghost text-xs px-2.5 py-1.5 text-blue-600 hover:bg-blue-50"
                                title="Edit Role & Permissions"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              {!isCurrent && (
                                <button
                                  onClick={() => handleOpenDelete(admin)}
                                  className="btn-ghost text-xs px-2.5 py-1.5 text-red-500 hover:bg-red-50"
                                  title="Delete Admin"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-300">View Only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile & Tablet Cards View (screens < md) */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredAdmins.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No administrators found.
            </div>
          ) : (
            filteredAdmins.map((admin) => {
              const isCurrent = admin.id === currentAdminId;
              const isSuper = admin.role === 'SUPER_ADMIN';
              const isStandard = admin.role === 'ADMIN';

              return (
                <div key={admin.id} className="p-4 bg-white hover:bg-slate-50/50 transition-colors flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {admin.profileImageUrl ? (
                        <img
                          src={admin.profileImageUrl}
                          alt={admin.name}
                          className="h-10 w-10 flex-shrink-0 rounded-xl object-cover border border-slate-200"
                        />
                      ) : (
                        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm ${
                          isSuper ? 'bg-violet-600' : isStandard ? 'bg-blue-600' : 'bg-emerald-600'
                        }`}>
                          {admin.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900 truncate">{admin.name}</p>
                          {isCurrent && (
                            <span className="badge-slate text-[9px] px-1.5 py-0.2 bg-slate-100 text-slate-500 font-bold">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{admin.email}</p>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                      isSuper
                        ? 'bg-violet-50 text-violet-700 border border-violet-200'
                        : isStandard
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {isSuper && <ShieldCheck className="w-3 h-3" />}
                      {isStandard && <Shield className="w-3 h-3" />}
                      {!isSuper && !isStandard && <Eye className="w-3 h-3" />}
                      {isSuper ? 'Super Admin' : isStandard ? 'Admin' : 'Assessor'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-2.5 text-xs text-slate-600">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Account Status</span>
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${admin.isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${admin.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {admin.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Joined Date</span>
                      <span className="font-medium text-slate-700 block" suppressHydrationWarning>
                        {new Date(admin.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  {isSuperAdmin && (
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-50">
                      <button
                        onClick={() => handleOpenEdit(admin)}
                        className="btn-secondary text-xs py-2 px-3 flex-1 flex items-center justify-center gap-1.5 text-blue-600 hover:bg-blue-50"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Role</span>
                      </button>
                      {!isCurrent && (
                        <button
                          onClick={() => handleOpenDelete(admin)}
                          className="btn-ghost text-xs py-2 px-3 flex items-center justify-center gap-1 text-red-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CREATE ADMIN MODAL */}

      {isCreateOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg animate-slide-up flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Create New Administrator</h3>
                  <p className="text-[11px] text-slate-400">Add an administrator and grant specific privileges</p>
                </div>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg">
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="Full name"
                    value={createName}
                    onChange={e => setCreateName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-none text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="Email address"
                    value={createEmail}
                    onChange={e => setCreateEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-none text-slate-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Initial Password</label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[11px] text-blue-600 font-semibold hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Auto-generate
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="Minimum 6 characters"
                    value={createPassword}
                    onChange={e => setCreatePassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Assign Role & Permissions</label>
                <div className="space-y-2">
                  {/* Super Admin */}
                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    createRole === 'SUPER_ADMIN'
                      ? 'border-violet-500 bg-violet-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="createRole"
                      checked={createRole === 'SUPER_ADMIN'}
                      onChange={() => setCreateRole('SUPER_ADMIN')}
                      className="mt-0.5 text-violet-600"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-violet-600" />
                        Super Administrator
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Full unrestricted control. Can create/remove other admins, configure system settings, and manage assessments.
                      </p>
                    </div>
                  </label>

                  {/* Standard Admin */}
                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    createRole === 'ADMIN'
                      ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="createRole"
                      checked={createRole === 'ADMIN'}
                      onChange={() => setCreateRole('ADMIN')}
                      className="mt-0.5 text-blue-600"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-blue-600" />
                        Administrator
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Operations manager. Can create & edit scenarios, packages, register candidates, and view reports.
                      </p>
                    </div>
                  </label>

                  {/* Assessor */}
                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    createRole === 'ASSESSOR'
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="createRole"
                      checked={createRole === 'ASSESSOR'}
                      onChange={() => setCreateRole('ASSESSOR')}
                      className="mt-0.5 text-emerald-600"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        Assessor / Viewer
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Read-only access to evaluate candidate sessions, view live progress, and download PDF reports.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="btn-ghost text-xs px-4 py-2 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary text-xs px-5 py-2 flex items-center gap-2"
                >
                  {loading ? 'Creating…' : 'Save Administrator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ADMIN MODAL */}
      {isEditOpen && selectedAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Administrator</h3>
                <p className="text-[11px] text-slate-400">{selectedAdmin.email}</p>
              </div>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg">
                &times;
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-none text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Role & Privileges</label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value as 'SUPER_ADMIN' | 'ADMIN' | 'ASSESSOR')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 bg-white"
                >
                  <option value="SUPER_ADMIN">👑 Super Administrator (Full Control)</option>
                  <option value="ADMIN">🛡️ Administrator (Scenarios & Candidates)</option>
                  <option value="ASSESSOR">📊 Assessor / Viewer (Read-only Reports)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status</label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="editStatus"
                      checked={editIsActive}
                      onChange={() => setEditIsActive(true)}
                      className="text-emerald-600"
                    />
                    <span className="font-semibold text-emerald-700">Active (Can Login)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="editStatus"
                      checked={!editIsActive}
                      onChange={() => setEditIsActive(false)}
                      className="text-slate-600"
                    />
                    <span className="font-semibold text-slate-500">Suspended / Inactive</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reset Password <span className="text-slate-400 font-normal">(Leave blank to keep unchanged)</span>
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    placeholder="Enter new password (optional)"
                    value={resetPasswordVal}
                    onChange={e => setResetPasswordVal(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-none text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="btn-ghost text-xs px-4 py-2 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary text-xs px-5 py-2 flex items-center gap-2"
                >
                  {loading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {isDeleteOpen && selectedAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-sm font-bold text-slate-900 mb-1">Delete Administrator?</h3>
            <p className="text-xs text-slate-500 mb-5">
              Are you sure you want to permanently remove <strong className="text-slate-900">{selectedAdmin.name}</strong> ({selectedAdmin.email})? They will lose access immediately.
            </p>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold mb-4 text-left">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsDeleteOpen(false)}
                className="btn-secondary text-xs px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSubmit}
                disabled={loading}
                className="btn-danger text-xs px-5 py-2"
              >
                {loading ? 'Deleting…' : 'Yes, Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
