import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { NECTA_API as API } from '../../config/api';
import { Download, ExternalLink, TrendingUp, Users2,Link2 } from 'lucide-react';
import CompareModal from './CompareModal';
import { Helmet } from 'react-helmet-async';

export default function SchoolProfile() {
  const { centerId } = useParams();
  const { year } = useParams();
  const { level } = useParams();
  const [school, setSchool] = useState(null);
  const [trend, setTrend] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  const [downloadingSubjects, setDownloadingSubjects] = useState(false);
const [downloadingTrend, setDownloadingTrend] = useState(false);

function downloadSubjectsCard() {
  setDownloadingSubjects(true);
  axios.get(`${API}/cards/subjects/${centerId}/?level=${level}&year=${year}`, { responseType: 'blob' })
    .then(r => {
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `${centerId}_masomo.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 30000);
    }).finally(() => setDownloadingSubjects(false));
}

function downloadTrendCard() {
  setDownloadingTrend(true);
  axios.get(`${API}/cards/trend/${centerId}/?level=${level}`, { responseType: 'blob' })
    .then(r => {
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `${centerId}_mwenendo.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 30000);
    }).finally(() => setDownloadingTrend(false));
}

  const [copied, setCopied] = useState(false);
  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    axios.get(`${API}/school/${centerId}/?level=${level}&year=${year}`).then(r => setSchool(r.data));
    axios.get(`${API}/trend/school/${centerId}/?level=${level}`).then(r => setTrend(r.data));
  }, [centerId]);

  async function downloadCard() {
    setDownloading(true);
    try {
      const r = await axios.get(`${API}/cards/school/${centerId}/?level=${level}&year=${year}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `${centerId}_matokeo.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 30000);
    } finally { setDownloading(false); }
  }

  if (!school) return <div className="text-center py-12 text-slate-400">Inapakia...</div>;

  const D = school.divisions;
  const gradedTotal = D.I + D.II + D.III + D.IV + D['0'];

  <Helmet>
  <title>{school.center_name} — Matokeo ya NECTA {school.region} | SkuliNode</title>
  <meta name="description" content={`${school.center_name}, ${school.region}. GPA: ${school.gpa}. Nafasi ya ${school.national_rank} Kitaifa. Kufaulu: ${school.pass_rate}%.`} />
  </Helmet>

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="bg-gradient-to-br from-[#1e3a5f] to-[#142a44] rounded-2xl p-6 text-white text-center">
        <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-xl font-semibold">{school.center_name}</h1>
        <p className="text-blue-100 text-sm mt-1">{school.region}{school.district ? ` · ${school.district}` : ''}</p>
        <p className="text-blue-200 text-xs mt-0.5">{school.exam_level} {school.year}</p>
        <div className="flex justify-center flex-wrap gap-3 mt-4">
          <div className="bg-white/15 rounded-xl px-4 py-2">
            <div className="text-2xl font-bold">{school.national_rank === 1 ? '🥇' : `#${school.national_rank}`}</div>
            <div className="text-xs opacity-80">Taifa</div>
          </div>
          {school.regional_rank && (
            <div className="bg-white/15 rounded-xl px-4 py-2">
              <div className="text-2xl font-bold">#{school.regional_rank}</div>
              <div className="text-xs opacity-80">Mkoa</div>
            </div>
          )}
          {school.district_rank && (
            <div className="bg-white/15 rounded-xl px-4 py-2">
              <div className="text-2xl font-bold">#{school.district_rank}</div>
              <div className="text-xs opacity-80">Wilaya</div>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-6 mt-4">
          <div>
            <div className="text-2xl font-bold font-mono">{school.gpa}</div>
            <div className="text-xs opacity-80">GPA {school.grade_label ? `· ${school.grade_label}` : ''}</div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono">{school.pass_rate}%</div>
            <div className="text-xs opacity-80">Kufaulu</div>
          </div>
        </div>

        <div className="flex justify-center gap-2 mt-5">
          <button onClick={downloadCard} disabled={downloading}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#c4a014] text-[#142a44] rounded-lg text-sm font-bold disabled:opacity-50">
            <Download size={15}/> {downloading ? 'Inapakua...' : 'Pakua Kadi'}
          </button>
          <button onClick={() => setShowCompare(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/15 text-white rounded-lg text-sm font-semibold">
            <Users2 size={15}/> Linganisha
          </button>
        </div>
          <button onClick={copyLink}
            className="mt-3 flex items-center gap-1.5 mx-auto px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-full transition">
            <Link2 size={13}/> {copied ? 'Kiungo Kimenakiliwa! ✓' : 'Nakili Kiungo'}
          </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Takwimu za Watahiniwa</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Waliosajili" value={school.registered_total} />
          <Stat label="Waliofanya Mtihani" value={school.sat_total} />
          <Stat label="Wasiohudhuria" value={school.absent_total} />
          <Stat label="Waliozuiliwa" value={school.withheld_total} />
          <Stat label="Waliopimwa Safi" value={school.clean_total} />
          <Stat label="Waliopata Daraja" value={school.graded_total} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Mgawanyo wa Madaraja</h3>
        <div className="grid grid-cols-5 gap-2 text-center mb-2">
          {['I','II','III','IV','0'].map(div => (
            <div key={div} className="bg-slate-50 rounded-lg py-2">
              <div className="font-bold text-slate-800">{D[div]}</div>
              <div className="text-xs text-slate-400">Div {div}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">Div I ni {gradedTotal ? Math.round(D.I / gradedTotal * 100) : 0}% ya waliopimwa</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Wavulana dhidi ya Wasichana</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center bg-blue-50 rounded-lg py-3">
            <div className="font-bold text-blue-700">{school.gender.pass_rate_male}%</div>
            <div className="text-xs text-slate-500">Wavulana ({school.gender.sat_male})</div>
          </div>
          <div className="text-center bg-pink-50 rounded-lg py-3">
            <div className="font-bold text-pink-700">{school.gender.pass_rate_female}%</div>
            <div className="text-xs text-slate-500">Wasichana ({school.gender.sat_female})</div>
          </div>
        </div>
      </div>

      {/* <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Ufaulu wa Masomo</h3>
        <div className="space-y-2">
          {school.subjects.map(s => (
            <div key={s.subject_name} className="flex items-center justify-between text-sm py-2 border-b border-slate-50 last:border-0">
              <div>
                <div className="text-slate-700 font-medium">{s.subject_name}</div>
                <div className="text-xs text-slate-400">
                  Waliosajili {s.registered} · Waliofanya {s.sat}
                  {s.dropout_rate ? ` · Kutokuhudhuria ${s.dropout_rate}%` : ''}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-semibold text-blue-700">{s.subject_gpa}</div>
                {s.national_subject_rank && (
                  <div className="text-xs text-amber-600">#{s.national_subject_rank} kitaifa</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div> */}



      <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Ufaulu wa Masomo</h3>
        <button onClick={downloadSubjectsCard} disabled={downloadingSubjects}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#1e3a5f] border border-[#1e3a5f]/20 rounded-lg px-3 py-1.5 hover:bg-[#1e3a5f]/5 disabled:opacity-50">
          <Download size={13}/> {downloadingSubjects ? 'Inapakua...' : 'Pakua Kadi'}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {school.subjects.map(s => (
          <div key={s.subject_name} className="border border-slate-100 rounded-xl p-3 hover:border-blue-200 transition">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">{s.subject_name}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Waliosajili {s.registered} · Waliofanya {s.sat}
                  {s.dropout_rate ? ` · Kutokuhudhuria ${s.dropout_rate}%` : ''}
                </div>
                {s.national_subject_rank && (
                  <div className="text-xs mt-1">
                    {s.national_subject_rank <= 3 ? (
                      <span className="text-amber-600 font-semibold">
                        {['🥇','🥈','🥉'][s.national_subject_rank - 1]} #{s.national_subject_rank} Kitaifa
                      </span>
                    ) : (
                      <span className="text-slate-400">#{s.national_subject_rank} Kitaifa</span>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono font-bold text-lg text-blue-700">{s.subject_gpa}</div>
                <div className="text-xs text-slate-400">GPA</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>


      {/* <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <TrendingUp size={16}/> Mwenendo wa Miaka
        </h3>
        {trend?.points?.length > 1 ? (
          <div className="space-y-2">
            {trend.points.map(p => (
              <div key={p.year} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                <span className="text-slate-600">{p.year}</span>
                <span className="font-mono font-semibold text-[#1e3a5f]">GPA {p.gpa}</span>
                <span className="text-xs text-slate-400">#{p.national_rank} taifa</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Takwimu za mwaka mmoja tu zinapatikana kwa sasa. Mwenendo utaonekana miaka ijayo inapoongezwa.
          </p>
        )}
      </div> */}

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <TrendingUp size={16}/> Mwenendo wa Miaka
        </h3>
        {trend?.points?.length > 1 && (
          <button onClick={downloadTrendCard} disabled={downloadingTrend}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#1e3a5f] border border-[#1e3a5f]/20 rounded-lg px-3 py-1.5 hover:bg-[#1e3a5f]/5 disabled:opacity-50">
            <Download size={13}/> {downloadingTrend ? 'Inapakua...' : 'Pakua Kadi'}
          </button>
        )}
      </div>
      {trend?.points?.length > 1 ? (
        <div className="space-y-2">
          {trend.points.map((p, i) => {
            const prev = trend.points[i - 1];
            const improved = prev && p.gpa < prev.gpa;
            const worsened = prev && p.gpa > prev.gpa;
            return (
              <div key={p.year} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-700 w-14">{p.year}</span>
                  {prev && (
                    <span className={improved ? 'text-green-600' : worsened ? 'text-red-500' : 'text-slate-400'}>
                      {improved ? '📈' : worsened ? '📉' : '➡️'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-mono font-bold text-[#1e3a5f]">GPA {p.gpa}</div>
                    <div className="text-xs text-slate-400">#{p.national_rank} taifa</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          Takwimu za mwaka mmoja tu zinapatikana kwa sasa. Mwenendo utaonekana miaka ijayo inapoongezwa.
        </p>
      )}
    </div>

      {school.necta_source_url && (
        <a href={school.necta_source_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm font-semibold text-slate-500 hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition">
          <ExternalLink size={15}/> Ona Ukurasa Rasmi wa NECTA
        </a>
      )}

      {showCompare && (
        <CompareModal initialCenterId={centerId} level="ACSEE" year="2026" onClose={() => setShowCompare(false)} />
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="font-bold text-slate-800">{value ?? '—'}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}