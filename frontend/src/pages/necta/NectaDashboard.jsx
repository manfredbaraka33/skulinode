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

export default function NectaDashboard() {
  const [level] = useState('ACSEE');
  const [year]  = useState(2026);
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/kpis/?level=${level}&year=${year}`)
      .then(r => setKpis(r.data)).catch(() => setKpis(null)).finally(() => setLoading(false));
  }, [level, year]);

  function handleRegionSelect(r) {
    setRegion(r); setDistrict('');
    setTimeout(() => document.getElementById('rankings-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <SearchHero level={level} year={year} />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Inapakia...</div>
        ) : kpis ? (
          <>
            <HeadlineStory kpis={kpis} />
            <RegionalPride level={level} year={year} onSelectRegion={handleRegionSelect} />
            <GenderStory level={level} year={year} />
            <HiddenGems level={level} year={year} />
            <SubjectLeaderboard level={level} year={year} />
            <div id="rankings-section">
              <RankingsTable level={level} year={year} region={region} district={district}
                onRegionChange={setRegion} onDistrictChange={setDistrict} />
            </div>
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