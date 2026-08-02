import { useState, useEffect } from 'react';
import axios from 'axios';

import { NECTA_API as API } from '../../config/api';

export default function SubjectRankings({ level, year, region }) {
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams({ level, year });
    if (region) params.append('region', region);
    axios.get(`${API}/subjects/?${params}`).then(r => setSubjects(r.data.results));
  }, [level, year, region]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        Ufaulu wa Masomo {region ? `— ${region}` : '— Taifa'}
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left py-2 text-xs text-slate-500">Somo</th>
            <th className="text-center py-2 text-xs text-slate-500">GPA</th>
            <th className="text-center py-2 text-xs text-slate-500">Watahiniwa</th>
          </tr>
        </thead>
        <tbody>
          {subjects?.map(s => (
            <tr key={s.subject_name} className="border-b border-slate-50">
              <td className="py-2 font-medium">{s.subject_name}</td>
              <td className="py-2 text-center font-mono">{s.weighted_gpa}</td>
              <td className="py-2 text-center">{s.total_sat?.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}