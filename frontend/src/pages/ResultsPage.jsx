/**
 * ResultsPage — Admin live results standings, submission tracking, publish & SMS.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, RefreshCw, Globe, MessageSquare, Loader2, AlertTriangle,
  CheckCircle, X, Send, Printer, TrendingUp, Download, RotateCcw,
} from 'lucide-react';
import { PageHeader, Toast, useToast, Modal } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/axios';

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Build short unique 3-letter codes per subject name. */
function makeSubjectCodes(subjects) {
  const codes = {};
  const used  = {};
  subjects.forEach((name, i) => {
    const first = (name.trim().split(/\s+/)[0] ?? '').replace(/[^A-Za-z]/g, '');
    let base = first.slice(0, 3).toUpperCase() || `S${i + 1}`;
    let code = base;
    let n = 2;
    while (used[code]) code = base.slice(0, 2) + String(n++);
    used[code] = true;
    codes[name] = code;
  });
  return codes;
}

const GPA_MAP_ORD = { A: 1, B: 2, C: 3, D: 4, F: 5 };
const GPA_MAP_ADV = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 5 };

/** Compute per-subject analytics from student rows. */
function buildAnalytics(subjects, students, schoolType) {
  const gradeSet = schoolType === 'ADVANCED' ? ['A','B','C','D','E','F'] : ['A','B','C','D','F'];
  const gpaMap = schoolType === 'ADVANCED' ? GPA_MAP_ADV : GPA_MAP_ORD;
  return subjects.map(subj => {
    const scores = [];
    const gc = Object.fromEntries(gradeSet.map(g => [g, 0]));
    let gpaSum = 0;
    students.forEach(st => {
      const d = st.subjects[subj];
      if (!d || d.excluded || d.score == null) return;
      scores.push(Number(d.score));
      if (d.grade in gc) gc[d.grade]++;
      gpaSum += (gpaMap[d.grade] ?? 5);
    });
    const sat  = scores.length;
    const sum  = scores.reduce((a, b) => a + b, 0);
    const avg  = sat ? (sum / sat).toFixed(1) : '-';
    const high = sat ? Math.max(...scores) : '-';
    const low  = sat ? Math.min(...scores) : '-';
    const pass = sat - (gc.F ?? 0);
    const gpa  = sat ? (gpaSum / sat).toFixed(2) : null;
    return { subj, sat, gc, gradeSet, avg, high, low, passRate: sat ? `${Math.round((pass / sat) * 100)}%` : '-', gpa };
  });
}

function gpaColor(gpa) {
  if (gpa === null || gpa === undefined) return 'text-slate-400';
  const g = parseFloat(gpa);
  if (g <= 1.5) return 'text-green-600 font-bold';
  if (g <= 2.5) return 'text-teal-600 font-bold';
  if (g <= 3.5) return 'text-yellow-600 font-bold';
  if (g <= 4.0) return 'text-orange-500 font-bold';
  return 'text-red-600 font-bold';
}

const DIV_COLOR = {
  'Division I':   'bg-green-100 text-green-700',
  'Division II':  'bg-teal-100 text-teal-700',
  'Division III': 'bg-yellow-100 text-yellow-700',
  'Division IV':  'bg-orange-100 text-orange-700',
  'Fail':         'bg-red-100 text-red-700',
};
const GRADE_COLOR = {
  A: 'text-green-600', B: 'text-teal-600', C: 'text-yellow-600',
  D: 'text-orange-500', E: 'text-purple-500', S: 'text-indigo-500', F: 'text-red-600', '-': 'text-slate-300',
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const { auth, schoolCanAccess } = useAuth();
  const [toast, showToast, clearToast] = useToast();

  const isAdmin = auth?.role === 'ADMIN' || (auth?.roles ?? []).includes('ADMIN');
  const isTeacher = auth?.role === 'TEACHER';
  // Plan-gated feature flags
  const canDownload = schoolCanAccess('school_pdf');
  const canCSV      = schoolCanAccess('school_csv');
  const canSMS      = schoolCanAccess('sms');
  // Show a notice to admins when downloads/publishing are locked
  const showDownloadNotice = !isTeacher && !canDownload;

  const [streams, setStreams]         = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [stream, setStream]           = useState('');
  const [assessment, setAssessment]   = useState('');

  const [results, setResults]               = useState(null);
  const [loading, setLoading]               = useState(false);
  const [submissionStats, setSubmissionStats] = useState([]);

  const [showPublish, setShowPublish]     = useState(false);
  const [showSMS, setShowSMS]             = useState(false);
  const [isPublished, setIsPublished]     = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [unlockingSubject, setUnlockingSubject] = useState(null); // subject_id being unlocked

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
    try {
      const [resData, statsData, pubData] = await Promise.all([
        apiClient.get(`/academy/results/?assessment=${assessment}&stream=${stream}`),
        apiClient.get(`/academy/submission-stats/?assessment=${assessment}&stream=${stream}`),
        apiClient.get('/academy/publish/', { params: { assessment, stream } }),
      ]);
      setResults(resData.data);
      setSubmissionStats(statsData.data.results ?? statsData.data);
      setIsPublished(pubData.data.is_published ?? false);
    } catch { showToast('Failed to load results.', 'error'); }
    finally { setLoading(false); }
  }, [stream, assessment]);

  async function handleUnlock(subjectId) {
    if (!stream || !assessment) return;
    setUnlockingSubject(subjectId);
    try {
      await apiClient.post('/academy/marks/unlock/', {
        subject: subjectId,
        assessment,
        stream,
      });
      showToast('Marks unlocked — teacher can now correct and re-submit.');
      const res = await apiClient.get(`/academy/submission-stats/?assessment=${assessment}&stream=${stream}`);
      setSubmissionStats(res.data.results ?? res.data);
    } catch {
      showToast('Failed to unlock marks.', 'error');
    } finally {
      setUnlockingSubject(null);
    }
  }

  const selectedStream = streams.find(s => String(s.id) === String(stream));
  const selectedStreamLabel = selectedStream
    ? `${selectedStream.class_level_name} ${selectedStream.name}`.trim()
    : '';
  const selectedAssessment = assessments.find(a => String(a.id) === String(assessment));
  const selectedAssessmentName = selectedAssessment?.name ?? '';
  const selectedAssessmentYear = selectedAssessment?.academic_year ?? '';

  const totalSubjects     = submissionStats.length;
  const submittedSubjects = submissionStats.filter(s => s.submitted_count >= s.total_students).length;
  const completionPct     = totalSubjects ? Math.round((submittedSubjects / totalSubjects) * 100) : 0;

  // Derived
  // Use admin-registered subject codes from API; fall back to generated ones if absent
  const subjectCodes  = results
    ? (results.subject_codes ?? makeSubjectCodes(results.subjects))
    : {};
  const analytics     = results ? buildAnalytics(results.subjects, results.students, results.school_type) : [];
  const gradeLabels   = results?.school_type === 'ADVANCED' ? ['A','B','C','D','E','F'] : ['A','B','C','D','F'];
  const isPrimary     = results?.school_type === 'PRIMARY';
  const divSummary    = (!isPrimary && results) ? results.students.reduce((acc, s) => {
    if (s.division) acc[s.division] = (acc[s.division] ?? 0) + 1;
    return acc;
  }, {}) : null;
  const DIV_ORDER = ['Division I', 'Division II', 'Division III', 'Division IV', 'Division 0'];
  const divGenderSummary = (!isPrimary && results) ? (() => {
    const tally = {};
    results.students.forEach(s => {
      if (!s.division) return;
      if (!tally[s.division]) tally[s.division] = { M: 0, F: 0, total: 0 };
      const g = s.gender === 'M' ? 'M' : 'F';
      tally[s.division][g]++;
      tally[s.division].total++;
    });
    return DIV_ORDER.filter(d => tally[d]?.total > 0).map(d => ({ div: d, ...tally[d] }));
  })() : null;
  // NECTA Centre GPA = (A×1 + B×2 + C×3 + D×4 + F×5) / total exam papers sat
  const { classGpa, classGrade } = (!isPrimary && analytics.length) ? (() => {
    const gpaMap = results.school_type === 'ADVANCED' ? GPA_MAP_ADV : GPA_MAP_ORD;
    let totalPoints = 0;
    let totalPapers = 0;
    analytics.forEach(row => {
      if (!row.sat) return;
      totalPapers += row.sat;
      Object.entries(row.gc).forEach(([g, cnt]) => {
        totalPoints += (gpaMap[g] ?? 5) * cnt;
      });
    });
    if (!totalPapers) return { classGpa: null, classGrade: null };
    const gpa = (totalPoints / totalPapers).toFixed(2);
    const g = parseFloat(gpa);
    const grade = g <= 1.50 ? 'A' : g <= 2.50 ? 'B' : g <= 3.50 ? 'C' : g <= 4.50 ? 'D' : 'F';
    return { classGpa: gpa, classGrade: grade };
  })() : { classGpa: null, classGrade: null };
  const [pdfLoading, setPdfLoading] = useState(false);

  async function handlePrint() {
    if (!stream || !assessment) return;
    setPdfLoading(true);
    try {
      const r = await apiClient.get('/academy/results/pdf/', {
        params: { assessment, stream },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `results_${stream}_${assessment}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 30000);
    } catch {
      showToast('Failed to generate PDF.', 'error');
    } finally {
      setPdfLoading(false);
    }
  }

  function handleDownloadCSV() {
    if (!results) return;
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [];

    // Title
    lines.push(`# Results \u2014 ${selectedStreamLabel} \u2014 ${selectedAssessmentName}`);
    lines.push('');

    // Section 1: Standings
    lines.push('## STUDENT STANDINGS');
    const standingsHeader = ['Rank', 'Student', 'Gender',
      ...results.subjects.map(s => subjectCodes[s]),
      'Total', 'Avg',
      ...(isPrimary ? ['Grade'] : ['Points', 'Division']),
    ];
    lines.push(standingsHeader.map(esc).join(','));
    results.students.forEach(s => {
      const row = [
        s.rank ?? '',
        s.display_name,
        s.gender || '',
        ...results.subjects.map(subj => {
          const d = s.subjects[subj];
          if (!d || d.excluded) return '';
          return d.score != null ? `${d.score}(${d.grade})` : '';
        }),
        s.total_score ?? '',
        s.average ?? '',
        ...(isPrimary ? [s.grade ?? ''] : [s.points ?? '', s.division ?? '']),
      ];
      lines.push(row.map(esc).join(','));
    });

    lines.push('');

    // Section 2: Analytics
    lines.push('## CLASS PERFORMANCE SUMMARY');
    const analyticsHeader = ['Subject', 'Sat', ...gradeLabels, 'Pass%', 'Avg', 'High', 'Low', 'GPA'];
    lines.push(analyticsHeader.map(esc).join(','));
    analytics.forEach(row => {
      lines.push([
        row.subj, row.sat,
        ...gradeLabels.map(g => row.gc[g] ?? 0),
        row.passRate, row.avg, row.high, row.low,
        row.gpa ?? '',
      ].map(esc).join(','));
    });

    if (!isPrimary && classGpa !== null) {
      lines.push('');
      lines.push([esc('Class GPA'), esc(classGpa)].join(','));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results_${selectedStreamLabel}_${selectedAssessmentName}.csv`.replace(/\s+/g, '_');
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleUnpublish() {
    setPublishLoading(true);
    try {
      await apiClient.delete('/academy/publish/', { data: { assessment, stream } });
      setIsPublished(false);
      showToast('Results unpublished.');
    } catch (e) {
      showToast(e.response?.data?.error ?? 'Failed to unpublish.', 'error');
    } finally { setPublishLoading(false); }
  }

  return (
    <div className="max-w-full px-4 py-8">
      {toast && <Toast {...toast} onClose={clearToast} />}

      {/* Subscription notice — shown to admins when school is unpaid/expired */}
      {showDownloadNotice && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong>Premium features are disabled.</strong> PDF export, CSV export, SMS dispatch, and publishing require an active subscription.
            Contact your SkuliNode administrator to activate.
          </span>
        </div>
      )}

      <PageHeader icon={BarChart2} title="Live Results" subtitle="Real-time standings as marks are collected"
        action={
          <div className="flex gap-2 flex-wrap">
            <button onClick={fetchResults} disabled={!stream || !assessment || loading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            {results && !isTeacher && (
              <>
                <button onClick={handlePrint} disabled={pdfLoading || !canDownload}
                  title={!canDownload ? 'Upgrade to Standard or Pro to download PDF' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border transition
                    ${!canDownload
                      ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed opacity-70'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50'}`}>
                  {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />} Download PDF
                  {!canDownload && <span className="ml-1 text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">Upgrade</span>}
                </button>
                <button onClick={canCSV ? handleDownloadCSV : undefined}
                  disabled={!canCSV}
                  title={!canCSV ? 'Upgrade to Standard or Pro to download CSV' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border transition
                    ${!canCSV
                      ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed opacity-70'
                      : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
                  <Download size={14} /> Download CSV
                  {!canCSV && <span className="ml-1 text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">Upgrade</span>}
                </button>
                {canSMS && (
                  <button onClick={() => setShowSMS(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition">
                    <MessageSquare size={14} /> Send SMS
                  </button>
                )}
                {isPublished ? (
                  <button onClick={handleUnpublish} disabled={publishLoading || !canDownload}
                    title={!canDownload ? 'Upgrade to Standard or Pro to manage publication' : undefined}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition
                      ${!canDownload
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-70'
                        : 'bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60'}`}>
                    {publishLoading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />} Unpublish
                    {!canDownload && <span className="ml-1 text-xs bg-slate-300 text-slate-500 px-1.5 py-0.5 rounded-full">Upgrade</span>}
                  </button>
                ) : (
                  <button onClick={() => canDownload && setShowPublish(true)}
                    disabled={!canDownload}
                    title={!canDownload ? 'Upgrade to Standard or Pro to publish results' : undefined}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition
                      ${!canDownload
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-70'
                        : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                    <Globe size={14} /> Publish Results
                    {!canDownload && <span className="ml-1 text-xs bg-slate-300 text-slate-500 px-1.5 py-0.5 rounded-full">Upgrade</span>}
                  </button>
                )}
              </>
            )}
          </div>
        }
      />

      {/* Selectors */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Stream / Class</label>
          <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 min-w-44"
            value={stream} onChange={e => { setStream(e.target.value); setResults(null); }}>
            <option value="">Select stream…</option>
            {streams.map(s => <option key={s.id} value={s.id}>{s.class_level_name} {s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Assessment</label>
          <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 min-w-44"
            value={assessment} onChange={e => { setAssessment(e.target.value); setResults(null); }}>
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

      {!loading && results && (
        <div className="space-y-5">

          {/* Publication status banner */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
            isPublished
              ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300'
              : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300'
          }`}>
            <Globe size={15} />
            {isPublished
              ? 'Results are published — teachers can view the standings.'
              : 'Results are not yet published. Teachers cannot see them.'}
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Submission Progress</h3>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{completionPct}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full mb-3">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
            </div>
            {submissionStats.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {submissionStats.map(s => {
                  const done = s.submitted_count >= s.total_students && s.total_students > 0;
                  const isUnlocking = unlockingSubject === s.subject_id;
                  return (
                    <div key={s.subject_name}
                      className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg
                        ${done ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                               : 'bg-slate-50 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                      {done ? <CheckCircle size={12} /> : <div className="w-3 h-3 rounded-full border-2 border-current opacity-40" />}
                      <span className="truncate">{s.subject_name}</span>
                      <span className="ml-auto font-mono shrink-0">{s.submitted_count}/{s.total_students}</span>
                      {done && (
                        <button
                          onClick={() => handleUnlock(s.subject_id)}
                          disabled={isUnlocking}
                          title="Unlock for teacher to correct"
                          className="ml-1 p-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 disabled:opacity-50 transition shrink-0">
                          {isUnlocking
                            ? <Loader2 size={11} className="animate-spin" />
                            : <RotateCcw size={11} />}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Results standings table ── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {selectedStreamLabel} — {selectedAssessmentName}
                <span className="text-xs font-normal text-slate-400 ml-2">({results.students.length} students)</span>
              </p>
              {results.subjects.length > 5 && (
                <span className="text-xs text-slate-400 italic">← scroll for all {results.subjects.length} subjects →</span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="text-left px-3 py-3 font-semibold text-slate-500 uppercase sticky left-0 z-10 bg-slate-50 dark:bg-slate-700/50">Rank</th>
                    <th className="text-left px-3 py-3 font-semibold text-slate-500 uppercase sticky left-10 z-10 bg-slate-50 dark:bg-slate-700/50 min-w-36">Student</th>
                    <th className="text-left px-3 py-3 font-semibold text-slate-500 uppercase">G</th>
                    {results.subjects.map(s => (
                      <th key={s} title={s} className="text-center px-3 py-3 font-semibold text-slate-500 uppercase cursor-help">
                        {subjectCodes[s]}
                      </th>
                    ))}
                    <th className="text-center px-3 py-3 font-semibold text-slate-500 uppercase">Total</th>
                    <th className="text-center px-3 py-3 font-semibold text-slate-500 uppercase">Avg</th>
                    {isPrimary ? (
                      <th className="text-center px-3 py-3 font-semibold text-slate-500 uppercase">Grade</th>
                    ) : (
                      <>
                        <th className="text-center px-3 py-3 font-semibold text-slate-500 uppercase">Pts</th>
                        <th className="text-center px-3 py-3 font-semibold text-slate-500 uppercase">Div</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {results.students.map(s => (
                    <tr key={s.student_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                      <td className="px-3 py-2.5 font-bold text-slate-400 sticky left-0 z-10 bg-white dark:bg-slate-800">{s.rank ?? '—'}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100 sticky left-10 z-10 bg-white dark:bg-slate-800">{s.display_name}</td>
                      <td className="px-3 py-2.5 text-slate-400">{s.gender}</td>
                      {results.subjects.map(subj => {
                        const d = s.subjects[subj];
                        const g = d?.grade ?? '-';
                        return (
                          <td key={subj} className={`px-3 py-2.5 text-center font-mono ${GRADE_COLOR[g] ?? ''}`}>
                            {d?.excluded ? '—' : d?.score != null ? `${d.score}(${g})` : '—'}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-200">{s.total_score ?? '—'}</td>
                      <td className="px-3 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-200">{s.average ?? '—'}</td>
                      {isPrimary ? (
                        <td className={`px-3 py-2.5 text-center font-bold ${GRADE_COLOR[s.grade] ?? ''}`}>{s.grade ?? '—'}</td>
                      ) : (
                        <>
                          <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">{s.points ?? '—'}</td>
                          <td className="px-3 py-2.5 text-center">
                            {s.division ? (
                              <span className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded-full ${DIV_COLOR[s.division] ?? 'bg-slate-100 text-slate-600'}`}>
                                {s.division}
                              </span>
                            ) : '—'}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Subject key */}
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Subject Key</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {results.subjects.map(s => (
                  <span key={s} className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{subjectCodes[s]}</span> = {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Class Analytics (NECTA-style summary) ── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
              <TrendingUp size={15} className="text-blue-500" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Class Performance Summary</p>
              <span className="text-xs text-slate-400 ml-1">— NECTA-style subject breakdown</span>
            </div>

            {/* Division counts by gender — O/A-level only */}
            {!isPrimary && divGenderSummary && divGenderSummary.length > 0 && (
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-700/20">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Division Breakdown by Gender</p>
                <div className="overflow-x-auto">
                <table className="text-xs min-w-72">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-600">
                      <th className="text-left pr-8 pb-1 font-semibold text-slate-500 uppercase">Division</th>
                      <th className="text-center px-6 pb-1 font-semibold text-blue-500 uppercase">Boys</th>
                      <th className="text-center px-6 pb-1 font-semibold text-pink-500 uppercase">Girls</th>
                      <th className="text-center px-6 pb-1 font-semibold text-slate-600 dark:text-slate-300 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divGenderSummary.map(row => (
                      <tr key={row.div} className="border-b border-slate-100 dark:border-slate-700/40">
                        <td className="pr-8 py-1">
                          <span className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded-full ${DIV_COLOR[row.div] ?? 'bg-slate-100 text-slate-600'}`}>
                            {row.div}
                          </span>
                        </td>
                        <td className="text-center px-6 py-1 font-mono text-blue-600 dark:text-blue-400">{row.M}</td>
                        <td className="text-center px-6 py-1 font-mono text-pink-600 dark:text-pink-400">{row.F}</td>
                        <td className="text-center px-6 py-1 font-mono font-semibold text-slate-700 dark:text-slate-200">{row.total}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-300 dark:border-slate-500 font-bold">
                      <td className="pr-8 py-1.5 text-slate-600 dark:text-slate-300">Total</td>
                      <td className="text-center px-6 py-1.5 font-mono text-blue-700 dark:text-blue-300">{divGenderSummary.reduce((s, r) => s + r.M, 0)}</td>
                      <td className="text-center px-6 py-1.5 font-mono text-pink-700 dark:text-pink-300">{divGenderSummary.reduce((s, r) => s + r.F, 0)}</td>
                      <td className="text-center px-6 py-1.5 font-mono text-slate-700 dark:text-slate-200">{divGenderSummary.reduce((s, r) => s + r.total, 0)}</td>
                    </tr>
                  </tbody>
                </table>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="text-left px-3 py-3 font-semibold text-slate-500 uppercase">Subject</th>
                    <th className="text-center px-3 py-3 font-semibold text-slate-500 uppercase">Sat</th>
                    {gradeLabels.map(g => (
                      <th key={g} className={`text-center px-3 py-3 font-semibold uppercase ${GRADE_COLOR[g] ?? 'text-slate-500'}`}>{g}</th>
                    ))}
                    <th className="text-center px-3 py-3 font-semibold text-slate-500 uppercase">Pass%</th>
                    <th className="text-center px-3 py-3 font-semibold text-slate-500 uppercase">Avg</th>
                    <th className="text-center px-3 py-3 font-semibold text-slate-500 uppercase">High</th>
                    <th className="text-center px-3 py-3 font-semibold text-slate-500 uppercase">Low</th>
                    <th className="text-center px-3 py-3 font-semibold text-slate-500 uppercase" title="Subject GPA — lower is better">GPA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {analytics.map((row, i) => (
                    <tr key={row.subj} className={i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-700/20'}>
                      <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-200">
                        <span className="font-bold text-slate-400 mr-1.5">{subjectCodes[row.subj]}</span>{row.subj}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-slate-600 dark:text-slate-300">{row.sat}</td>
                      {row.gradeSet.map(g => (
                        <td key={g} className={`px-3 py-2.5 text-center font-mono ${GRADE_COLOR[g] ?? ''}`}>
                          {row.gc[g] ?? 0}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-200">{row.passRate}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-slate-600 dark:text-slate-300">{row.avg}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-green-600 dark:text-green-400">{row.high}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-red-500 dark:text-red-400">{row.low}</td>
                      <td className={`px-3 py-2.5 text-center font-mono ${gpaColor(row.gpa)}`}>{row.gpa ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Class GPA for O/A level */}
            {classGpa !== null && (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 flex flex-wrap gap-3 items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Centre GPA:</span>
                <span className={`text-sm font-bold ${gpaColor(classGpa)}`}>{classGpa}</span>
                {classGrade && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${GRADE_COLOR[classGrade] ?? ''}`}>
                    Grade {classGrade}
                  </span>
                )}
                <span className="text-xs text-slate-400 italic">(lower is better · 1.00 = all A's · 5.00 = all F's)</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Publish modal */}
      {showPublish && (
        <PublishModal
          assessmentId={assessment}
          streamId={stream}
          streamLabel={selectedStreamLabel}
          assessmentName={selectedAssessmentName}
          onClose={() => setShowPublish(false)}
          onSuccess={() => { setShowPublish(false); setIsPublished(true); showToast('Results published! Teachers can now view them.'); }}
          onError={m => showToast(m, 'error')}
        />
      )}

      {/* SMS modal */}
      {showSMS && results && (
        <SMSModal
          students={results.students}
          assessmentId={assessment}
          assessmentName={selectedAssessmentName}
          streamLabel={selectedStreamLabel}
          onClose={() => setShowSMS(false)}
          showToast={showToast}
        />
      )}
    </div>
  );
}

/* ── Publish Modal ────────────────────────────────────────────────────────── */
function PublishModal({ assessmentId, streamId, streamLabel, assessmentName, onClose, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  async function confirm() {
    setLoading(true);
    try {
      await apiClient.post('/academy/publish/', { assessment: assessmentId, stream: streamId });
      onSuccess();
    } catch (e) {
      onError(e.response?.data?.error ?? 'Failed to publish.');
    } finally { setLoading(false); }
  }
  return (
    <Modal title="Publish Results" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-300">
          <p>You are about to publish results for:</p>
          <p className="font-bold mt-1">{streamLabel} — {assessmentName}</p>
          <p className="mt-2 text-xs text-blue-600">This will make results visible to teachers and enable report card printing.</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={confirm} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
            {loading && <Loader2 size={13} className="animate-spin" />}
            <Globe size={13} /> Publish
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ── SMS Modal ────────────────────────────────────────────────────────────── */
function SMSModal({ students, assessmentId, assessmentName, streamLabel, onClose, showToast }) {
  const [selected, setSelected] = useState(() => new Set(
    students.filter(s => s.parent_phone).map(s => s.student_id)
  ));
  const [sending, setSending] = useState(false);

  function toggle(id) {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function sendSMS() {
    setSending(true);
    try {
      const res = await apiClient.post('/academy/send-sms/', {
        student_ids: [...selected],
        assessment_id: assessmentId,
      });
      const { sent, failed, dry_run } = res.data;
      const dryTag = dry_run ? ' (dry run)' : '';
      showToast(`Sent ${sent} SMS${sent !== 1 ? 'es' : ''}${dryTag}${failed ? `, ${failed} failed` : ''}.`);
      onClose();
    } catch (e) {
      showToast(e.response?.data?.error ?? 'Failed to queue SMS.', 'error');
    } finally { setSending(false); }
  }

  const withPhone = students.filter(s => s.parent_phone);
  const withoutPhone = students.filter(s => !s.parent_phone);

  return (
    <Modal title="Send Results via SMS" onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Select parents to notify. Only students with a registered parent phone are shown.
        </p>

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">{selected.size} selected</span>
          <div className="flex gap-2">
            <button onClick={() => setSelected(new Set(withPhone.map(s => s.student_id)))}
              className="text-xs text-blue-600 hover:underline">Select all</button>
            <button onClick={() => setSelected(new Set())}
              className="text-xs text-slate-500 hover:underline">None</button>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
          {withPhone.map(s => (
            <label key={s.student_id} className="flex items-center gap-3 px-3 py-2 rounded-lg
              hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition">
              <input type="checkbox" className="rounded"
                checked={selected.has(s.student_id)}
                onChange={() => toggle(s.student_id)} />
              <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{s.display_name}</span>
              <span className="text-xs text-slate-400 font-mono">{s.parent_phone}</span>
            </label>
          ))}
          {withoutPhone.length > 0 && (
            <p className="text-xs text-amber-600 px-3 py-2 flex items-center gap-1">
              <AlertTriangle size={12} /> {withoutPhone.length} student(s) have no parent phone registered.
            </p>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={sendSMS} disabled={sending || selected.size === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Send to {selected.size} parent{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </Modal>
  );
}
