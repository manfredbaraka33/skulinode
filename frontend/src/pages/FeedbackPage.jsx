import { useState } from 'react';
import { MessageSquarePlus, Star, Loader2, Send, CheckCircle } from 'lucide-react';
import { PageHeader, Toast, useToast } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/axios';

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? null : n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="transition"
          aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
        >
          <Star
            size={22}
            className={`transition ${
              n <= (hovered || value)
                ? 'text-amber-400 fill-amber-400'
                : 'text-slate-300 dark:text-slate-600'
            }`}
          />
        </button>
      ))}
      {value && (
        <span className="ml-2 text-xs text-slate-400 self-center">
          {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][value]}
        </span>
      )}
    </div>
  );
}

export default function FeedbackPage() {
  const { auth } = useAuth();
  const [toast, showToast, clearToast] = useToast();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setSaving(true);
    try {
      await apiClient.post('/feedback/', { subject, message, rating });
      setSubmitted(true);
    } catch {
      showToast('Failed to send feedback. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSubject('');
    setMessage('');
    setRating(null);
    setSubmitted(false);
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      {toast && <Toast {...toast} onClose={clearToast} />}

      <PageHeader
        icon={MessageSquarePlus}
        title="Send Feedback"
        subtitle="Tell us how we can improve SkuliNode"
      />

      {submitted ? (
        <div className="mt-8 flex flex-col items-center text-center gap-4 py-12">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">Thank you!</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Your feedback has been received by the SkuliNode team.
            </p>
          </div>
          <button
            onClick={handleReset}
            className="mt-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200
              text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300
              dark:hover:bg-slate-700 transition"
          >
            Send another
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* From info — read-only */}
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700
            rounded-xl px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
            Sending as <span className="font-medium text-slate-700 dark:text-slate-200">{auth?.fullName}</span>
            {auth?.schoolName && (
              <> from <span className="font-medium text-slate-700 dark:text-slate-200">{auth.schoolName}</span></>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Subject <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Feature request, Bug report, General feedback…"
              maxLength={200}
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm
                outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Share your thoughts, report a bug, or suggest an improvement…"
              rows={5}
              required
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm
                outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100
                resize-y min-h-24"
            />
          </div>

          {/* Rating */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              Overall rating <span className="text-slate-400">(optional)</span>
            </label>
            <StarRating value={rating} onChange={setRating} />
          </div>

          <button
            type="submit"
            disabled={saving || !message.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white
              text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {saving ? 'Sending…' : 'Send Feedback'}
          </button>
        </form>
      )}
    </div>
  );
}
