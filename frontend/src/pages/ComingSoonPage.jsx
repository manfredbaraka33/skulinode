import { useNavigate } from 'react-router-dom';

export default function ComingSoonPage({ title, description, icon = '🕓' }) {
  const navigate = useNavigate();
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      className="min-h-screen bg-[#faf8f3] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">{icon}</div>
        <h1 style={{ fontFamily: "'Fraunces', serif" }}
          className="text-2xl font-semibold text-[#1e3a5f] mb-2">{title}</h1>
        <p className="text-slate-500 text-sm mb-8">{description}</p>
        <button onClick={() => navigate('/')}
          className="px-6 py-2.5 rounded-lg bg-[#1e3a5f] text-white text-sm font-semibold hover:bg-[#142a44] transition">
          ← Rudi Nyumbani
        </button>
      </div>
    </div>
  );
}