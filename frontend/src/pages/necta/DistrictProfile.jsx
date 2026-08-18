import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { NECTA_API as API } from '../../config/api';
import { ArrowLeft } from 'lucide-react';

export default function DistrictProfile() {
  const { region, district, level, year } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    axios.get(`${API}/district-profile/${region}/${district}/?level=${level}&year=${year}`)
      .then(r => setData(r.data)).catch(() => setData(false));
  }, [region, district, level, year]);

  if (data === false) return <div className="text-center py-16 text-slate-400">Wilaya haipatikani kwa mwaka huu.</div>;
  if (!data) return <div className="text-center py-16 text-slate-400">Inapakia...</div>;

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="max-w-2xl mx-auto px-4 py-8 space-y-6">
       <center>
          <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#093a77] mb-6">
          <ArrowLeft size={15}/> Rudi Mkoani
        </button>
         </center>
      <div className="bg-gradient-to-br from-[#1e3a5f] to-[#142a44] rounded-2xl p-6 text-white text-center">
        <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-2xl font-semibold">{data.district}</h1>
        <p className="text-blue-100 text-sm mt-1">{data.region} · {data.level} {data.year}</p>
        <div className="flex justify-center gap-6 mt-4">
          <div><div className="text-2xl font-bold">#{data.national_rank}</div><div className="text-xs opacity-80">Taifa</div></div>
          <div><div className="text-2xl font-bold font-mono">{data.weighted_gpa}</div><div className="text-xs opacity-80">GPA</div></div>
          <div><div className="text-2xl font-bold font-mono">{data.pass_rate}%</div><div className="text-xs opacity-80">Kufaulu</div></div>
        </div>
      </div>

      {data.gender.pass_rate_male != null && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Wavulana dhidi ya Wasichana</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center bg-blue-50 rounded-lg py-3">
              <div className="font-bold text-blue-700">{data.gender.pass_rate_male}%</div><div className="text-xs text-slate-500">Wavulana</div>
            </div>
            <div className="text-center bg-pink-50 rounded-lg py-3">
              <div className="font-bold text-pink-700">{data.gender.pass_rate_female}%</div><div className="text-xs text-slate-500">Wasichana</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Shule Zote Wilayani</h3>
        <div className="space-y-1.5">
          {data.top_schools.map((s, i) => (
            <button key={s.center_id} onClick={() => navigate(`/necta/shule/${s.center_id}/${level}/${year}`)}
              className="w-full flex items-center justify-between text-sm py-2 border-b border-slate-50 last:border-0 hover:text-blue-600">
              <span>{i + 1}. {s.center_name}</span>
              <span className="font-mono font-semibold">{s.center_gpa}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}