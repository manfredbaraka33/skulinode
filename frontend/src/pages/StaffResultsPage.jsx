/**
 * StaffResultsPage — Teachers view published results for their assigned classes.
 * Results are only visible after an admin publishes them.
 */
import { useState, useEffect, useCallback } from 'react';
import { BarChart2, Loader2, RefreshCw, Lock } from 'lucide-react';
import { PageHeader, Toast, useToast } from '../components/ui';
import apiClient from '../api/axios';

// ── Grade colour helpers ──────────────────────────────────────────────────────
const GRADE_COLOR = {
  A: 'text-green-600', B: 'text-teal-600', C: 'text-yellow-600',
  D: 'text-orange-500', F: 'text-red-600', E: 'text-purple-500', '-': 'text-slate-300',
};

function makeSubjectCodes(subjects) {
  const used = {};
  return subjects.reduce((acc, name) => {
    const words = name.trim().split(/\s+/);
    let code = words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
    if (used[code]) {
      let n = 2;
      while (used[`${code}${n}`]) n++;
      code = `${code}${n}`;
    }
    used[code] = true;
    acc[name] = code;
    return acc;
  }, {});
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function StaffResultsPage() {
  const [toast, showToast, clearToast] = useToast();
  const [streams, setStreams]         = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [stream, setStream]           = useState('');
  const [assessment, setAssessment]   = useState('');
  const [results, setResults]         = useState(null);
  const [loading, setLoading]         = useState(false);
  const [notPublished, setNotPublished] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.get('/academy/streams/'),
      apiClient.get('/academy/assessments/'),
    ]).then(([s, a]) => {
      setStreams(s.data.results ?? s.data);
      setAssessments(a.data.results ?? a.data);
    }).catch(() => showToast('Failed to load filters.', 'error'));
  }, []);

  const fetchResults = useCallback(async () => {
    if (!stream || !assessment) return;
    setLoading(true);
    setNotPublished(false);
    setResults(null);
    try {
      const r = await apiClient.get(`/academy/results/?assessment=${assessment}&stream=${stream}`);
      setResults(r.data);
    } catch (e) {
      if (e.response?.status === 403) {
        setNotPublished(true);
      } else {
        showToast('Failed to load results.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [stream, assessment]);

  const selectedStream = streams.find(s => String(s.id) === String(stream));
  const selectedStreamLabel = selectedStream
    ? `${selectedStream.class_level_name ?? ''} ${selectedStream.name}`.trim()
    : '';
  const selectedAssessmentName = assessments.find(a => String(a.id) === String(assessment))?.name ?? '';

  const subjectCodes = results ? makeSubjectCodes(results.subjects) : {};
  const isPrimary    = results?.school_type === 'PRIMARY';

  return (
    <div className="max-w-full px-4 py-8">
      {toast && <Toast {...toast} onClose={clearToast} />}

      <PageHeader icon={BarChart2} title="Class Results"
        subtitle="View published results for your classes"
        action={
          results && (
            <button onClick={fetchResults} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          )
        }
      />

      {/* Selectors */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Class / Stream</label>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 min-w-44"
            value={stream} onChange={e => { setStream(e.target.value); setResults(null); setNotPublished(false); }}>
            <option value="">Select class…</option>
            {streams.map(s => (
              <option key={s.id} value={s.id}>
                {s.class_level_name ?? ''} {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Assessment</label>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 min-w-44"
            value={assessment} onChange={e => { setAssessment(e.target.value); setResults(null); setNotPublished(false); }}>
            <option value="">Select assessment…</option>
            {assessments.map(a => <option key={a.id} value={a.id}>{a.name} ({a.academic_year})</option>)}
          </select>
        </div>
        {stream && assessment && (
          <div className="flex items-end">
            <button onClick={fetchResults}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
              <RefreshCw size={14} /> Load
            </button>
          </div>
        )}
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div>}

      {/* Not yet published notice */}
      {!loading && notPublished && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Lock size={28} className="text-amber-500" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-700 dark:text-slate-200">Results Not Yet Published</p>
            <p className="text-sm text-slate-500 mt-1">
              Results for <strong>{selectedStreamLabel}</strong> — <strong>{selectedAssessmentName}</strong> have not been
              published by the admin yet. Please check back later.
            </p>
          </div>
        </div>
      )}

      {/* Results table */}
      {!loading && results && (
        <div className="space-y-5">
          {/* Summary bar */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-5 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span><span className="font-semibold text-blue-700 dark:text-blue-300">Class:</span> <span className="text-slate-700 dark:text-slate-200">{selectedStreamLabel}</span></span>
            <span><span className="font-semibold text-blue-700 dark:text-blue-300">Assessment:</span> <span className="text-slate-700 dark:text-slate-200">{selectedAssessmentName}</span></span>
            <span><span className="font-semibold text-blue-700 dark:text-blue-300">Students:</span> <span className="text-slate-700 dark:text-slate-200">{results.students.length}</span></span>
          </div>

          {/* Standings table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Student Standings</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    <th className="px-4 py-2.5 text-left font-semibold w-10">#</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                    <th className="px-4 py-2.5 text-center font-semibold w-8">G</th>
                    {results.subjects.map(s => (
                      <th key={s} className="px-3 py-2.5 text-center font-semibold" title={s}>
                        {subjectCodes[s]}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-center font-semibold">Total</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Avg</th>
                    {isPrimary ? (
                      <th className="px-4 py-2.5 text-center font-semibold">Grade</th>
                    ) : (
                      <>
                        <th className="px-4 py-2.5 text-center font-semibold">Pts</th>
                        <th className="px-4 py-2.5 text-center font-semibold">Div</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {results.students.map((student, ri) => (
                    <tr key={student.student_id}
                      className={`border-t border-slate-100 dark:border-slate-700 ${ri % 2 === 0 ? '' : 'bg-slate-50/40 dark:bg-slate-700/20'}`}>
                      <td className="px-4 py-2 text-slate-400 font-semibold text-xs">{student.rank ?? '—'}</td>
                      <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">{student.display_name}</td>
                      <td className="px-4 py-2 text-center text-xs text-slate-400">{student.gender}</td>
                      {results.subjects.map(subj => {
                        const d = student.subjects[subj];
                        const g = d?.grade ?? '-';
                        return (
                          <td key={subj} className="px-3 py-2 text-center font-mono text-xs">
                            {d?.excluded ? (
                              <span className="text-slate-300">—</span>
                            ) : d?.score != null ? (
                              <span className={GRADE_COLOR[g] ?? 'text-slate-500'}>
                                {d.score}
                                <span className="text-slate-400 text-[10px]">({g})</span>
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-200">
                        {student.total_score ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-center text-slate-500">
                        {student.average ?? '—'}
                      </td>
                      {isPrimary ? (
                        <td className={`px-4 py-2 text-center font-bold ${GRADE_COLOR[student.grade] ?? 'text-slate-500'}`}>
                          {student.grade ?? '—'}
                        </td>
                      ) : (
                        <>
                          <td className="px-4 py-2 text-center text-slate-500">{student.points ?? '—'}</td>
                          <td className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-200">{student.division ?? '—'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Subject key */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-x-5 gap-y-1">
              {results.subjects.map(s => (
                <span key={s} className="text-xs text-slate-500 dark:text-slate-400">
                  <strong className="text-slate-700 dark:text-slate-200">{subjectCodes[s]}</strong> = {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
