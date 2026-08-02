import { useState, useEffect } from 'react';
import axios from 'axios';

import { NECTA_API as API } from '../../config/api';

export default function GenderStory({ level, year }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    axios.get(`${API}/gender/?level=${level}&year=${year}`).then(r => setData(r.data));
  }, [level, year]);

  if (!data?.national) return null;

  const { pass_rate_male, pass_rate_female, leader, gap } = data.national;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-100 p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-1">Kina Nani Wanaongoza?</h2>
      <p className="text-sm text-slate-500 mb-4">Wavulana au Wasichana — takwimu za kitaifa</p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className={`rounded-xl p-4 text-center ${leader === 'MALE' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200'}`}>
          <div className="text-2xl font-bold">{pass_rate_male}%</div>
          <div className="text-xs mt-1 opacity-80">Wavulana</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${leader === 'FEMALE' ? 'bg-pink-600 text-white' : 'bg-white border border-slate-200'}`}>
          <div className="text-2xl font-bold">{pass_rate_female}%</div>
          <div className="text-xs mt-1 opacity-80">Wasichana</div>
        </div>
      </div>

      <p className="text-sm text-center text-slate-600 mb-4">
        <strong>{leader === 'MALE' ? 'Wavulana' : 'Wasichana'}</strong> wanaongoza kwa tofauti ya <strong>{gap}%</strong>
      </p>

      {data.by_region?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Mikoa yenye Tofauti Kubwa Zaidi
          </div>
          <div className="space-y-1.5">
            {data.by_region.slice(0, 5).map(r => (
              <div key={r.region} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">{r.region}</span>
                <span className={r.gap > 0 ? 'text-blue-600 font-semibold' : 'text-pink-600 font-semibold'}>
                  {r.gap > 0 ? `Wavulana +${r.gap}%` : `Wasichana +${Math.abs(r.gap)}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}