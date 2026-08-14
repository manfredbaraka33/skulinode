// import { useState, useEffect } from 'react';
// import axios from 'axios';
// import { TCU_API as API } from '../../config/api';
// import { Search, X, Check } from 'lucide-react';

// export default function TCUProgrammeCompareModal({ cycleId, onClose }) {
//   const [query, setQuery] = useState('');
//   const [suggestions, setSuggestions] = useState([]);
//   const [selected, setSelected] = useState([]); // [{id, programme_name, institution_name}]
//   const [programmes, setProgrammes] = useState([]);
//   const [loadingCompare, setLoadingCompare] = useState(false);

//   useEffect(() => {
//     if (query.trim().length < 2) { setSuggestions([]); return; }
//     const t = setTimeout(() => {
//       axios.get(`${API}/search-programmes/?cycle_id=${cycleId}&q=${encodeURIComponent(query)}`)
//         .then(r => setSuggestions(r.data.results.filter(s => !selected.some(sel => sel.id === s.id))));
//     }, 300);
//     return () => clearTimeout(t);
//   }, [query, cycleId, selected]);

//   useEffect(() => {
//     if (selected.length !== 2) { setProgrammes([]); return; }
//     setLoadingCompare(true);
//     const ids = selected.map(s => s.id).join(',');
//     axios.get(`${API}/compare-programmes/?cycle_id=${cycleId}&programme_ids=${ids}`)
//       .then(r => setProgrammes(r.data.results))
//       .finally(() => setLoadingCompare(false));
//   }, [selected, cycleId]);

//   function addProgramme(s) {
//     if (selected.length >= 2) return;
//     setSelected(p => [...p, { id: s.id, programme_name: s.programme_name, institution_name: s.institution_name }]);
//     setQuery('');
//     setSuggestions([]);
//   }
//   function removeProgramme(id) {
//     setSelected(p => p.filter(s => s.id !== id));
//   }

//   return (
//     <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
//       <div onClick={e => e.stopPropagation()}
//         className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

//         {/* Header */}
//         <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
//           <div>
//             <h2 style={{ fontFamily: "'Fraunces', serif" }} className="font-semibold text-[#1e3a5f] text-lg">
//               Linganisha Kozi
//             </h2>
//             <p className="text-xs text-slate-400 mt-0.5">Chagua kozi mbili kulinganisha</p>
//           </div>
//           <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18}/></button>
//         </div>

//         {/* Selection slots — always visible, this is the fix */}
//         <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
//           <div className="flex items-center gap-2 mb-3">
//             <span className="text-xs font-semibold text-slate-500">Zilizochaguliwa</span>
//             <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
//               selected.length === 2 ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
//             }`}>
//               {selected.length}/2
//             </span>
//           </div>
//           <div className="grid grid-cols-2 gap-3">
//             {[0, 1].map(slot => {
//               const item = selected[slot];
//               return item ? (
//                 <div key={item.id} className="flex items-center justify-between bg-white border-2 border-green-200 rounded-xl px-3 py-2.5">
//                   <div className="min-w-0">
//                     <div className="flex items-center gap-1.5">
//                       <Check size={13} className="text-green-600 shrink-0"/>
//                       <span className="text-sm font-semibold text-slate-800 truncate">{item.programme_name}</span>
//                     </div>
//                     <div className="text-xs text-slate-400 truncate mt-0.5">{item.institution_name}</div>
//                   </div>
//                   <button onClick={() => removeProgramme(item.id)}
//                     className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0 ml-2">
//                     <X size={14}/>
//                   </button>
//                 </div>
//               ) : (
//                 <div key={`empty-${slot}`}
//                   className="flex items-center justify-center border-2 border-dashed border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-400">
//                   Nafasi ya {slot + 1} — bado tupu
//                 </div>
//               );
//             })}
//           </div>
//         </div>

//         {/* Search — visible whenever there's an empty slot */}
//         {selected.length < 2 && (
//           <div className="px-5 py-3 border-b border-slate-100 relative">
//             <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2">
//               <Search size={15} className="text-slate-400 mr-2"/>
//               <input value={query} onChange={e => setQuery(e.target.value)}
//                 placeholder="Tafuta kozi ya kuongeza..." autoFocus
//                 className="flex-1 outline-none text-sm"/>
//             </div>
//             {suggestions.length > 0 && (
//               <div className="absolute left-5 right-5 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-56 overflow-y-auto">
//                 {suggestions.map(s => (
//                   <button key={s.id} onClick={() => addProgramme(s)}
//                     className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 text-left text-sm border-b border-slate-50 last:border-0">
//                     <div className="min-w-0">
//                       <div className="font-medium text-slate-800 truncate">{s.programme_name}</div>
//                       <div className="text-xs text-slate-400 truncate">{s.institution_name}</div>
//                     </div>
//                     <span className="text-xs text-blue-600 font-semibold shrink-0 ml-2">+ Ongeza</span>
//                   </button>
//                 ))}
//               </div>
//             )}
//           </div>
//         )}

//         {/* Comparison results */}
//         <div className="p-5 overflow-y-auto flex-1">
//           {loadingCompare ? (
//             <div className="text-center py-8 text-slate-400 text-sm">Inalinganisha...</div>
//           ) : programmes.length === 2 ? (
//             <div className="grid grid-cols-2 gap-4">
//               {programmes.map(p => (
//                 <div key={p.id} className="border border-slate-200 rounded-xl p-4">
//                   <div className="font-semibold text-slate-800 text-sm mb-1">{p.programme_name}</div>
//                   <div className="text-xs text-slate-500 mb-3">{p.institution_name}, {p.institution_location}</div>

//                   <Row label="Pointi za Chini" value={p.min_points_total} highlight />
//                   <Row label="Aina" value={p.category} />
//                   <Row label="Umiliki" value={p.institution_ownership} />
//                   <Row label="Nafasi" value={p.capacity} />
//                   <Row label="Muda" value={p.duration_years ? `Miaka ${p.duration_years}` : '—'} />

//                   {p.slots?.length > 0 && (
//                     <div className="mt-3 pt-3 border-t border-slate-100">
//                       <div className="text-xs font-semibold text-slate-500 mb-1.5">Masomo Yanayohitajika</div>
//                       {p.slots.map((slot, i) => (
//                         <div key={i} className="text-xs text-slate-600 mb-1">
//                           {slot.count_needed > 1 ? `Yoyote ${slot.count_needed} kati ya: ` : ''}
//                           {slot.subjects.join(', ')}
//                           {slot.min_grade && <span className="text-amber-600"> (angalau {slot.min_grade})</span>}
//                         </div>
//                       ))}
//                     </div>
//                   )}

//                   {p.application_url ? (
//                     <a href={p.application_url} target="_blank" rel="noopener noreferrer"
//                       className="block mt-3 text-center text-xs font-semibold text-white bg-[#1e3a5f] rounded-lg py-2">
//                       Fungua Portal →
//                     </a>
//                   ) : (
//                     <div className="mt-3 text-center text-xs text-slate-400">Kiungo cha maombi hakijawekwa bado</div>
//                   )}
//                 </div>
//               ))}
//             </div>
//           ) : (
//             <p className="text-center text-slate-400 text-sm py-8">
//               {selected.length === 0
//                 ? 'Tumia utafutaji hapo juu kuongeza kozi ya kwanza.'
//                 : 'Ongeza kozi ya pili kuona ulinganisho.'}
//             </p>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// function Row({ label, value, highlight }) {
//   return (
//     <div className="flex justify-between text-xs py-1">
//       <span className="text-slate-500">{label}</span>
//       <span className={`font-medium ${highlight ? 'font-mono font-bold text-[#1e3a5f]' : 'text-slate-800'}`}>{value ?? '—'}</span>
//     </div>
//   );
// }




import { useState, useEffect } from 'react';
import axios from 'axios';
import { TCU_API as API } from '../../config/api';
import { Search, X, Check, Loader2 } from 'lucide-react';

export default function TCUProgrammeCompareModal({ cycleId, onClose }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState([]); // [{id, programme_name, institution_name}]
  const [programmes, setProgrammes] = useState([]);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { 
      setSuggestions([]); 
      setLoadingSearch(false);
      return; 
    }

    setLoadingSearch(true);

    const t = setTimeout(() => {
      axios.get(`${API}/search-programmes/?cycle_id=${cycleId}&q=${encodeURIComponent(query)}`)
        .then(r => setSuggestions(r.data.results.filter(s => !selected.some(sel => sel.id === s.id))))
        .catch(() => setSuggestions([]))
        .finally(() => setLoadingSearch(false));
    }, 300);

    return () => clearTimeout(t);
  }, [query, cycleId, selected]);

  useEffect(() => {
    if (selected.length !== 2) { setProgrammes([]); return; }
    setLoadingCompare(true);
    const ids = selected.map(s => s.id).join(',');
    axios.get(`${API}/compare-programmes/?cycle_id=${cycleId}&programme_ids=${ids}`)
      .then(r => setProgrammes(r.data.results))
      .finally(() => setLoadingCompare(false));
  }, [selected, cycleId]);

  function addProgramme(s) {
    if (selected.length >= 2) return;
    setSelected(p => [...p, { id: s.id, programme_name: s.programme_name, institution_name: s.institution_name }]);
    setQuery('');
    setSuggestions([]);
  }

  function removeProgramme(id) {
    setSelected(p => p.filter(s => s.id !== id));
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 style={{ fontFamily: "'Fraunces', serif" }} className="font-semibold text-[#1e3a5f] text-lg">
              Linganisha Kozi
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Chagua kozi mbili kulinganisha</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18}/></button>
        </div>

        {/* Selection slots */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-slate-500">Zilizochaguliwa</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              selected.length === 2 ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
            }`}>
              {selected.length}/2
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map(slot => {
              const item = selected[slot];
              return item ? (
                <div key={item.id} className="flex items-center justify-between bg-white border-2 border-green-200 rounded-xl px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Check size={13} className="text-green-600 shrink-0"/>
                      <span className="text-sm font-semibold text-slate-800 truncate">{item.programme_name}</span>
                    </div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">{item.institution_name}</div>
                  </div>
                  <button onClick={() => removeProgramme(item.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0 ml-2">
                    <X size={14}/>
                  </button>
                </div>
              ) : (
                <div key={`empty-${slot}`}
                  className="flex items-center justify-center border-2 border-dashed border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-400">
                  Nafasi ya {slot + 1} — bado tupu
                </div>
              );
            })}
          </div>
        </div>

        {/* Search Section */}
        {selected.length < 2 && (
          <div className="px-5 py-3 border-b border-slate-100 relative z-20">
            <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2 bg-white focus-within:border-blue-500">
              <Search size={15} className="text-slate-400 mr-2 shrink-0"/>
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Tafuta kozi ya kuongeza..." autoFocus
                className="flex-1 outline-none text-sm bg-transparent"/>
              
              {loadingSearch && (
                <Loader2 size={15} className="text-slate-400 animate-spin ml-2 shrink-0" />
              )}
            </div>

            {/* Scrollable Suggestions Menu */}
            {query.trim().length >= 2 && !loadingSearch && (
              <div className="absolute left-5 right-5 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100">
                {suggestions.length > 0 ? (
                  suggestions.map(s => (
                    <button key={s.id} onClick={() => addProgramme(s)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-blue-50/80 text-left transition-colors">
                      <div className="min-w-0 pr-2">
                        <div className="font-medium text-slate-800 text-sm truncate">{s.programme_name}</div>
                        <div className="text-xs text-slate-400 truncate mt-0.5">{s.institution_name}</div>
                      </div>
                      <span className="text-xs text-blue-600 font-semibold shrink-0 bg-blue-50 px-2 py-1 rounded-md">+ Ongeza</span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-xs text-slate-400 text-center">
                    Hakuna kozi iliyopatikana
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Comparison results */}
        <div className="p-5 overflow-y-auto flex-1">
          {loadingCompare ? (
            <div className="text-center py-8 text-slate-400 text-sm">Inalinganisha...</div>
          ) : programmes.length === 2 ? (
            <div className="grid grid-cols-2 gap-4">
              {programmes.map(p => (
                <div key={p.id} className="border border-slate-200 rounded-xl p-4">
                  <div className="font-semibold text-slate-800 text-sm mb-1">{p.programme_name}</div>
                  <div className="text-xs text-slate-500 mb-3">{p.institution_name}, {p.institution_location}</div>

                  <Row label="Pointi za Chini" value={p.min_points_total} highlight />
                  <Row label="Aina" value={p.category} />
                  <Row label="Umiliki" value={p.institution_ownership} />
                  <Row label="Nafasi" value={p.capacity} />
                  <Row label="Muda" value={p.duration_years ? `Miaka ${p.duration_years}` : '—'} />

                  {p.slots?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="text-xs font-semibold text-slate-500 mb-1.5">Masomo Yanayohitajika</div>
                      {p.slots.map((slot, i) => (
                        <div key={i} className="text-xs text-slate-600 mb-1">
                          {slot.count_needed > 1 ? `Yoyote ${slot.count_needed} kati ya: ` : ''}
                          {slot.subjects.join(', ')}
                          {slot.min_grade && <span className="text-amber-600"> (angalau {slot.min_grade})</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {p.application_url ? (
                    <a href={p.application_url} target="_blank" rel="noopener noreferrer"
                      className="block mt-3 text-center text-xs font-semibold text-white bg-[#1e3a5f] rounded-lg py-2">
                      Fungua Portal →
                    </a>
                  ) : (
                    <div className="mt-3 text-center text-xs text-slate-400">Kiungo cha maombi hakijawekwa bado</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-400 text-sm py-8">
              {selected.length === 0
                ? 'Tumia utafutaji hapo juu kuongeza kozi ya kwanza.'
                : 'Ongeza kozi ya pili kuona ulinganisho.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }) {
  return (
    <div className="flex justify-between text-xs py-1">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium ${highlight ? 'font-mono font-bold text-[#1e3a5f]' : 'text-slate-800'}`}>{value ?? '—'}</span>
    </div>
  );
}