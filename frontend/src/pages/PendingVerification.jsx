import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { School, Clock, Phone, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import apiClient from '../api/axios';

const POLL_INTERVAL_MS = 20_000; // check every 20 s

export default function PendingVerification() {
  const location = useLocation();
  const navigate = useNavigate();

  // Username is passed as location state from Login; fall back to localStorage
  const username =
    location.state?.username ??
    (() => {
      try { return JSON.parse(localStorage.getItem('skulinode_pending_username') || 'null'); }
      catch { return null; }
    })();

  const [approved, setApproved] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!username) return; // nothing to poll

    async function checkStatus() {
      try {
        const res = await apiClient.get(
          `/auth/check-verification/?username=${encodeURIComponent(username)}`
        );
        if (res.data?.verified) {
          setApproved(true);
          clearInterval(timerRef.current);
          // Auto-redirect to login after 3 s
          setTimeout(() => navigate('/login', { replace: true }), 3000);
        }
      } catch {
        // silently ignore network errors — just try again next tick
      }
    }

    checkStatus(); // immediate first check
    timerRef.current = setInterval(checkStatus, POLL_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [username, navigate]);

  return (
    <div className="min-h-screen bg-linear-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className={`px-8 py-7 bg-linear-to-r ${approved ? 'from-emerald-500 to-teal-600' : 'from-amber-500 to-orange-500'} transition-colors duration-500`}>
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-white/20 rounded-lg p-2">
              <School size={22} className="text-white" />
            </div>
            <h1 className="text-white text-xl font-bold tracking-tight">SkuliNode</h1>
          </div>
          <p className="text-white/80 text-sm">School Registration</p>
        </div>

        <div className="px-8 py-8 space-y-6">

          {approved ? (
            /* ── Approved state ── */
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle size={32} className="text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">You're Approved!</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Your school has been verified. Redirecting you to the sign-in page…
              </p>
              <Link
                to="/login"
                className="mt-2 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700
                  text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition"
              >
                Sign In Now
              </Link>
            </div>
          ) : (
            /* ── Pending state ── */
            <>
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock size={32} className="text-amber-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Verification Pending</h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Your school registration was received successfully. Our team is reviewing
                  your details and will activate your account shortly.
                </p>
                {username && (
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" />
                    Checking status automatically every 20 seconds…
                  </p>
                )}
              </div>

              {/* What happens next */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">What happens next</p>
                <ul className="text-sm text-slate-700 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    The SkuliNode team reviews your school details.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    Once approved, this page updates automatically — no refresh needed.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    Verification usually takes up to 72 business hours.
                  </li>
                </ul>
              </div>

              {/* Contact callout */}
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <Phone size={18} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-0.5">Need it faster?</p>
                  <p className="text-sm text-slate-700">
                    Call{' '}
                    <a href="tel:+255752303770" className="font-bold text-amber-600 hover:underline">
                      0752 303 770
                    </a>
                    {' '}or WhatsApp{' '}
                    <a href="https://wa.me/255712750468" target="_blank" rel="noreferrer" className="font-bold text-amber-600 hover:underline">
                      0712 750 468
                    </a>
                    {' '}and we'll expedite your verification.
                  </p>
                </div>
              </div>

              {/* Back to login */}
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition"
              >
                <ArrowLeft size={14} />
                Back to Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
