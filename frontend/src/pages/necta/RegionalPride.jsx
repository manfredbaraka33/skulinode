import { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://127.0.0.1:8000/api/public/necta';
const MEDALS = ['#1🥇', '#2🥈', '#3🥉'];

export default function RegionalPride({ level, year, onSelectRegion }) {
  const [regions, setRegions] = useState([]);

  useEffect(() => {
    axios.get(`${API}/regions/?level=${level}&year=${year}`).then(r => setRegions(r.data.results));
  }, [level, year]);

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-800 mb-1">Fahari ya Mikoa</h2>
      <p className="text-sm text-slate-500 mb-4">Mkoa wako uko wapi kitaifa?</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {regions.map((r, i) => (
          <button
            key={r.region}
            onClick={() => onSelectRegion(r.region)}
            className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3 hover:border-blue-300 hover:shadow-sm transition text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl w-8 text-center">
                {MEDALS[i] ?? `#${r.national_rank}`}
              </span>
              <div>
                <div className="font-semibold text-slate-800 text-sm">{r.region}</div>
                <div className="text-xs text-slate-400">Shule {r.school_count}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-blue-700">{r.weighted_gpa}</div>
              <div className="text-xs text-slate-400">GPA</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}