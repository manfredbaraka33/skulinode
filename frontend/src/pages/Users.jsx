import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, Pencil, Trash2, KeyRound, Loader2, AlertCircle,
  CheckCircle, X, Search, Users as UsersIcon, Eye, EyeOff,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import apiClient from '../api/axios';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { value: 'ADMIN',    label: 'School Admin' },
  { value: 'TEACHER',  label: 'Teacher' },
  { value: 'PARENT',   label: 'Parent/Guardian' },
  { value: 'STUDENT',  label: 'Student' },
];

const ROLE_COLORS = {
  ADMIN:   'bg-indigo-100 text-indigo-700',
  TEACHER: 'bg-emerald-100 text-emerald-700',
  PARENT:  'bg-amber-100 text-amber-700',
  STUDENT: 'bg-sky-100 text-sky-700',
};

function Toast({ message, type, onClose }) {
  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium
        ${type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}
    >
      {type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
      <AlertCircle size={11} /> {message}
    </p>
  );
}

export default function Users() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const slug = auth?.schoolSlug ?? '';

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState(null);       // user object being edited
  const [resetUser, setResetUser] = useState(null);     // user object for password reset
  const [confirmDelete, setConfirmDelete] = useState(null); // user to deactivate

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/users/', {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setStaff(res.data.results ?? res.data);
    } catch {
      showToast('Failed to load staff members.', 'error');
    } finally {
      setLoading(false);
    }
  }, [auth?.accessToken, showToast]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const filtered = staff.filter(u =>
    `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDeactivate(user) {
    try {
      await apiClient.delete(`/users/${user.id}/`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      showToast(`${user.first_name} deactivated.`);
      fetchStaff();
    } catch {
      showToast('Failed to deactivate user.', 'error');
    }
    setConfirmDelete(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Add modal */}
      {showAddModal && (
        <AddStaffModal
          accessToken={auth.accessToken}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchStaff(); showToast('Staff member added.'); }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {/* Edit modal */}
      {editUser && (
        <EditStaffModal
          user={editUser}
          accessToken={auth.accessToken}
          onClose={() => setEditUser(null)}
          onSuccess={() => { setEditUser(null); fetchStaff(); showToast('Staff updated.'); }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {/* Reset password modal */}
      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          accessToken={auth.accessToken}
          onClose={() => setResetUser(null)}
          onSuccess={() => { setResetUser(null); showToast('Password updated.'); }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {/* Confirm deactivate */}
      {confirmDelete && (
        <Modal title="Confirm Deactivation" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-slate-600 mb-5">
            Deactivate <strong>{confirmDelete.first_name} {confirmDelete.last_name}</strong>?
            They will no longer be able to log in.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setConfirmDelete(null)}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >Cancel</button>
            <button
              onClick={() => handleDeactivate(confirmDelete)}
              className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
            >Deactivate</button>
          </div>
        </Modal>
      )}

      {/* Page content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 rounded-xl p-2">
              <UsersIcon size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Staff Management</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{auth?.schoolName}</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            <UserPlus size={15} /> Add Staff Member
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
          />
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={28} className="animate-spin text-blue-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              {search ? 'No results for your search.' : 'No staff members yet. Add your first one!'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  {['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                      {user.first_name} {user.last_name}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{user.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[user.role] ?? 'bg-slate-100 text-slate-600'}`}>
                          {ROLES.find(r => r.value === user.role)?.label ?? user.role}
                        </span>
                        {(user.roles ?? []).map(r => (
                          <span key={r} className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full opacity-75 ${ROLE_COLORS[r] ?? 'bg-slate-100 text-slate-600'}`}>
                            {ROLES.find(x => x.value === r)?.label ?? r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full
                        ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          title="Edit"
                          onClick={() => setEditUser(user)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-blue-600 transition"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          title="Reset Password"
                          onClick={() => setResetUser(user)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-amber-600 transition"
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          title="Deactivate"
                          onClick={() => setConfirmDelete(user)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-red-600 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Add Staff Modal ─────────────────────────────────────────────────────── */
function AddStaffModal({ accessToken, onClose, onSuccess, onError }) {
  const [showPw, setShowPw] = useState(false);
  const { register, handleSubmit, watch, setValue, setError, formState: { errors, isSubmitting } } = useForm({ mode: 'onTouched' });
  const [additionalRoles, setAdditionalRoles] = useState([]);
  const primaryRole = watch('role');

  // Auto-fill username from email prefix when email changes.
  const emailValue = watch('email');
  const usernameValue = watch('username');
  useState(() => {
    if (!emailValue) return;
    const prefix = emailValue.split('@')[0].toLowerCase().replace(/[^a-z0-9._+-@]/g, '');
    if (prefix && !usernameValue) setValue('username', prefix);
  });

  function toggleRole(value) {
    setAdditionalRoles(prev => prev.includes(value) ? prev.filter(r => r !== value) : [...prev, value]);
  }

  async function onSubmit(data) {
    try {
      const roles = additionalRoles.filter(r => r !== data.role);
      await apiClient.post('/users/', { ...data, roles }, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      onSuccess();
    } catch (err) {
      const detail = err.response?.data;
      if (detail && typeof detail === 'object') {
        // Surface field-level errors inline (e.g. username already taken).
        if (detail.username) {
          setError('username', { message: Array.isArray(detail.username) ? detail.username.join(' ') : detail.username });
          return;
        }
        const msgs = Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join('; ');
        onError(msgs);
      } else {
        onError('Failed to add staff member.');
      }
    }
  }

  return (
    <Modal title="Add Staff Member" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">First Name</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              {...register('first_name', { required: 'Required' })} />
            <FieldError message={errors.first_name?.message} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Last Name</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              {...register('last_name', { required: 'Required' })} />
            <FieldError message={errors.last_name?.message} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email Address</label>
          <input type="email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            {...register('email', {
              required: 'Required',
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
              onChange: (e) => {
                const prefix = e.target.value.split('@')[0].toLowerCase().replace(/[^a-z0-9._+@-]/g, '');
                if (prefix) setValue('username', prefix, { shouldDirty: false });
              },
            })} />
          <FieldError message={errors.email?.message} />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
          <input type="text" className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.username ? 'border-red-400' : 'border-slate-200'
          }`}
            placeholder="e.g. john.doe"
            autoComplete="username"
            {...register('username', {
              required: 'Required',
              pattern: { value: /^[\w.@+-]+$/, message: 'Letters, digits, and .@+-_ only' },
            })} />
          <FieldError message={errors.username?.message} />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Primary Role</label>
          <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            {...register('role', { required: 'Required' })}>
            <option value="">Select role…</option>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <FieldError message={errors.role?.message} />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Additional Roles <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          {!primaryRole ? (
            <p className="text-xs text-slate-400 italic">Select a primary role first</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {ROLES.filter(r => r.value !== primaryRole).map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => toggleRole(r.value)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition
                    ${additionalRoles.includes(r.value)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-9 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Min. 8 characters"
              {...register('password', {
                required: 'Required',
                minLength: { value: 8, message: 'Min 8 characters' }
              })} />
            <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <FieldError message={errors.password?.message} />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number <span className="text-slate-400 font-normal">(optional)</span></label>
          <input type="tel" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+255712345678"
            {...register('phone_number')} />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Add Member
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ─── Edit Staff Modal ────────────────────────────────────────────────────── */
function EditStaffModal({ user, accessToken, onClose, onSuccess, onError }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    mode: 'onTouched',
    defaultValues: {
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      phone_number: user.phone_number ?? '',
    },
  });
  const [additionalRoles, setAdditionalRoles] = useState(user.roles ?? []);
  const primaryRole = watch('role');

  function toggleRole(value) {
    setAdditionalRoles(prev => prev.includes(value) ? prev.filter(r => r !== value) : [...prev, value]);
  }

  async function onSubmit(data) {
    try {
      const roles = additionalRoles.filter(r => r !== data.role);
      await apiClient.patch(`/users/${user.id}/`, { ...data, roles }, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      onSuccess();
    } catch {
      onError('Failed to update staff member.');
    }
  }

  return (
    <Modal title={`Edit — ${user.first_name} ${user.last_name}`} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">First Name</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              {...register('first_name', { required: 'Required' })} />
            <FieldError message={errors.first_name?.message} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Last Name</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              {...register('last_name', { required: 'Required' })} />
            <FieldError message={errors.last_name?.message} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Primary Role</label>
          <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            {...register('role', { required: 'Required' })}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <FieldError message={errors.role?.message} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Additional Roles <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {ROLES.filter(r => r.value !== primaryRole).map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => toggleRole(r.value)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition
                  ${additionalRoles.includes(r.value)
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number</label>
          <input type="tel" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            {...register('phone_number')} />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Save Changes
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ─── Reset Password Modal ────────────────────────────────────────────────── */
function ResetPasswordModal({ user, accessToken, onClose, onSuccess, onError }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ mode: 'onTouched' });
  const [showPw, setShowPw] = useState(false);

  async function onSubmit({ password }) {
    try {
      await apiClient.post(`/users/${user.id}/reset-password/`, { password }, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      onSuccess();
    } catch {
      onError('Failed to reset password.');
    }
  }

  return (
    <Modal title={`Reset Password — ${user.first_name} ${user.last_name}`} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-sm text-slate-500">Set a new password for this account.</p>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">New Password</label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-9 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Min. 8 characters"
              {...register('password', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })} />
            <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <FieldError message={errors.password?.message} />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60">
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Reset Password
          </button>
        </div>
      </form>
    </Modal>
  );
}
