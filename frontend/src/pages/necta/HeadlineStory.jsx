export default function HeadlineStory({ kpis }) {
  const h = kpis.headlines || {};

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-sm">
      <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
        Habari Kuu
      </div>
      {h.best_region ? (
        <p className="text-lg md:text-xl font-bold text-slate-800 leading-snug">
          <span className="text-blue-700">{h.best_region.region}</span> inaongoza kitaifa
          na GPA ya <span className="text-green-600">{h.best_region.weighted_gpa}</span> na
          kiwango cha kufaulu cha <span className="text-green-600">{h.best_region.pass_rate}%</span>
        </p>
      ) : (
        <p className="text-slate-400">Takwimu za kina zinapatikana hapa chini.</p>
      )}
      <div className="flex flex-wrap justify-center gap-3 mt-4 text-xs">
        <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-600">
          {kpis.total_schools} Shule
        </span>
        <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-600">
          {kpis.total_candidates_sat?.toLocaleString()} Watahiniwa
        </span>
        <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-600">
          Kufaulu Taifa: {kpis.national_pass_rate}%
        </span>
      </div>
    </div>
  );
}