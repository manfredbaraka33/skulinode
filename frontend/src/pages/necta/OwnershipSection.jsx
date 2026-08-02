import { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://127.0.0.1:8000/api/public/necta';
const LABELS = { GOVERNMENT: 'Shule za Serikali', PRIVATE: 'Shule Binafsi', UNKNOWN: 'Haijathibitishwa' };

export default function OwnershipSection({ level, year }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    axios.get(`${API}/ownership/?level=${level}&year=${year}`).then(r => setData(r.data.results));
  }, [level, year]);

  const hasRealData = data.some(d => d.ownership_type !== 'UNKNOWN');

  if (!hasRealData) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-700">
        Uchambuzi wa Shule za Serikali dhidi ya Binafsi unakuja hivi karibuni.
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-800 mb-1">Serikali dhidi ya Binafsi</h2>
      <p className="text-sm text-slate-500 mb-4">Ni nani anayefanya vizuri zaidi?</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.filter(d => d.ownership_type !== 'UNKNOWN').map(d => (
          <div key={d.ownership_type} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-700 mb-2">{LABELS[d.ownership_type]}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-700">{d.weighted_gpa}</span>
              <span className="text-xs text-slate-400">GPA</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {d.school_count} shule · Kufaulu {d.pass_rate}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}