import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { NECTA_API as API } from '../../config/api';
import { ArrowLeft } from 'lucide-react';

export default function SubjectProfile() {
  const { subjectName, level, year } = useParams();
  const [searchParams] = useSearchParams();
  const region = searchParams.get('region');
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams({ level, year });
    if (region) params.append('region', region);
    axios.get(`${API}/subject-profile/${subjectName}/?${params}`)
      .then(r => setData(r.data)).catch(() => setData(false));
  }, [subjectName, level, year, region]);

  if (data === false) return <div className="text-center py-16 text-slate-400">Somo halipatikani.</div>;
  if (!data) return <div className="text-center py-16 text-slate-400">Inapakia...</div>;

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="max-w-2xl mx-auto px-4 py-8 space-y-6">
       <center>
          <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#093a77] mb-6">
          <ArrowLeft size={15}/> Rudi kwenye dashibodi
        </button>
         </center>
      <div className="bg-gradient-to-br from-[#1e3a5f] to-[#142a44] rounded-2xl p-6 text-white text-center">
        <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-2xl font-semibold">{data.subject_name}</h1>
        <p className="text-blue-100 text-sm mt-1">
          {data.scope === 'regional' ? data.region : 'Kitaifa'} · {data.level} {data.year}
        </p>
        <div className="flex justify-center gap-6 mt-4">
          <div><div className="text-2xl font-bold">#{data.rank}</div><div className="text-xs opacity-80">Nafasi</div></div>
          <div><div className="text-2xl font-bold font-mono">{data.weighted_gpa}</div><div className="text-xs opacity-80">GPA</div></div>
          <div><div className="text-2xl font-bold">{data.total_sat}</div><div className="text-xs opacity-80">Watahiniwa</div></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Shule Bora Kwa Somo Hili</h3>
        <div className="space-y-1.5 max-h-100 overflow-y-auto">
          {data.top_schools.map(s => (
            <button key={s.center_id} onClick={() => navigate(`/necta/shule/${s.center_id}/${level}/${year}`)}
              className="w-full flex items-center justify-between text-sm py-2 border-b border-slate-50 last:border-0 hover:text-blue-600">
              <span>#{s.rank} {s.center_name} <span className="text-slate-400">({s.region})</span></span>
              <span className="font-mono font-semibold">{s.subject_gpa}</span>
            </button>
          ))}
        </div>
      </div>

      {data.regional_breakdown?.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Ufaulu kwa Mkoa</h3>
          <div className="space-y-1.5 max-h-100 overflow-y-auto">
            {data.regional_breakdown.map(r => (
              <button key={r.region} onClick={() => navigate(`/necta/somo/${subjectName}/${level}/${year}?region=${r.region}`)}
                className="w-full flex items-center justify-between text-sm py-2 border-b border-slate-50 last:border-0 hover:text-blue-600">
                <span>{r.region}</span>
                <span className="font-mono font-semibold">{r.weighted_gpa}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}