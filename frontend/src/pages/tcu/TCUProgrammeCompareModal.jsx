import { useState, useEffect } from 'react';
import axios from 'axios';
import { TCU_API as API } from '../../config/api';
import { Search, X, Plus } from 'lucide-react';

export default function TCUProgrammeCompareModal({ cycleId, onClose }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [programmes, setProgrammes] = useState([]);

  useEffect(() => {
    if (query.trim().length < 2) { setSuggestions([]); return; }
    const t = setTimeout(() => {
      axios.get(`${API}/search-programmes/?cycle_id=${cycleId}&q=${encodeURIComponent(query)}`)
        .then(r => setSuggestions(r.data.results));
    }, 300);
    return () => clearTimeout(t);
  }, [query, cycleId]);

  useEffect(() => {
    if (selectedIds.length !== 2) { setProgrammes([]); return; }
    axios.get(`${API}/compare-programmes/?cycle_id=${cycleId}&programme_ids=${selectedIds.join(',')}`)
      .then(r => setProgrammes(r.data.results));
  }, [selectedIds, cycleId]);

  function addProgramme(id) {
    if (selectedIds.includes(id) || selectedIds.length >= 2) return;
    setSelectedIds(p => [...p, id]);
    setQuery(''); setSuggestions([]);
  }
  function removeProgramme(id) {
    setSelectedIds(p => p.filter(x => x !== id));
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[100vh] min-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 style={{ fontFamily: "'Fraunces', serif" }} className="font-semibold text-[#1e3a5f] text-lg">
            Linganisha Kozi
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18}/></button>
        </div>

        <div className="p-5 overflow-y-auto min-h-[90vh] py-3">
          {selectedIds.length < 2 && (
            <div className="relative mb-4">
              <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2">
                <Search size={15} className="text-slate-400 mr-2"/>
                <input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Tafuta kozi ya kulinganisha..." className="flex-1 outline-none text-sm"/>
              </div>
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-56 overflow-y-auto">
                  {suggestions.map(s => (
                    <button key={s.id} onClick={() => addProgramme(s.id)}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 text-left text-sm">
                      <div>
                        <div>{s.programme_name}</div>
                        <div className="text-xs text-slate-400">{s.institution_name}</div>
                      </div>
                      <Plus size={14} className="text-blue-600"/>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {programmes.length === 2 && (
            <div className="grid grid-cols-2 gap-4">
              {programmes.map(p => (
                <div key={p.id} className="border border-slate-200 rounded-xl p-4 relative">
                  <button onClick={() => removeProgramme(p.id)}
                    className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><X size={14}/></button>
                  <div className="font-semibold text-slate-800 text-sm mb-1">{p.programme_name}</div>
                  <div className="text-xs text-slate-500 mb-3">{p.institution_name}, {p.institution_location}</div>

                  <Row label="Pointi za Chini" value={p.min_points_total} />
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
          )}

          {selectedIds.length < 2 && programmes.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">Chagua kozi mbili kulinganisha.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-xs py-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value ?? '—'}</span>
    </div>
  );
}