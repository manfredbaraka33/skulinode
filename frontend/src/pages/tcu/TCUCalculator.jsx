import { useState, useEffect } from 'react';
import axios from 'axios';

const API = (() => {
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  return isLocal ? 'http://127.0.0.1:8000/api/tcu' : 'https://skulinode.co.tz/api/tcu';
})();

const COHORTS = [
  { value: '2016_ONWARDS', label: '2016 na kuendelea' },
  { value: '2014_2015',    label: '2014 - 2015' },
  { value: 'PRE_2014',     label: 'Kabla ya 2014' },
];

const GRADES = ['A', 'B', 'C', 'D', 'E', 'S', 'F'];

const COMMON_SUBJECTS = [
  'History', 'Geography', 'English Language', 'Literature in English', 'Kiswahili',
  'Kiislam', 'Kikristo', 'Arabic', 'French', 'Fine Arts', 'Economics', 'Commerce',
  'Accountancy', 'Physics', 'Chemistry', 'Biology', 'Advanced Mathematics',
  'Basic Applied Mathematics', 'Agriculture', 'Computer Science', 'Nutrition',
  'General Studies',
];

export default function TCUCalculator() {
  const [cycles, setCycles] = useState([]);
  const [cycleId, setCycleId] = useState(null);
  const [cohort, setCohort] = useState('2016_ONWARDS');
  const [subjects, setSubjects] = useState([{ subject: '', grade: '' }]);
  const [region, setRegion] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API}/cycles/`).then(r => {
      setCycles(r.data);
      if (r.data.length > 0) setCycleId(r.data[0].id);
    });
  }, []);

  function addSubjectRow() {
    if (subjects.length >= 6) return;
    setSubjects(p => [...p, { subject: '', grade: '' }]);
  }
  function removeSubjectRow(i) {
    setSubjects(p => p.filter((_, idx) => idx !== i));
  }
  function updateSubject(i, field, value) {
    setSubjects(p => p.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }

  async function calculate() {
    setError('');
    const valid = subjects.filter(s => s.subject && s.grade);
    if (valid.length < 2) {
      setError('Ingiza angalau masomo mawili yenye madaraja.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await axios.post(`${API}/calculate/`, {
        cycle_id: cycleId, cohort, subjects: valid,
        region: region || undefined,
      });
      setResult(r.data);
    } catch (e) {
      setError(e.response?.data?.error ?? 'Imeshindwa kuhesabu. Jaribu tena.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="min-h-screen bg-[#faf8f3]">
      <div className="bg-gradient-to-br from-[#1e3a5f] to-[#142a44] px-4 py-12 text-center">
        <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-3xl font-semibold text-white mb-2">
          Kikokotoo cha TCU
        </h1>
        <p className="text-blue-100 text-sm">
          Hesabu pointi zako na uone programu unazostahili — kutoka Mwongozo Rasmi wa TCU
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Cohort + region */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Ulimaliza Kidato cha Sita Lini?</label>
            <select value={cohort} onChange={e => setCohort(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              {COHORTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Mkoa / Eneo (hiari)</label>
            <input value={region} onChange={e => setRegion(e.target.value)}
              placeholder="e.g. Dar es Salaam"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
          </div>
        </div>

        {/* Subjects */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Masomo Yako ya Kidato cha Sita</h3>
          <div className="space-y-2">
            {subjects.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input list="subject-options" value={s.subject}
                  onChange={e => updateSubject(i, 'subject', e.target.value)}
                  placeholder="Somo (e.g. Physics)"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
                <select value={s.grade} onChange={e => updateSubject(i, 'grade', e.target.value)}
                  className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Daraja</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                {subjects.length > 1 && (
                  <button onClick={() => removeSubjectRow(i)} className="text-slate-300 hover:text-red-500 px-2">×</button>
                )}
              </div>
            ))}
          </div>
          <datalist id="subject-options">
            {COMMON_SUBJECTS.map(s => <option key={s} value={s}/>)}
          </datalist>
          {subjects.length < 6 && (
            <button onClick={addSubjectRow} className="mt-3 text-sm text-blue-600 font-medium">
              + Ongeza Somo
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        <button onClick={calculate} disabled={loading}
          className="w-full py-3 bg-[#c4a014] text-[#142a44] rounded-xl font-bold text-sm disabled:opacity-50">
          {loading ? 'Inahesabu...' : 'Hesabu Pointi Zangu'}
        </button>

        {result && <Results result={result} />}
      </div>
    </div>
  );
}

// function Results({ result }) {
//   const [tab, setTab] = useState('eligible');

//   return (
//     <div>
//       <div className="grid grid-cols-2 gap-3 mb-5">
//         <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
//           <div className="text-2xl font-bold text-green-700">{result.eligible_count}</div>
//           <div className="text-xs text-slate-600 mt-1">Programu Unazostahili</div>
//         </div>
//         <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
//           <div className="text-2xl font-bold text-amber-700">{result.close_miss_count}</div>
//           <div className="text-xs text-slate-600 mt-1">Karibu Kufikia (chini kidogo)</div>
//         </div>
//       </div>

//       <div className="flex gap-2 mb-4">
//         <button onClick={() => setTab('eligible')}
//           className={`flex-1 py-2 rounded-lg text-sm font-semibold ${tab === 'eligible' ? 'bg-[#1e3a5f] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
//           Unazostahili ({result.eligible_count})
//         </button>
//         <button onClick={() => setTab('close')}
//           className={`flex-1 py-2 rounded-lg text-sm font-semibold ${tab === 'close' ? 'bg-[#1e3a5f] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
//           Karibu ({result.close_miss_count})
//         </button>
//       </div>

//       <div className="space-y-3">
//         {(tab === 'eligible' ? result.eligible : result.close_miss).map(p => (
//           <div key={p.programme_id} className="bg-white rounded-xl border border-slate-200 p-4">
//             <div className="flex items-start justify-between gap-3">
//               <div>
//                 <div className="font-semibold text-slate-800 text-sm">{p.programme_name}</div>
//                 <div className="text-xs text-slate-500 mt-0.5">
//                   {p.institution_name}{p.institution_location ? `, ${p.institution_location}` : ''}
//                 </div>
//               </div>
//               <div className="text-right shrink-0">
//                 <div className="font-mono font-bold text-[#1e3a5f]">
//                   {p.achieved_points} <span className="text-slate-400 text-xs">/ {p.min_points_total}</span>
//                 </div>
//                 {tab === 'eligible' ? (
//                   <div className="text-xs text-green-600">+{p.margin} juu ya kiwango</div>
//                 ) : (
//                   <div className="text-xs text-amber-600">Pungufu ya {p.points_gap}</div>
//                 )}
//               </div>
//             </div>
//             {p.capacity && (
//               <div className="text-xs text-slate-400 mt-2">
//                 Nafasi: {p.capacity} · Muda: miaka {p.duration_years}
//               </div>
//             )}
//           </div>
//         ))}
//         {(tab === 'eligible' ? result.eligible : result.close_miss).length === 0 && (
//           <p className="text-center text-slate-400 text-sm py-8">
//             {tab === 'eligible' ? 'Hakuna programu ulizostahili kwa masomo uliyoingiza.' : 'Hakuna programu za karibu kupatikana.'}
//           </p>
//         )}
//       </div>
//     </div>
//   );
// }


function Results({ result }) {
  const [tab, setTab] = useState('eligible');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Change tab and reset to page 1
  const handleTabChange = (newTab) => {
    setTab(newTab);
    setCurrentPage(1);
  };

  // Determine which list to show based on the active tab
  const activeList = tab === 'eligible' ? result.eligible : result.close_miss;
  
  // Calculate pagination details
  const totalPages = Math.ceil(activeList.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedList = activeList.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{result.eligible_count}</div>
          <div className="text-xs text-slate-600 mt-1">Programu Unazostahili</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-700">{result.close_miss_count}</div>
          <div className="text-xs text-slate-600 mt-1">Karibu Kufikia (chini kidogo)</div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => handleTabChange('eligible')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold ${tab === 'eligible' ? 'bg-[#1e3a5f] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
          Unazostahili ({result.eligible_count})
        </button>
        <button onClick={() => handleTabChange('close')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold ${tab === 'close' ? 'bg-[#1e3a5f] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
          Karibu ({result.close_miss_count})
        </button>
      </div>

      <div className="space-y-3 max-h-120 overflow-y-auto">
        {paginatedList.map(p => (
          <div key={p.programme_id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-800 text-sm">{p.programme_name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {p.institution_name}{p.institution_location ? `, ${p.institution_location}` : ''}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono font-bold text-[#1e3a5f]">
                  {p.achieved_points} <span className="text-slate-400 text-xs">/ {p.min_points_total}</span>
                </div>
                {tab === 'eligible' ? (
                  <div className="text-xs text-green-600">+{p.margin} juu ya kiwango</div>
                ) : (
                  <div className="text-xs text-amber-600">Pungufu ya {p.points_gap}</div>
                )}
              </div>
            </div>
            {p.capacity && (
              <div className="text-xs text-slate-400 mt-2">
                Nafasi: {p.capacity} · Muda: miaka {p.duration_years}
              </div>
            )}
          </div>
        ))}

        {activeList.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">
            {tab === 'eligible' ? 'Hakuna programu ulizostahili kwa masomo uliyoingiza.' : 'Hakuna programu za karibu kupatikana.'}
          </p>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 bg-white p-3 rounded-xl border border-slate-200">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg disabled:opacity-50 hover:bg-slate-200 transition-colors"
          >
            Iliyopita
          </button>
          
          <span className="text-sm font-medium text-slate-500">
            Ukurasa {currentPage} wa {totalPages}
          </span>
          
          <button 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg disabled:opacity-50 hover:bg-slate-200 transition-colors"
          >
            Inayofuata
          </button>
        </div>
      )}
    </div>
  );
}