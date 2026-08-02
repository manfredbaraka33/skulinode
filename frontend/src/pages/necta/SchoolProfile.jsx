import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

import { NECTA_API as API } from '../../config/api';

export default function SchoolProfile() {
  const { centerId } = useParams();
  const [school, setSchool] = useState(null);

  useEffect(() => {
    axios.get(`${API}/school/${centerId}/?level=ACSEE&year=2026`).then(r => setSchool(r.data));
  }, [centerId]);

  if (!school) return <div className="text-center py-12 text-slate-400">Inapakia...</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-gradient-to-br from-blue-700 to-blue-500 rounded-2xl p-6 text-white text-center">
        <h1 className="text-xl font-bold">{school.center_name}</h1>
        <p className="text-blue-100 text-sm mt-1">{school.region}{school.district ? ` · ${school.district}` : ''}</p>

        <div className="flex justify-center gap-4 mt-4">
          <div className="bg-white/15 rounded-xl px-4 py-2">
            <div className="text-2xl font-bold">🥇 #{school.national_rank}</div>
            <div className="text-xs opacity-80">Taifa</div>
          </div>
          {school.regional_rank && (
            <div className="bg-white/15 rounded-xl px-4 py-2">
              <div className="text-2xl font-bold">#{school.regional_rank}</div>
              <div className="text-xs opacity-80">Mkoa</div>
            </div>
          )}
          {school.district_rank && (
            <div className="bg-white/15 rounded-xl px-4 py-2">
              <div className="text-2xl font-bold">#{school.district_rank}</div>
              <div className="text-xs opacity-80">Wilaya</div>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-6 mt-4">
          <div>
            <div className="text-2xl font-bold">{school.gpa}</div>
            <div className="text-xs opacity-80">GPA</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{school.pass_rate}%</div>
            <div className="text-xs opacity-80">Kufaulu</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Mgawanyo wa Madaraja</h3>
        <div className="grid grid-cols-5 gap-2 text-center">
          {['I', 'II', 'III', 'IV', '0'].map((div) => (
            <div key={div} className="bg-slate-50 rounded-lg py-2">
                <div className="font-bold text-slate-800">{school.divisions?.[div] ?? 0}</div>
                <div className="text-xs text-slate-400">Div {div}</div>
            </div>
            ))}
        
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Wavulana dhidi ya Wasichana</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center bg-blue-50 rounded-lg py-3">
            <div className="font-bold text-blue-700">{school.gender.pass_rate_male}%</div>
            <div className="text-xs text-slate-500">Wavulana ({school.gender.sat_male})</div>
          </div>
          <div className="text-center bg-pink-50 rounded-lg py-3">
            <div className="font-bold text-pink-700">{school.gender.pass_rate_female}%</div>
            <div className="text-xs text-slate-500">Wasichana ({school.gender.sat_female})</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Ufaulu wa Masomo</h3>
        <div className="space-y-1.5">
          {school.subjects.map(s => (
            <div key={s.subject_name} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
              <span className="text-slate-700">{s.subject_name}</span>
              <span className="font-mono font-semibold text-blue-700">{s.subject_gpa}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => window.print()}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm">
        Pakua / Chapisha Matokeo
      </button>
    </div>
  );
}