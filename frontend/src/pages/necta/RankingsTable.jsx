import { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://127.0.0.1:8000/api/public/necta';

export default function RankingsTable({ level, year, region, district, onRegionChange, onDistrictChange }) {
  const [data, setData] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!region) { setDistricts([]); return; }
    axios.get(`${API}/districts/?level=${level}&year=${year}&region=${region}`)
      .then(r => setDistricts(r.data.results));
  }, [level, year, region]);

  useEffect(() => {
    const params = new URLSearchParams({ level, year, page, page_size: 50 });
    if (region) params.append('region', region);
    if (district) params.append('district', district);
    axios.get(`${API}/rankings/?${params}`).then(r => setData(r.data));
  }, [level, year, region, district, page]);

  if (!data) return <div className="text-slate-400 text-sm">Inapakia...</div>;

  return (
    <div className="bg-white rounded-2xl border border-slate-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-wrap gap-2 ">
        <h2 className="text-lg font-bold text-slate-800">
          Orodha Kamili — {data.scope === 'district' ? `${district}, ${region}` : data.scope === 'regional' ? region : 'Taifa'}
        </h2>
        <div className="flex items-center gap-2">
          {region && districts.length > 0 && (
            <select value={district} onChange={e => { onDistrictChange(e.target.value); setPage(1); }}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
              <option value="">Wilaya zote</option>
              {districts.map(d => <option key={d.district} value={d.district}>{d.district}</option>)}
            </select>
          )}
          {region && (
            <button onClick={() => { onRegionChange(''); onDistrictChange(''); setPage(1); }}
              className="text-xs text-blue-600">← Taifa Lote</button>
          )}
        </div>
      </div>
      <div className='overflow-x-auto max-h-120'>
          <table className="w-full text-sm overflow-x-auto">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-2 text-xs text-slate-500 sticky top-0">Nafasi</th>
            <th className="text-left px-4 py-2 text-xs text-slate-500 sticky top-0">Shule</th>
            <th className="text-left px-4 py-2 text-xs text-slate-500 sticky top-0">Mkoa</th>
            <th className="text-left px-4 py-2 text-xs text-slate-500 sticky top-0">Wilaya</th>
            <th className="text-center px-4 py-2 text-xs text-slate-500 sticky top-0">GPA</th>
            <th className="text-center px-4 py-2 text-xs text-slate-500 sticky top-0">Kufaulu</th>
          </tr>
        </thead>
        <tbody>
          {data.results.map(r => (
            <tr key={r.center_id} className="border-b border-slate-50 hover:bg-blue-50 cursor-pointer">
              <td className="px-4 py-2 font-bold text-slate-500">#{r.rank}</td>
              <td className="px-4 py-2 font-medium">
                <a href={`/necta/shule/${r.center_id}`} className="hover:text-blue-600">{r.center_name}</a>
              </td>
              <td className="px-4 py-2 text-slate-500">{r.region}</td>
              <td className="px-4 py-2 text-slate-500">{r.district}</td>
              <td className="px-4 py-2 text-center font-mono font-semibold text-blue-700">{r.gpa}</td>
              <td className="px-4 py-2 text-center">{r.pass_rate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="flex justify-center gap-2 py-3">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
          className="px-3 py-1 text-xs border rounded disabled:opacity-40">Nyuma</button>
        <span className="text-xs text-slate-500">Ukurasa {data.page} / {data.total_pages}</span>
        <button disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)}
          className="px-3 py-1 text-xs border rounded disabled:opacity-40">Mbele</button>
      </div>
    </div>
  );
}