import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API = 'http://127.0.0.1:8000/api/necta';

export default function LandingPage() {
  const navigate = useNavigate();
  const [headline, setHeadline] = useState(null);

  useEffect(() => {
    fetch(`${API}/headlines/?level=ACSEE&year=2026`)
      .then(r => r.ok ? r.json() : null)
      .then(setHeadline)
      .catch(() => setHeadline(null));
  }, []);

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: 'var(--paper)' }}
      className="min-h-screen text-[#16233a]">
      <style>{`
        :root {
          --navy: #1e3a5f; --navy-deep: #142a44; --gold: #c4a014;
          --gold-soft: #e8d68a; --blue-mid: #2563eb; --paper: #faf8f3;
        }
        .font-display { font-family: 'Fraunces', serif; }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }

        @keyframes stampDrop {
          0%   { transform: translate(8px, -30px) rotate(-24deg) scale(1.4); opacity: 0; }
          60%  { transform: translate(8px, 4px) rotate(-11deg) scale(1.05); opacity: 1; }
          100% { transform: translate(8px, 0px) rotate(-12deg) scale(1); opacity: 1; }
        }
        .stamp-anim { animation: stampDrop 0.9s cubic-bezier(.2,.9,.3,1) 0.4s both; }
        @media (prefers-reduced-motion: reduce) {
          .stamp-anim { animation: none; opacity: 1; transform: rotate(-12deg); }
        }

        .perforated::before {
          content: '';
          position: absolute; top: -7px; left: 0; right: 0; height: 14px;
          background-image: radial-gradient(circle, var(--paper) 4px, transparent 4.5px);
          background-size: 20px 14px;
          background-repeat: repeat-x;
        }
        .ruled-lines {
          background-image: repeating-linear-gradient(
            to bottom, transparent, transparent 27px, #e2e8f0 27px, #e2e8f0 28px
          );
        }
        .card-lift { transition: transform .25s ease, box-shadow .25s ease; }
        .card-lift:hover { transform: translateY(-4px); box-shadow: 0 12px 28px -8px rgba(30,58,95,0.25); }
      `}</style>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-30 bg-[var(--paper)]/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--navy)] flex items-center justify-center">
              <span className="text-[var(--gold)] font-display font-bold text-sm">S</span>
            </div>
            <span className="font-display font-semibold text-lg text-[var(--navy)]">SkuliNode</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button onClick={() => navigate('/necta')} className="hover:text-[var(--navy)] transition">Matokeo ya NECTA</button>
            <button onClick={() => navigate('/past-papers')} className="hover:text-[var(--navy)] transition">Maswali ya Zamani</button>
            <button onClick={() => navigate('/tcu')} className="hover:text-[var(--navy)] transition">Kikokotoo cha TCU</button>
          </div>
          <button onClick={() => navigate('/login')}
            className="px-4 py-2 rounded-lg bg-[var(--navy)] text-white text-sm font-semibold hover:bg-[var(--navy-deep)] transition">
            Ingia →
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--navy)] to-[var(--navy-deep)]" />
        <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-[var(--gold-soft)] mb-4">
              Jukwaa la Elimu Tanzania
            </span>
            <h1 className="font-display text-3xl md:text-5xl font-semibold text-white leading-tight mb-5">
              Matokeo, Ripoti, na Fursa za Elimu — Mahali Pamoja
            </h1>
            <p className="text-blue-100 text-base md:text-lg mb-8 max-w-md">
              Kwa shule: usimamizi kamili wa alama na ripoti. Kwa wote: matokeo ya NECTA,
              maswali ya zamani, na zana za elimu — bila malipo.
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => navigate('/login')}
                className="px-6 py-3 rounded-xl bg-[var(--gold)] text-[var(--navy-deep)] font-bold text-sm hover:brightness-105 transition shadow-lg shadow-black/20">
                Ingia SkuliNode →
              </button>
              <button onClick={() => navigate('/necta')}
                className="px-6 py-3 rounded-xl border border-white/30 text-white font-semibold text-sm hover:bg-white/10 transition">
                Angalia Matokeo ya NECTA
              </button>
            </div>
          </div>

          {/* Signature: stamped result slip */}
          <div className="relative flex justify-center md:justify-end">
            <div className="relative perforated bg-white rounded-b-xl shadow-2xl w-72 pt-8 pb-6 px-6 ruled-lines">
              <div className="text-[10px] tracking-widest uppercase text-slate-400 font-semibold mb-1">Taarifa ya Matokeo</div>
              <div className="font-display font-semibold text-[var(--navy)] text-lg mb-4">Shule Yako Hapa</div>
              <div className="flex items-end gap-2 mb-1">
                <span className="font-mono font-semibold text-4xl text-[var(--navy)]">1.24</span>
                <span className="text-xs text-slate-400 mb-1">GPA</span>
              </div>
              <div className="flex gap-2 mt-4">
                <span className="text-[10px] font-mono bg-[var(--navy)]/5 text-[var(--navy)] px-2 py-1 rounded">#1 TAIFA</span>
                <span className="text-[10px] font-mono bg-[var(--navy)]/5 text-[var(--navy)] px-2 py-1 rounded">DIV I: 87</span>
              </div>

              {/* Stamp */}
              <div className="stamp-anim absolute -bottom-5 -right-4 w-24 h-24 rounded-full border-[3px] border-[var(--gold)]
                flex items-center justify-center text-center bg-white/90"
                style={{ transform: 'rotate(-12deg)' }}>
                <span className="font-mono text-[8px] font-bold text-[var(--gold)] leading-tight">
                  IMEIDHINISHWA<br/>NECTA · 2026
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Path chooser ── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="font-display text-2xl font-semibold text-[var(--navy)] text-center mb-2">
          Chagua Unachohitaji
        </h2>
        <p className="text-slate-500 text-center text-sm mb-10">Zana nne, watu wote wa elimu</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <PathCard
            icon="🏫" title="SkuliNode kwa Shule"
            desc="Ingia kusimamia alama, ripoti, na fedha za shule yako."
            action={() => navigate('/login')} cta="Ingia →" primary
          />
          <PathCard
            icon="📊" title="Matokeo ya NECTA"
            desc="Nafasi za shule, mikoa, na masomo — kitaifa hadi wilaya."
            action={() => navigate('/necta')} cta="Angalia Matokeo →"
          />
          <PathCard
            icon="📝" title="Maswali ya Zamani"
            desc="Maswali ya NECTA ya miaka iliyopita, kwa kila somo."
            comingSoon
          />
          <PathCard
            icon="🎓" title="Kikokotoo cha TCU"
            desc="Hesabu pointi zako na uone unastahili programu zipi."
            comingSoon
          />
        </div>
      </section>

      {/* ── NECTA teaser ── */}
      <section className="bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-14">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <span className="text-xs font-semibold tracking-widest uppercase text-[var(--blue-mid)]">Moja kwa Moja</span>
              <h3 className="font-display text-2xl font-semibold text-[var(--navy)] mt-2 mb-3">
                Matokeo ya ACSEE 2026 Sasa Yanapatikana
              </h3>
              {headline?.best_region ? (
                <p className="text-slate-600 text-sm mb-5">
                  <strong className="text-[var(--navy)]">{headline.best_region.region}</strong> inaongoza kitaifa
                  na GPA ya <strong>{headline.best_region.weighted_gpa}</strong>. Tazama nafasi ya shule yako,
                  mkoa wako, na somo unalopenda.
                </p>
              ) : (
                <p className="text-slate-600 text-sm mb-5">
                  Nafasi za shule kitaifa, kimkoa, na kiwilaya. Tazama mwenendo wa miaka, uchambuzi wa kijinsia,
                  na shule zilizojificha zilizofanya vizuri zaidi ya matarajio.
                </p>
              )}
              <button onClick={() => navigate('/necta')}
                className="px-5 py-2.5 rounded-lg bg-[var(--navy)] text-white text-sm font-semibold hover:bg-[var(--navy-deep)] transition">
                Fungua Matokeo →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Uchambuzi wa Mikoa" value="26+" />
              <MiniStat label="Nafasi za Wilaya" value="Ndiyo" />
              <MiniStat label="Uchambuzi wa Kijinsia" value="Ndiyo" />
              <MiniStat label="Shule Bora kwa Somo" value="Ndiyo" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Who it's for ── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="font-display text-2xl font-semibold text-[var(--navy)] text-center mb-10">
          Kwa Kila Mtu wa Elimu
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <AudienceCard icon="🎒" title="Wanafunzi" desc="Angalia matokeo, jitayarishe na maswali ya zamani." />
          <AudienceCard icon="👪" title="Wazazi" desc="Fuatilia matokeo na chagua shule kwa data halisi." />
          <AudienceCard icon="👩🏽‍🏫" title="Walimu" desc="Ingiza alama na tengeneze ripoti kwa dakika." />
          <AudienceCard icon="🏫" title="Shule" desc="Simamia masomo, fedha, na ripoti — kwa mfumo mmoja." />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[var(--navy-deep)] text-blue-100">
        <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
              <span className="text-[var(--gold)] font-display font-bold text-xs">S</span>
            </div>
            <span className="font-display font-semibold text-white">SkuliNode</span>
          </div>
          <div className="flex gap-6 text-sm">
            <button onClick={() => navigate('/necta')} className="hover:text-white transition">NECTA</button>
            <button onClick={() => navigate('/past-papers')} className="hover:text-white transition">Maswali</button>
            <button onClick={() => navigate('/tcu')} className="hover:text-white transition">TCU</button>
            <button onClick={() => navigate('/login')} className="hover:text-white transition">Ingia</button>
          </div>
          <p className="text-xs text-blue-300">© {new Date().getFullYear()} SkuliNode</p>
        </div>
      </footer>
    </div>
  );
}

function PathCard({ icon, title, desc, action, cta, primary, comingSoon }) {
  return (
    <div className={`card-lift rounded-2xl border p-5 flex flex-col ${
      primary ? 'bg-[var(--navy)] border-[var(--navy)] text-white' : 'bg-white border-slate-200'
    }`}>
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className={`font-display font-semibold mb-1.5 ${primary ? 'text-white' : 'text-[var(--navy)]'}`}>{title}</h3>
      <p className={`text-sm mb-4 flex-1 ${primary ? 'text-blue-100' : 'text-slate-500'}`}>{desc}</p>
      {comingSoon ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full w-fit">
          🕓 Inakuja Hivi Karibuni
        </span>
      ) : (
        <button onClick={action}
          className={`text-sm font-semibold text-left ${primary ? 'text-[var(--gold-soft)]' : 'text-[var(--blue-mid)]'} hover:underline`}>
          {cta}
        </button>
      )}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-center">
      <div className="font-mono font-semibold text-xl text-[var(--navy)]">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function AudienceCard({ icon, title, desc }) {
  return (
    <div className="text-center">
      <div className="w-14 h-14 mx-auto rounded-full bg-[var(--navy)]/5 flex items-center justify-center text-2xl mb-3">
        {icon}
      </div>
      <h4 className="font-display font-semibold text-[var(--navy)] text-sm mb-1">{title}</h4>
      <p className="text-xs text-slate-500">{desc}</p>
    </div>
  );
}