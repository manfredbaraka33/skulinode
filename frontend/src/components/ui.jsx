import { useState } from 'react';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

export function Toast({ message, type = 'success', onClose }) {
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium
      ${type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
      <span className="max-w-xs">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X size={13} /></button>
    </div>
  );
}

export function Modal({ title, onClose, children, maxWidth = 'max-w-md' }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full ${maxWidth}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-600"><AlertCircle size={11} /> {message}</p>
  );
}

export function PageHeader({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <div className="bg-blue-600 rounded-xl p-2">
          <Icon size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ message, action }) {
  return (
    <div className="text-center py-16 text-slate-400 text-sm space-y-3">
      <p>{message}</p>
      {action}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState(null);
  const show = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
  return [toast, show, () => setToast(null)];
}

