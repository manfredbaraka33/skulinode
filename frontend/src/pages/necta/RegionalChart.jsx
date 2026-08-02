import { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

import { NECTA_API as API } from '../../config/api';

export default function RegionalChart({ level, year, onSelectRegion }) {
  const [regions, setRegions] = useState([]);

  useEffect(() => {
    axios.get(`${API}/regions/?level=${level}&year=${year}`).then(r => setRegions(r.data.results));
  }, [level, year]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Ulinganisho wa Mikoa — GPA (chini ni bora)</h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={regions} layout="vertical" margin={{ left: 100 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" reversed domain={[1, 5]} />
          <YAxis type="category" dataKey="region" width={120} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="weighted_gpa" fill="#2563eb"
            onClick={(d) => onSelectRegion(d.region)} cursor="pointer" />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-400 mt-2">Bonyeza mkoa kuona shule zake</p>
    </div>
  );
}