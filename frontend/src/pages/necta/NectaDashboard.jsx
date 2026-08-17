import { useState, useEffect } from 'react';
import axios from 'axios';
import { NECTA_API as API } from '../../config/api';
import SearchHero from './SearchHero';
import HeadlineStory from './HeadlineStory';
import RegionalPride from './RegionalPride';
import GenderStory from './GenderStory';
import SubjectLeaderboard from './SubjectLeaderboard';
import HiddenGems from './HiddenGems';
import RankingsTable from './RankingsTable';
import CompareModal from './CompareModal';
import { Users2 } from 'lucide-react';
import SubjectRankings from './SubjectRankings';

const LEVEL_LABELS = { ACSEE: 'Kidato cha Sita', CSEE: 'Kidato cha Nne', FTNA: 'Kidato cha Pili', PSLE: 'Darasa la Saba' };

export default function NectaDashboard() {
  const [sessions, setSessions] = useState([]);
  const [level, setLevel] = useState('ACSEE');
  const [year, setYear] = useState(null);
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    axios.get(`${API}/sessions/`).then(r => {
      setSessions(r.data);
      if (r.data.length > 0) {
        setLevel(r.data[0].exam_level);
        setYear(r.data[0].year);
      }
    });
  }, []);

  useEffect(() => {
    if (!year || !level) return;
    setLoading(true);
    axios.get(`${API}/kpis/?level=${level}&year=${year}`)
      .then(r => setKpis(r.data))
      .catch(() => setKpis(null))
      .finally(() => setLoading(false));
  }, [level, year]);

  const availableLevels = [...new Set(sessions.map(s => s.exam_level))];
  const availableYears = sessions.filter(s => s.exam_level === level).map(s => s.year);

  // Helper function to handle changing levels cleanly
  function handleLevelChange(newLevel) {
    setLevel(newLevel);
    setRegion('');
    setDistrict('');
    
    // Reset to the first available year for the selected level
    const yearsForLevel = sessions.filter(s => s.exam_level === newLevel).map(s => s.year);
    if (yearsForLevel.length > 0) {
      setYear(yearsForLevel[0]);
    }
  }

  function handleRegionSelect(r) {
    setRegion(r); setDistrict('');
    setTimeout(() => document.getElementById('rankings-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <SearchHero level={level} year={year} />

      {/* Show controls if there are multiple sessions OR multiple levels/years */}
      {sessions.length > 0 && (
        <div className="bg-white border-b border-slate-200 px-4 py-3">
          <div className="max-w-5xl mx-auto flex flex-wrap gap-3 items-center">
            {availableLevels.length > 0 && (
              <div className="flex gap-1.5">
                {availableLevels.map(lv => (
                  <button 
                    key={lv} 
                    onClick={() => handleLevelChange(lv)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full transition ${
                      level === lv ? 'bg-[#1e3a5f] text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {LEVEL_LABELS[lv] ?? lv}
                  </button>
                ))}
              </div>
            )}
            
            {availableYears.length > 0 && (
              <select 
                value={year ?? ''} 
                onChange={e => setYear(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded-lg px-3 py-1.5"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Inapakia...</div>
        ) : kpis ? (
          <>
            <HeadlineStory kpis={kpis} />
            <div id="rankings-section">
              <RankingsTable level={level} year={year} region={region} district={district}
                onRegionChange={setRegion} onDistrictChange={setDistrict} />
            </div>
            <SubjectLeaderboard level={level} year={year} />
            <RegionalPride level={level} year={year} onSelectRegion={handleRegionSelect} />
            <SubjectRankings level={level} year={year} />
            <GenderStory level={level} year={year} />
            <HiddenGems level={level} year={year} />
            
            
          </>
        ) : (
          <div className="text-center py-12 text-slate-400">Matokeo hayajapatikana kwa mwaka huu.</div>
        )}
      </div>

      <button onClick={() => setShowCompare(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-3 bg-[#1e3a5f] text-white rounded-full shadow-xl font-semibold text-sm z-20 hover:bg-[#142a44] transition">
        <Users2 size={18}/> Linganisha Shule
      </button>

      {showCompare && <CompareModal level={level} year={year} onClose={() => setShowCompare(false)} />}
    </div>
  );
}