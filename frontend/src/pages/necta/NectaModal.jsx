import { X } from 'lucide-react';

export default function NectaModal({ title, onClose, children, maxWidth = 'max-w-2xl' }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`bg-[#faf8f3] rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[85vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white rounded-t-2xl">
          <h2 style={{ fontFamily: "'Fraunces', serif" }} className="font-semibold text-[#1e3a5f] text-lg">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}