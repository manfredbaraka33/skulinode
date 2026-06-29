import { useState,useRef,useEffect } from 'react';
import { KeyRound, Loader2, Eye, EyeOff, PersonStandingIcon } from 'lucide-react';
import { PageHeader, Toast, useToast } from '../components/ui';
import apiClient from '../api/axios';
import { useAuth } from '../context/AuthContext';

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40">
        <Icon size={15} className="text-blue-500" />
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, show, onToggle }) {
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 pr-10 text-sm
          outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        tabIndex={-1}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function SignatureUpload() {
  const { auth } = useAuth();
  const [preview,   setPreview]   = useState(null);
  const [current,   setCurrent]   = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [msg,       setMsg]       = useState(null);
  const inputRef = useRef(null);
  const [role, setRole] = useState(null);
  const [roles, setRoles] = useState(null);
  // Add a loading state to prevent flashing the UI
  const [loading, setLoading] = useState(true); 

  async function fetchUserDetails() {
    try {
      const res = await apiClient.get('/user/profile');
      // console.log("Raw user profile data from backend:", res.data);
      setCurrent(res.data.signature_url ?? res.data.signature ?? null);
      setRole(res.data.role);
      setRole(res.data.roles);
    } catch (error) {
      // console.error("Failed to fetch user details:", error);
    } finally {
      // Set loading to false whether it succeeds or fails
      setLoading(false); 
    }
  }

  useEffect(() => {
    fetchUserDetails();
  }, []);


  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      setMsg({ type: 'error', text: 'JPEG, PNG au WEBP tu inaruhusiwa.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ type: 'error', text: 'Faili lazima iwe chini ya 2MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleUpload() {
    if (!inputRef.current?.files?.[0]) return;
    setUploading(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append('signature', inputRef.current.files[0]);
      const r = await apiClient.post('/auth/signature/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCurrent(r.data.signature_url);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = '';
      setMsg({ type: 'success', text: 'Sahihi imehifadhiwa.' });
    } catch {
      setMsg({ type: 'error', text: 'Imeshindwa kupakia sahihi.' });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setMsg(null);
    try {
      await apiClient.delete('/auth/signature/');
      setCurrent(null);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = '';
      setMsg({ type: 'success', text: 'Sahihi imefutwa.' });
    } catch {
      setMsg({ type: 'error', text: 'Imeshindwa kufuta sahihi.' });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return null; 
  if (role === "PARENT") return null;

  return (
    <div className="mt-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
        Sahihi Yako
      </h3>
      <p className="text-xs text-slate-400 mb-4">
        Sahihi hii itaonekana kwenye kadi za ripoti za wanafunzi badala ya mstari tupu.
        Saini kwenye karatasi nyeupe, piga picha, kisha pakia hapa.
      </p>

      {msg && (
        <div className={`mb-3 text-xs px-3 py-2 rounded-lg ${
          msg.type === 'success'
            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
            : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
        }`}>
          {msg.text}
        </div>
      )}

      <div className="flex items-start gap-6 flex-wrap">
        {/* Current signature */}
        {current && !preview && (
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs text-slate-400 mb-1">Sahihi ya Sasa</div>
            <div className="border border-slate-200 dark:border-slate-600 rounded-lg p-3 bg-white"
              style={{ minWidth: 160, minHeight: 64 }}>
              <img src={current} alt="Signature" className="max-h-16 max-w-40 object-contain"/>
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-red-500 hover:underline disabled:opacity-50">
              {deleting ? 'Inafuta...' : 'Futa sahihi'}
            </button>
          </div>
        )}

        {/* Preview of new upload */}
        {preview && (
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs text-slate-400 mb-1">Mpya (Hakiki)</div>
            <div className="border-2 border-blue-400 rounded-lg p-3 bg-white"
              style={{ minWidth: 160, minHeight: 64 }}>
              <img src={preview} alt="Preview" className="max-h-16 max-w-40 object-contain"/>
            </div>
          </div>
        )}

        {/* Upload controls */}
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFile}
            className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 cursor-pointer"
          />
          <p className="text-xs text-slate-400">JPEG, PNG au WEBP · Max 2MB</p>
          {preview && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition">
              {uploading ? 'Inapakia...' : 'Hifadhi Sahihi'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [toast, showToast, clearToast] = useToast();
  const [saving, setSaving] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [errors, setErrors] = useState({});

  const [mydetails, setMyDetails] = useState(null);
  
   

  async function fetchUserDetails() {
    try {
      const res = await apiClient.get('/user/profile');
      // console.log("Raw user profile data from backend:", res.data);
      setMyDetails(res.data);
    } catch (error) {
      // console.error("Failed to fetch user details:", error);
    } 
  }

  useEffect(() => {
    fetchUserDetails();
  }, []);


  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
  }

  function validate() {
    const e = {};
    if (!form.old_password) e.old_password = 'Current password is required.';
    if (!form.new_password) e.new_password = 'New password is required.';
    else if (form.new_password.length < 8) e.new_password = 'Must be at least 8 characters.';
    if (!form.confirm_password) e.confirm_password = 'Please confirm your new password.';
    else if (form.new_password !== form.confirm_password) e.confirm_password = 'Passwords do not match.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      await apiClient.post('/user/change-password/', {
        old_password: form.old_password,
        new_password: form.new_password,
      });
      setForm({ old_password: '', new_password: '', confirm_password: '' });
      showToast('Password changed successfully.');
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Failed to change password.';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {toast && <Toast {...toast} onClose={clearToast} />}

      <PageHeader
        icon={KeyRound}
        title="My Account"
        subtitle="Manage your account"
       
      />
      <Section title='My details' className="mb-6" icon={PersonStandingIcon}>
        <div className='dark:text-white text-gray-700'>
          
          {mydetails && (
              <div>
                <p>Full Name: {mydetails?.full_name}</p>
                <p>Role(s): {mydetails?.role} {mydetails?.roles.length > 0 && (
                  <>{mydetails?.roles.map((r, i)=>( <span key={i}>, {r}</span>))}
                  </>
                    )}
                </p>
                {mydetails?.phone_number && (
                  <p>Phone: {mydetails?.phone_number}</p> 
                )}
                {mydetails?.email && (
                  <p>Email: {mydetails?.email}</p> 
                )}
              </div>
          )}
        </div>
      </Section>
      <br /><br />
      <Section title="Change Password" icon={KeyRound}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Current Password">
            <PasswordInput
              value={form.old_password}
              onChange={e => handleChange('old_password', e.target.value)}
              placeholder="Enter current password"
              show={showOld}
              onToggle={() => setShowOld(v => !v)}
            />
            {errors.old_password && (
              <p className="mt-1 text-xs text-red-500">{errors.old_password}</p>
            )}
          </Field>

          <Field label="New Password">
            <PasswordInput
              value={form.new_password}
              onChange={e => handleChange('new_password', e.target.value)}
              placeholder="Min. 8 characters"
              show={showNew}
              onToggle={() => setShowNew(v => !v)}
            />
            {errors.new_password && (
              <p className="mt-1 text-xs text-red-500">{errors.new_password}</p>
            )}
          </Field>

          <Field label="Confirm New Password">
            <PasswordInput
              value={form.confirm_password}
              onChange={e => handleChange('confirm_password', e.target.value)}
              placeholder="Repeat new password"
              show={showConfirm}
              onToggle={() => setShowConfirm(v => !v)}
            />
            {errors.confirm_password && (
              <p className="mt-1 text-xs text-red-500">{errors.confirm_password}</p>
            )}
          </Field>

          <div className="pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-60 transition"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              {saving ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </form>
      </Section>
      
          <SignatureUpload />
      
    </div>
  );
}
