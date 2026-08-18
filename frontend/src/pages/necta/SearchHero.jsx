import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search,ArrowLeft } from 'lucide-react';

import { NECTA_API as API } from '../../config/api';

export default function SearchHero({ level, year }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(() => {
      axios.get(`${API}/search/?q=${encodeURIComponent(query)}&level=${level}&year=${year}`)
        .then(r => { setResults(r.data.results); setShowResults(true); });
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, level, year]);

  return (
    <div className="bg-gradient-to-br from-[#1e3a5f] to-[#142a44]  px-4 py-14 text-center relative">
      <center>
          <button onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-slate-200 hover:text-[#b3c6de] mb-6">
          <ArrowLeft size={15}/> Rudi Nyumbani
        </button>
         </center>
      <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
        Matokeo ya {level} {year}
      </h1>
      <p className="text-blue-100 text-sm mb-6">Tafuta shule yako, mkoa wako, au somo lako</p>

      <div className="max-w-md mx-auto relative">
        <div className="flex items-center bg-white rounded-full px-4 py-3 shadow-lg">
          <Search size={18} className="text-slate-400 mr-2 shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => query.length >= 2 && setShowResults(true)}
            placeholder="Tafuta shule yako..."
            className="flex-1 outline-none text-sm text-slate-800"
          />
        </div>

        {showResults && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl overflow-hidden z-20 text-left">
            {results.map(r => (
              <button
                key={r.center_id}
                onClick={() => navigate(`/necta/shule/${r.center_id}/${level}/${year}`)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 border-b border-slate-50 last:border-0"
              >
                <div>
                  <div className="text-sm font-medium text-slate-800">{r.center_name}</div>
                  <div className="text-xs text-slate-400">{r.region}</div>
                </div>
                <div className="text-sm font-bold text-blue-600">GPA {r.gpa}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}