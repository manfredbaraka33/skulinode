import { useState, useEffect } from 'react';
import axios from 'axios';
import { TCU_API as API } from '../../config/api';

const CATEGORY_LABELS = {
  ELIMU: 'Elimu', AFYA: 'Afya na Sayansi ya Tiba', UHANDISI: 'Uhandisi na Teknolojia',
  BIASHARA: 'Biashara na Uchumi', SHERIA: 'Sheria', KILIMO: 'Kilimo na Mifugo',
  JAMII: 'Sayansi ya Jamii', SANAA: 'Sanaa na Ubunifu', TEHAMA: 'TEHAMA',
  UTAWALA: 'Utawala wa Umma', NYINGINE: 'Nyingine',
};

export default function TCUInsights({ cycleId }) {
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    if (!cycleId) return;
    axios.get(`${API}/insights/?cycle_id=${cycleId}`).then(r => setInsights(r.data));
  }, [cycleId]);

  if (!insights) return null;

  return (
    <div className="space-y-6">
      {/* National summary */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Programu Zilizochambuliwa" value={insights.total_programmes_analyzed} />
        <StatCard label="Wastani wa Pointi" value={insights.points_summary.national_avg} />
        <StatCard label="Pointi za Juu Zaidi" value={insights.points_summary.highest} />
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Kozi kwa Aina</h3>
        <div className="space-y-2">
          {insights.category_breakdown.map(c => (
            <div key={c.category} className="flex items-center justify-between">
              <span className="text-sm text-slate-700">{CATEGORY_LABELS[c.category] ?? c.category}</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#1e3a5f]" style={{ width: `${c.pct_of_total}%` }} />
                </div>
                <span className="text-xs text-slate-500 w-16 text-right">{c.programme_count} kozi</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hidden opportunities */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-100 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">💡 Fursa Zilizofichika</h3>
        <p className="text-xs text-slate-500 mb-4">Kozi bora zenye pointi za chini na nafasi nyingi</p>
        <div className="space-y-2">
          {insights.hidden_opportunities.slice(0, 5).map((p, i) => (
            <div key={i} className="bg-white rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-800">{p.programme_name}</div>
                <div className="text-xs text-slate-400">{p.institution__name}</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-green-700">{p.min_points_total}</div>
                <div className="text-xs text-slate-400">{p.capacity} nafasi</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Most competitive */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">🏆 Kozi Zenye Ushindani Mkubwa</h3>
        <p className="text-xs text-slate-500 mb-4">Pointi za juu zaidi zinazohitajika</p>
        <div className="space-y-2">
          {insights.most_competitive.slice(0, 5).map((p, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
              <div>
                <div className="text-sm text-slate-700">{p.programme_name}</div>
                <div className="text-xs text-slate-400">{p.institution__name}</div>
              </div>
              <div className="font-mono font-bold text-[#1e3a5f]">{p.min_points_total}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
      <div className="text-xl font-bold text-[#1e3a5f]">{value ?? '—'}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}