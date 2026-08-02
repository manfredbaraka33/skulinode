export default function KPICards({ kpis }) {
  const cards = [
    { label: 'Shule Zilizochambuliwa', value: kpis.total_schools?.toLocaleString() },
    { label: 'Watahiniwa Waliofanya Mtihani', value: kpis.total_candidates_sat?.toLocaleString() },
    { label: 'Kiwango cha Kufaulu Taifa', value: `${kpis.national_pass_rate}%` },
    { label: 'GPA ya Taifa', value: kpis.national_weighted_gpa },
    { label: 'Kufaulu — Wavulana', value: `${kpis.national_pass_rate_male}%` },
    { label: 'Kufaulu — Wasichana', value: `${kpis.national_pass_rate_female}%` },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {cards.map(c => (
        <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 mb-1">{c.label}</div>
          <div className="text-2xl font-bold text-blue-700">{c.value ?? '—'}</div>
        </div>
      ))}
    </div>
  );
}