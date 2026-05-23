import { useState } from 'react';
import { KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';
import { PageHeader, Toast, useToast } from '../components/ui';
import apiClient from '../api/axios';

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

export default function ProfilePage() {
  const [toast, showToast, clearToast] = useToast();
  const [saving, setSaving] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [errors, setErrors] = useState({});

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
        subtitle="Change your login password"
      />

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
    </div>
  );
}
