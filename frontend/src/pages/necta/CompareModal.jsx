import { useState, useEffect } from 'react';
import axios from 'axios';
import { NECTA_API as API } from '../../config/api';
import NectaModal from './NectaModal';
import { Search, X, Download, Plus } from 'lucide-react';

export default function CompareModal({ initialCenterId, level, year, onClose }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIds, setSelectedIds] = useState(initialCenterId ? [initialCenterId.toUpperCase()] : []);
  const [schools, setSchools] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [headToHeadUrl, setHeadToHeadUrl] = useState(null);
  const [loadingH2H, setLoadingH2H] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setSuggestions([]); return; }
    const t = setTimeout(() => {
      axios.get(`${API}/search/?q=${encodeURIComponent(query)}&level=${level}&year=${year}`)
        .then(r => setSuggestions(r.data.results));
    }, 300);
    return () => clearTimeout(t);
  }, [query, level, year]);

  useEffect(() => {
    if (selectedIds.length === 0) { setSchools([]); return; }
    axios.get(`${API}/compare/?level=${level}&year=${year}&centers=${selectedIds.join(',')}`)
      .then(r => setSchools(r.data.results));
  }, [selectedIds, level, year]);

  useEffect(() => {
  if (schools.length !== 2) { setHeadToHeadUrl(null); return; }
  setLoadingH2H(true);
  axios.get(
    `${API}/cards/head-to-head/?level=${level}&year=${year}&center_a=${schools[0].center_id}&center_b=${schools[1].center_id}`,
    { responseType: 'blob' }
  ).then(r => setHeadToHeadUrl(prev => {
    if (prev) window.URL.revokeObjectURL(prev);
    return window.URL.createObjectURL(new Blob([r.data]));
  })).finally(() => setLoadingH2H(false));
}, [schools, level, year]);


  function addSchool(id) {
    if (selectedIds.includes(id) || selectedIds.length >= 4) return;
    setSelectedIds(p => [...p, id]);
    setQuery(''); setSuggestions([]);
  }
  function removeSchool(id) {
    setSelectedIds(p => p.filter(x => x !== id));
  }

  async function downloadCompareCard() {
    if (selectedIds.length < 2) return;
    setDownloading(true);
    try {
      const r = await axios.get(`${API}/cards/compare/?level=${level}&year=${year}&centers=${selectedIds.join(',')}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url; a.download = 'ulinganisho.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 30000);
    } finally { setDownloading(false); }
  }

  return (
    <NectaModal title="Linganisha Shule" onClose={onClose} maxWidth="max-w-2xl">
      {selectedIds.length < 4 && (
        <div className="relative mb-4">
          <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2">
            <Search size={15} className="text-slate-400 mr-2"/>
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Ongeza shule ya kulinganisha..." className="flex-1 outline-none text-sm"/>
          </div>
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
              {suggestions.filter(s => !selectedIds.includes(s.center_id)).map(s => (
                <button key={s.center_id} onClick={() => addSchool(s.center_id)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 text-left text-sm">
                  <span>{s.center_name} <span className="text-slate-400">({s.region})</span></span>
                  <Plus size={14} className="text-blue-600"/>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {schools.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">Ongeza angalau shule mbili kulinganisha.</p>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 text-xs text-slate-500">Shule</th>
                  <th className="text-center py-2 text-xs text-slate-500">GPA</th>
                  <th className="text-center py-2 text-xs text-slate-500">Taifa</th>
                  <th className="text-center py-2 text-xs text-slate-500">Kufaulu</th>
                  <th className="text-center py-2 text-xs text-slate-500">Wavulana</th>
                  <th className="text-center py-2 text-xs text-slate-500">Wasichana</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {schools.map(s => (
                  <tr key={s.center_id} className="border-b border-slate-50">
                    <td className="py-2 font-medium">{s.center_name}<div className="text-xs text-slate-400">{s.region}</div></td>
                    <td className="py-2 text-center font-mono font-semibold text-blue-700">{s.gpa}</td>
                    <td className="py-2 text-center">#{s.national_rank}</td>
                    <td className="py-2 text-center">{s.pass_rate}%</td>
                    <td className="py-2 text-center text-blue-600">{s.pass_rate_male}%</td>
                    <td className="py-2 text-center text-pink-600">{s.pass_rate_female}%</td>
                    <td><button onClick={() => removeSchool(s.center_id)} className="text-slate-300 hover:text-red-500"><X size={14}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {schools.length === 2 && (
          <div className="border-t border-slate-200 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Linganisha Moja kwa Moja</h3>
            {loadingH2H ? (
              <div className="text-center py-8 text-slate-400 text-sm">Inatengeneza kadi...</div>
            ) : headToHeadUrl ? (
              <div className="space-y-3">
                <img src={headToHeadUrl} alt="Head to Head" className="w-full rounded-xl border border-slate-200" />
                <a href={headToHeadUrl} download={`h2h_${schools[0].center_id}_vs_${schools[1].center_id}.png`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#c4a014] text-[#142a44] rounded-lg text-sm font-bold">
                  <Download size={15}/> Pakua Kadi ya Head-to-Head
                </a>
              </div>
            ) : null}
          </div>
        )}

          <button onClick={downloadCompareCard} disabled={downloading || schools.length < 2}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1e3a5f] text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            <Download size={15}/> {downloading ? 'Inapakua...' : 'Pakua Kadi ya Ulinganisho'}
          </button>
        </div>
      )}
    </NectaModal>
  );
}