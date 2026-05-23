import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { School, User, CheckCircle, AlertCircle, Loader2, ChevronRight, ChevronLeft, Eye, EyeOff } from 'lucide-react';
import apiClient from '../api/axios';

const TANZANIAN_REGIONS = [
  'Arusha', 'Dar es Salaam', 'Dodoma', 'Geita', 'Iringa', 'Kagera',
  'Katavi', 'Kigoma', 'Kilimanjaro', 'Lindi', 'Manyara', 'Mara',
  'Mbeya', 'Morogoro', 'Mtwara', 'Mwanza', 'Njombe', 'Pemba North',
  'Pemba South', 'Pwani', 'Rukwa', 'Ruvuma', 'Shinyanga', 'Simiyu',
  'Singida', 'Songwe', 'Tabora', 'Tanga', 'Unguja North', 'Unguja South',
  'Unguja Urban West',
];

const SCHOOL_TYPES = [
  { value: 'PRIMARY',  label: 'Primary School' },
  { value: 'ORDINARY', label: 'Ordinary Secondary — O-Level' },
  { value: 'ADVANCED', label: 'Advanced Secondary — A-Level' },
  { value: 'COMBINED', label: 'Combined Ordinary & Advanced (O+A Level)' },
];

const STEPS = ['School Information', 'Admin Account'];

function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
      <AlertCircle size={12} />
      {message}
    </p>
  );
}

function InputField({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
      <FieldError message={error?.message} />
    </div>
  );
}

export default function RegisterSchool() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm({ mode: 'onTouched' });

  const step0Fields = ['school_name', 'registration_number', 'school_type', 'region', 'district'];
  const step1Fields = ['first_name', 'last_name', 'email', 'password'];

  async function goNext() {
    const valid = await trigger(step0Fields);
    if (valid) setStep(1);
  }

  async function onSubmit(data) {
    setServerError(null);
    try {
      await apiClient.post('/auth/register-school/', data);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      const detail = err.response?.data;
      if (detail && typeof detail === 'object') {
        const messages = Object.entries(detail)
          .map(([field, msgs]) => {
            const text = Array.isArray(msgs) ? msgs.join(' ') : String(msgs);
            return `${field}: ${text}`;
          })
          .join('\n');
        setServerError(messages);
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <CheckCircle size={56} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">School Registered!</h2>
          <p className="text-slate-500 text-sm">
            Your school has been created successfully. Redirecting you to login…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-linear-to-r from-blue-600 to-indigo-600 px-8 py-7">
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-white/20 rounded-lg p-2">
              <School size={22} className="text-white" />
            </div>
            <h1 className="text-white text-xl font-bold tracking-tight">SkuliNode</h1>
          </div>
          <p className="text-blue-100 text-sm">Register your school and create the administrator account</p>
        </div>

        {/* Step indicator */}
        <div className="px-8 pt-6 pb-2 flex items-center gap-3">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                  ${i === step ? 'bg-blue-600 text-white' : i < step ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}
              >
                {i < step ? <CheckCircle size={14} /> : i + 1}
              </div>
              <span className={`text-sm font-medium ${i === step ? 'text-blue-700' : 'text-slate-400'}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && <ChevronRight size={16} className="text-slate-300 ml-1" />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="px-8 py-6 space-y-5">

            {/* ── STEP 0: School Information ── */}
            {step === 0 && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <School size={16} className="text-blue-600" />
                  <h2 className="text-base font-semibold text-slate-700">School Information</h2>
                </div>

                <InputField label="School Name" error={errors.school_name}>
                  <input
                    type="text"
                    placeholder="e.g. Mwanza Secondary School"
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500
                      ${errors.school_name ? 'border-red-400' : 'border-slate-300'}`}
                    {...register('school_name', { required: 'School name is required.' })}
                  />
                </InputField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField label="Registration Number" error={errors.registration_number}>
                    <input
                      type="text"
                      placeholder="e.g. S.0123 or PS-0456"
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500
                        ${errors.registration_number ? 'border-red-400' : 'border-slate-300'}`}
                      {...register('registration_number', {
                        required: 'Registration number is required.',
                        pattern: {
                          value: /^(S{1,2}\.\d{4,6}|AS\.\d{4,6}|PS?-\d{4,6})$/i,
                          message: 'Format: S.NNNN, SS.NNNN, AS.NNNN, PS-NNNN or P-NNNN',
                        },
                      })}
                    />
                  </InputField>

                  <InputField label="School Type" error={errors.school_type}>
                    <select
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 bg-white
                        ${errors.school_type ? 'border-red-400' : 'border-slate-300'}`}
                      {...register('school_type', { required: 'School type is required.' })}
                    >
                      <option value="">Select type…</option>
                      {SCHOOL_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </InputField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField label="Region" error={errors.region}>
                    <select
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 bg-white
                        ${errors.region ? 'border-red-400' : 'border-slate-300'}`}
                      {...register('region', { required: 'Region is required.' })}
                    >
                      <option value="">Select region…</option>
                      {TANZANIAN_REGIONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </InputField>

                  <InputField label="District" error={errors.district}>
                    <input
                      type="text"
                      placeholder="e.g. Nyamagana"
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500
                        ${errors.district ? 'border-red-400' : 'border-slate-300'}`}
                      {...register('district', { required: 'District is required.' })}
                    />
                  </InputField>
                </div>

                <InputField label="Ward (optional)" error={errors.ward}>
                  <input
                    type="text"
                    placeholder="e.g. Mahina"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                    {...register('ward')}
                  />
                </InputField>
              </>
            )}

            {/* ── STEP 1: Admin Account ── */}
            {step === 1 && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <User size={16} className="text-blue-600" />
                  <h2 className="text-base font-semibold text-slate-700">Administrator Account</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField label="First Name" error={errors.first_name}>
                    <input
                      type="text"
                      placeholder="e.g. Amina"
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500
                        ${errors.first_name ? 'border-red-400' : 'border-slate-300'}`}
                      {...register('first_name', { required: 'First name is required.' })}
                    />
                  </InputField>

                  <InputField label="Last Name" error={errors.last_name}>
                    <input
                      type="text"
                      placeholder="e.g. Mwangi"
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500
                        ${errors.last_name ? 'border-red-400' : 'border-slate-300'}`}
                      {...register('last_name', { required: 'Last name is required.' })}
                    />
                  </InputField>
                </div>

                <InputField label="Email Address" error={errors.email}>
                  <input
                    type="email"
                    placeholder="admin@school.ac.tz"
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500
                      ${errors.email ? 'border-red-400' : 'border-slate-300'}`}
                    {...register('email', {
                      required: 'Email is required.',
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address.' },
                    })}
                  />
                </InputField>

                <InputField label="Password" error={errors.password}>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimum 8 characters"
                      className={`w-full rounded-lg border px-3 py-2 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-blue-500
                        ${errors.password ? 'border-red-400' : 'border-slate-300'}`}
                      {...register('password', {
                        required: 'Password is required.',
                        minLength: { value: 8, message: 'Password must be at least 8 characters.' },
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </InputField>

                {/* Server error banner */}
                {serverError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex gap-2">
                    <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                    <pre className="text-xs text-red-700 whitespace-pre-wrap font-sans">{serverError}</pre>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer navigation */}
          <div className="px-8 pb-8 flex justify-between items-center">
            {step === 1 ? (
              <button
                type="button"
                onClick={() => setStep(0)}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition"
              >
                <ChevronLeft size={16} /> Back
              </button>
            ) : (
              <span />
            )}

            {step === 0 ? (
              <button
                type="button"
                onClick={goNext}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition"
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                {isSubmitting ? 'Registering…' : 'Register School'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
