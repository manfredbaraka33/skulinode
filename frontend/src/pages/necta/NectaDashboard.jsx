import { useState, useEffect } from 'react';
import axios from 'axios';
import SearchHero from './SearchHero';
import HeadlineStory from './HeadlineStory';
import RegionalPride from './RegionalPride';
import GenderStory from './GenderStory';
// import OwnershipSection from './OwnershipSection';
import SubjectLeaderboard from './SubjectLeaderboard';
import HiddenGems from './HiddenGems';
import RankingsTable from './RankingsTable';

const API = 'http://127.0.0.1:8000/api/public/necta';

export default function NectaDashboard() {
  const [level] = useState('ACSEE');
  const [year]  = useState(2026);
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/kpis/?level=${level}&year=${year}`)
      .then(r => setKpis(r.data))
      .catch(() => setKpis(null))
      .finally(() => setLoading(false));
  }, [level, year]);

  function handleRegionSelect(r) {
    setRegion(r);
    setDistrict('');
    setTimeout(() => {
      document.getElementById('rankings-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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
            {/* <OwnershipSection level={level} year={year} /> */}
            <HiddenGems level={level} year={year} />
            <SubjectLeaderboard level={level} year={year} />
            <div id="rankings-section">
              <RankingsTable
                level={level} year={year}
                region={region} district={district}
                onRegionChange={setRegion} onDistrictChange={setDistrict}
              />
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-slate-400">Matokeo hayajapatikana kwa mwaka huu.</div>
        )}
      </div>
    </div>
  );
}