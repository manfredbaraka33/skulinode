import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { School, Loader2, AlertCircle, LogIn, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [serverError, setServerError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ mode: 'onTouched' });

  async function onSubmit({ username, password }) {
    setServerError(null);
    try {
      const authData = await login(username, password);
      // Super admin (no school) goes to Django admin for now
      if (!authData.schoolSlug) {
        window.location.href = 'http://127.0.0.1:8000/admin/';
        return;
      }
      navigate(`/${authData.schoolSlug}/dashboard`, { replace: true });
    } catch (err) {
      const data = err.response?.data ?? {};
      if (data.code === 'school_pending_verification') {
        // Store username so the pending page can poll for approval
        localStorage.setItem('skulinode_pending_username', JSON.stringify(username));
        navigate('/pending-verification', { replace: true, state: { username } });
        return;
      }
      const message =
        data.message ??
        (typeof data.detail === 'string' ? data.detail : null) ??
        'Invalid username or password.';
      setServerError(message);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-linear-to-r from-blue-600 to-indigo-600 px-8 py-7">
          <div className="flex items-center gap-3 mb-1">
            {/* <div className="bg-white/20 rounded-lg p-2">
              <School size={22} className="text-white" />
            </div> */}
            <Logo />
            <h1 className="text-white text-xl font-bold tracking-tight">SkuliNode</h1>
          </div>
          <p className="text-blue-100 text-sm">Sign in to your school dashboard</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-8 py-7 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              type="text"
              placeholder="saleh"
              autoComplete="username"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500
                ${errors.username ? 'border-red-400' : 'border-slate-300'}`}
              {...register('username', {
                required: 'Username is required.',
              })}
            />
            {errors.username && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <AlertCircle size={12} /> {errors.username.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className={`w-full rounded-lg border px-3 py-2 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-blue-500
                  ${errors.password ? 'border-red-400' : 'border-slate-300'}`}
                {...register('password', { required: 'Password is required.' })}
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
            {errors.password && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <AlertCircle size={12} /> {errors.password.message}
              </p>
            )}
          </div>

          {serverError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex gap-2">
              <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{serverError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60
              text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="text-center text-xs text-slate-500">
            New school?{' '}
            <Link to="/register-school" className="text-blue-600 hover:underline font-medium">
              Register here
            </Link>
            <br />
             <Link to='/'><button className='bg-gray-600 rounded-lg p-2 text-gray-50 mt-4'>Home</button></Link>
          </p>
        </form>
      </div>
    </div>
  );
}
