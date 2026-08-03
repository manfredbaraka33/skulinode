import { useState, useEffect } from 'react';
import axios from 'axios';
import { NECTA_API as API } from '../../config/api';
import NectaModal from './NectaModal';
import { Download, ChevronRight } from 'lucide-react';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function RegionalPride({ level, year, onSelectRegion }) {
  const [regions, setRegions] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState(null);
  const [topSchools, setTopSchools] = useState([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    axios.get(`${API}/regions/?level=${level}&year=${year}`).then(r => setRegions(r.data.results));
  }, [level, year]);

  async function openRegion(region) {
    setSelected(region);
    const r = await axios.get(`${API}/rankings/?level=${level}&year=${year}&region=${region.region}&page_size=5`);
    setTopSchools(r.data.results);
  }

  async function downloadCard(regionName) {
    setDownloading(true);
    try {
      const r = await axios.get(`${API}/cards/region/${regionName}/?level=${level}&year=${year}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `${regionName}_matokeo.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 30000);
    } finally { setDownloading(false); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-slate-800">Fahari ya Mikoa</h2>
        <button onClick={() => setShowAll(true)} className="text-sm text-blue-600 font-medium flex items-center gap-1">
          Ona Mikoa Yote <ChevronRight size={14}/>
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-4">Mkoa wako uko wapi kitaifa?</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {regions.slice(0, 6).map((r, i) => (
          <button key={r.region} onClick={() => openRegion(r)}
            className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3 hover:border-blue-300 hover:shadow-sm transition text-left">
            <div className="flex items-center gap-3">
              <span className="text-xl w-8 text-center">{MEDALS[i] ?? `#${r.national_rank}`}</span>
              <div>
                <div className="font-semibold text-slate-800 text-sm">{r.region}</div>
                <div className="text-xs text-slate-400">{r.school_count} shule</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-blue-700">{r.weighted_gpa}</div>
              <div className="text-xs text-slate-400">GPA</div>
            </div>
          </button>
        ))}
      </div>

      {showAll && (
        <NectaModal title="Mikoa Yote — Nafasi Kamili" onClose={() => setShowAll(false)}>
          <div className="space-y-1.5">
            {regions.map((r, i) => (
              <button key={r.region} onClick={() => { setShowAll(false); openRegion(r); }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-blue-50 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center font-bold text-slate-400">{i < 3 ? MEDALS[i] : `#${r.national_rank}`}</span>
                  <span className="font-medium text-slate-800 text-sm">{r.region}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-mono font-semibold text-blue-700">{r.weighted_gpa}</span>
                  <span className="text-slate-400 text-xs">{r.pass_rate}%</span>
                  <span className="text-slate-400 text-xs">{r.school_count} shule</span>
                </div>
              </button>
            ))}
          </div>
        </NectaModal>
      )}

      {selected && (
        <NectaModal title={selected.region} onClose={() => setSelected(null)} maxWidth="max-w-md">
          <div className="text-center mb-5">
            <div className="inline-block bg-[#1e3a5f] text-white rounded-xl px-6 py-3 mb-3">
              <div className="font-bold text-lg" style={{ color: '#c4a014' }}>Nafasi ya {selected.national_rank} Kitaifa</div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-2xl font-mono font-bold text-[#1e3a5f]">{selected.weighted_gpa}</div>
                <div className="text-xs text-slate-500 mt-1">GPA</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-2xl font-mono font-bold text-green-600">{selected.pass_rate}%</div>
                <div className="text-xs text-slate-500 mt-1">Kufaulu</div>
              </div>
            </div>
          </div>

          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Shule Bora Mkoa Huu</div>
          <div className="space-y-1.5 mb-5">
            {topSchools.map((s, i) => (
              <div key={s.center_id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                <span className="text-slate-700">{i + 1}. {s.center_name}</span>
                <span className="font-mono font-semibold text-blue-700">{s.gpa}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={() => downloadCard(selected.region)} disabled={downloading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1e3a5f] text-white rounded-lg text-sm font-semibold disabled:opacity-50">
              <Download size={15}/> {downloading ? 'Inapakua...' : 'Pakua Kadi'}
            </button>
            <button onClick={() => { onSelectRegion(selected.region); setSelected(null); }}
              className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600">
              Ona Shule Zote
            </button>
          </div>
        </NectaModal>
      )}
    </div>
  );
}