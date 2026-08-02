import { useState, useEffect } from 'react';
import axios from 'axios';

import { NECTA_API as API } from '../../config/api';

const SUBJECTS = [
  'GENERAL STUDIES', 'HISTORY', 'GEOGRAPHY', 'ENGLISH LANGUAGE', 'KISWAHILI',
  'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'ADVANCED MATHEMATICS',
  'BASIC APPLIED MATHEMATICS', 'COMPUTER SCIENCE', 'ECONOMICS',
];
const MEDALS = ['🥇', '🥈', '🥉'];

export default function SubjectLeaderboard({ level, year }) {
  const [subject, setSubject] = useState('BIOLOGY');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    axios.get(`${API}/subject-leaderboard/?level=${level}&year=${year}&subject=${subject}&page_size=10`)
      .then(r => setRows(r.data.results));
  }, [level, year, subject]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-bold text-slate-800">Shule Bora Zaidi Kwa Somo</h2>
        <select value={subject} onChange={e => setSubject(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5">
          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.center_id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <span className="w-7 text-center">{MEDALS[i] ?? `#${r.rank}`}</span>
              <div>
                <div className="text-sm font-medium text-slate-800">{r.center_name}</div>
                <div className="text-xs text-slate-400">{r.region}</div>
              </div>
            </div>
            <div className="font-bold text-blue-700">{r.subject_gpa}</div>
          </div>
        ))}
      </div>
    </div>
  );
}