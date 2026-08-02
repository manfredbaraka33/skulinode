import { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://127.0.0.1:8000/api/public/necta';

export default function HiddenGems({ level, year }) {
  const [gems, setGems] = useState([]);

  useEffect(() => {
    axios.get(`${API}/hidden-gems/?level=${level}&year=${year}`).then(r => setGems(r.data.results));
  }, [level, year]);

  if (gems.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-800 mb-1">Vito Vilivyofichika 💎</h2>
      <p className="text-sm text-slate-500 mb-4">Shule ndogo zilizowashinda wote</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {gems.slice(0, 6).map(g => (
          <div key={g.center_id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-800 text-sm">{g.center_name}</div>
              <div className="text-xs text-slate-400">{g.region} · Watahiniwa {g.sat_total}</div>
            </div>
            <div className="text-right">
              <div className="font-bold text-green-600">{g.center_gpa}</div>
              <div className="text-xs text-slate-400">#{g.national_rank} taifa</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}