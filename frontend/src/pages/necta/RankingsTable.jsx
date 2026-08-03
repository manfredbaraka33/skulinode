import { useState, useEffect } from 'react';
import axios from 'axios';
import { NECTA_API as API } from '../../config/api';
import { SlidersHorizontal, X } from 'lucide-react';

export default function RankingsTable({ level, year, region, district, onRegionChange, onDistrictChange }) {
  const [data, setData] = useState(null);
  const [allRegions, setAllRegions] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('gpa');
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    axios.get(`${API}/regions/?level=${level}&year=${year}`).then(r => setAllRegions(r.data.results));
  }, [level, year]);

  useEffect(() => {
    if (!region) { setDistricts([]); return; }
    axios.get(`${API}/districts/?level=${level}&year=${year}&region=${region}`).then(r => setDistricts(r.data.results));
  }, [level, year, region]);

  useEffect(() => {
    const params = new URLSearchParams({ level, year, page, sort, page_size: 50 });
    if (region) params.append('region', region);
    if (district) params.append('district', district);
    axios.get(`${API}/rankings/?${params}`).then(r => setData(r.data));
  }, [level, year, region, district, page, sort]);

  if (!data) return <div className="text-slate-400 text-sm">Inapakia...</div>;

  const activeFilterCount = (region ? 1 : 0) + (district ? 1 : 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-wrap gap-2">
        <h2 className="text-lg font-bold text-slate-800">
          Orodha Kamili — {data.scope === 'district' ? `${district}, ${region}` : data.scope === 'regional' ? region : 'Taifa'}
          <span className="text-slate-400 font-normal text-sm ml-2">({data.total})</span>
        </h2>
        <button onClick={() => setShowFilter(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 relative">
          <SlidersHorizontal size={15}/> Chuja
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {showFilter && (
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Mkoa</label>
            <select value={region} onChange={e => { onRegionChange(e.target.value); onDistrictChange(''); setPage(1); }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 min-w-40">
              <option value="">Mikoa Yote</option>
              {allRegions.map(r => <option key={r.region} value={r.region}>{r.region}</option>)}
            </select>
          </div>
          {region && districts.length > 0 && (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Wilaya</label>
              <select value={district} onChange={e => { onDistrictChange(e.target.value); setPage(1); }}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 min-w-40">
                <option value="">Wilaya Zote</option>
                {districts.map(d => <option key={d.district} value={d.district}>{d.district}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Panga kwa</label>
            <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2">
              <option value="gpa">GPA (Bora Kwanza)</option>
              <option value="pass_rate">Kufaulu (Juu Kwanza)</option>
              <option value="name">Jina la Shule</option>
            </select>
          </div>
          {activeFilterCount > 0 && (
            <button onClick={() => { onRegionChange(''); onDistrictChange(''); setPage(1); }}
              className="flex items-center gap-1 text-xs text-red-500 font-medium px-2 py-2">
              <X size={13}/> Futa Vichujio
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2 text-xs text-slate-500">Nafasi</th>
              <th className="text-left px-4 py-2 text-xs text-slate-500">Shule</th>
              <th className="text-left px-4 py-2 text-xs text-slate-500">Mkoa</th>
              <th className="text-left px-4 py-2 text-xs text-slate-500">Wilaya</th>
              <th className="text-center px-4 py-2 text-xs text-slate-500">GPA</th>
              <th className="text-center px-4 py-2 text-xs text-slate-500">Kufaulu</th>
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