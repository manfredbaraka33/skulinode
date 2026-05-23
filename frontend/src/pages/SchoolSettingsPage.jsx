import { useState, useEffect, useRef } from 'react';
import { Settings, Save, Loader2, Building2, Phone, Globe, MapPin, Upload } from 'lucide-react';
import { PageHeader, Toast, FieldError, useToast } from '../components/ui';
import apiClient from '../api/axios';

const SCHOOL_TYPES = [
  { value: 'PRIMARY',  label: 'Primary School' },
  { value: 'ORDINARY', label: 'Ordinary Secondary (O-Level)' },
  { value: 'ADVANCED', label: 'Advanced Secondary (A-Level)' },
  { value: 'COMBINED', label: 'Combined Primary & Secondary' },
];

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

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      {children}
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm
        outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100
        disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-400 ${className}`}
      {...props}
    />
  );
}

export default function SchoolSettingsPage() {
  const [toast, showToast, clearToast] = useToast();
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [school, setSchool]     = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoError, setLogoError] = useState('');
  const [errors, setErrors]     = useState({});
  const logoRef = useRef();

  useEffect(() => {
    apiClient.get('/school/')
      .then(r => { setSchool(r.data); setLogoPreview(r.data.logo ?? null); })
      .catch(() => showToast('Failed to load school details.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(field, val) {
    setSchool(prev => ({ ...prev, [field]: val }));
    setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
  }

  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const MAX_SIZE_MB = 5;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setLogoError('Unsupported file type. Please upload a JPEG, PNG, WebP, or GIF image.');
      setLogoFile(null);
      e.target.value = '';
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setLogoError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is ${MAX_SIZE_MB} MB.`);
      setLogoFile(null);
      e.target.value = '';
      return;
    }

    setLogoError('');
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    setErrors({});
    try {
      let payload;
      let config = {};

      if (logoFile) {
        payload = new FormData();
        const fields = ['name', 'school_type', 'region', 'district', 'ward', 'phone', 'email', 'website', 'po_box'];
        fields.forEach(f => { if (school[f] != null) payload.append(f, school[f]); });
        payload.append('logo', logoFile);
        config = { headers: { 'Content-Type': 'multipart/form-data' } };
      } else {
        const { name, school_type, region, district, ward, phone, email, website, po_box } = school;
        payload = { name, school_type, region, district, ward, phone, email, website, po_box };
      }

      const res = await apiClient.patch('/school/', payload, config);
      setSchool(res.data);
      setLogoFile(null);
      setLogoPreview(res.data.logo ?? null);
      showToast('School details saved successfully.');
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') setErrors(data);
      showToast('Failed to save. Check the fields below.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (!school) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {toast && <Toast {...toast} onClose={clearToast} />}

      <PageHeader
        icon={Settings}
        title="School Settings"
        subtitle="Manage your school profile, contact details, and branding"
        action={
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-60 transition"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        }
      />

      <div className="space-y-5">
        {/* School Identity */}
        <Section title="School Identity" icon={Building2}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="School Name">
                <Input value={school.name ?? ''} onChange={e => handleChange('name', e.target.value)} />
                <FieldError message={errors.name?.[0]} />
              </Field>
            </div>
            <Field label="Registration Number" hint="Issued by MoE / NECTA — cannot be changed here">
              <Input value={school.registration_number ?? ''} disabled />
            </Field>
            <Field label="School Type">
              <select
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                value={school.school_type ?? ''}
                onChange={e => handleChange('school_type', e.target.value)}
              >
                {SCHOOL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <FieldError message={errors.school_type?.[0]} />
            </Field>
          </div>
        </Section>

        {/* Contact Info */}
        <Section title="Contact Information" icon={Phone}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone Number">
              <Input type="tel" placeholder="+255 712 345 678" value={school.phone ?? ''} onChange={e => handleChange('phone', e.target.value)} />
              <FieldError message={errors.phone?.[0]} />
            </Field>
            <Field label="Email Address">
              <Input type="email" placeholder="info@school.tz" value={school.email ?? ''} onChange={e => handleChange('email', e.target.value)} />
              <FieldError message={errors.email?.[0]} />
            </Field>
            <Field label="Website">
              <Input type="url" placeholder="https://school.ac.tz" value={school.website ?? ''} onChange={e => handleChange('website', e.target.value)} />
              <FieldError message={errors.website?.[0]} />
            </Field>
            <Field label="Post Address">
              <Input placeholder="e.g.  P.O. Box 123, MOSHI" value={school.po_box ?? ''} onChange={e => handleChange('po_box', e.target.value)} />
              <FieldError message={errors.po_box?.[0]} />
            </Field>
          </div>
        </Section>

        {/* Location */}
        <Section title="Location" icon={MapPin}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Region">
              <Input placeholder="e.g. Mwanza" value={school.region ?? ''} onChange={e => handleChange('region', e.target.value)} />
              <FieldError message={errors.region?.[0]} />
            </Field>
            <Field label="District">
              <Input placeholder="e.g. Ilemela" value={school.district ?? ''} onChange={e => handleChange('district', e.target.value)} />
              <FieldError message={errors.district?.[0]} />
            </Field>
            <Field label="Ward (optional)">
              <Input placeholder="e.g. Buswelu" value={school.ward ?? ''} onChange={e => handleChange('ward', e.target.value)} />
              <FieldError message={errors.ward?.[0]} />
            </Field>
          </div>
        </Section>

        {/* Logo */}
        <Section title="School Logo" icon={Globe}>
          <div className="flex items-start gap-6 flex-wrap">
            <div className="shrink-0">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="School logo"
                  className="w-24 h-24 rounded-full object-contain border-2 border-slate-200 dark:border-slate-600 bg-white"
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center bg-slate-50 dark:bg-slate-700">
                  <Building2 size={28} className="text-slate-300 dark:text-slate-500" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Upload a school crest or logo. It will appear on report cards.<br />
                Accepted: JPEG, PNG, WebP, GIF &mdash; max 5 MB. Recommended: square, at least 200×200 px.
              </p>
              <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleLogoChange} className="hidden" />
              <button
                onClick={() => logoRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                <Upload size={14} /> {logoPreview ? 'Change Logo' : 'Upload Logo'}
              </button>
              {logoFile && <p className="mt-2 text-xs text-green-600 dark:text-green-400">New logo selected: {logoFile.name}</p>}
              {logoError
                ? <p className="mt-2 flex items-center gap-1 text-xs text-red-600"><span>⚠</span> {logoError}</p>
                : <FieldError message={errors.logo?.[0]} />
              }
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
