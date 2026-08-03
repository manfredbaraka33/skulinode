import { useState, useEffect } from 'react';
import axios from 'axios';
import { NECTA_API as API } from '../../config/api';
import NectaModal from './NectaModal';
import { Download, ChevronRight } from 'lucide-react';

export default function HiddenGems({ level, year }) {
  const [gems, setGems] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    axios.get(`${API}/hidden-gems/?level=${level}&year=${year}`).then(r => setGems(r.data.results));
  }, [level, year]);

  async function downloadGemCard(centerId) {
    setDownloadingId(centerId);
    try {
      const r = await axios.get(`${API}/cards/gem/${centerId}/?level=${level}&year=${year}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `${centerId}_kito.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 30000);
    } finally { setDownloadingId(null); }
  }

  if (gems.length === 0) return null;

  const GemCard = (g) => (
    <div key={g.center_id} className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-semibold text-slate-800 text-sm">{g.center_name}</div>
          <div className="text-xs text-slate-400">{g.region} · Watahiniwa {g.sat_total}</div>
        </div>
        <div className="text-right">
          <div className="font-bold text-green-600">{g.center_gpa}</div>
          <div className="text-xs text-slate-400">#{g.national_rank} taifa</div>
        </div>
      </div>
      <button onClick={() => downloadGemCard(g.center_id)} disabled={downloadingId === g.center_id}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-[#1e3a5f] border border-[#1e3a5f]/20 rounded-lg hover:bg-[#1e3a5f]/5 disabled:opacity-50">
        <Download size={12}/> {downloadingId === g.center_id ? 'Inapakua...' : 'Pakua Kadi'}
      </button>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-slate-800">Vito Vilivyofichika 💎</h2>
        {gems.length > 4 && (
          <button onClick={() => setShowAll(true)} className="text-sm text-blue-600 font-medium flex items-center gap-1">
            Ona Vyote <ChevronRight size={14}/>
          </button>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">Shule ndogo zilizowashinda wote</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {gems.slice(0, 4).map(GemCard)}
      </div>

      {showAll && (
        <NectaModal title="Vito Vyote Vilivyofichika" onClose={() => setShowAll(false)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {gems.map(GemCard)}
          </div>
        </NectaModal>
      )}
    </div>
  );
}