/**
 * MarkEntryPage — Teacher view.
 * Shows the teacher's subject assignments as cards.
 * Clicking a card opens the mark entry console for that assignment.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, ChevronLeft, Printer, Send, Save, RefreshCw, Loader2,
  CheckCircle, AlertTriangle, UserCheck, Download, RotateCcw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Toast, useToast, Modal, PageHeader } from '../components/ui';
import apiClient from '../api/axios';

// ── NECTA grade helpers ───────────────────────────────────────────────────────
// Fallback hardcoded thresholds (used when no custom configs are loaded yet)
function grade(score) {
  if (score === null || score === '' || isNaN(Number(score))) return '-';
  const s = Number(score);
  if (s >= 75) return 'A';
  if (s >= 65) return 'B';
  if (s >= 45) return 'C';
  if (s >= 30) return 'D';
  return 'F';
}

// Config-driven grade lookup — falls back to hardcoded when configs not loaded
function gradeFromConfigs(score, configs) {
  if (score === null || score === '' || isNaN(Number(score))) return '-';
  if (!configs || configs.length === 0) return grade(score);
  const s = Number(score);
  const sorted = [...configs].sort((a, b) => b.min_score - a.min_score);
  for (const cfg of sorted) {
    if (s >= cfg.min_score) return cfg.grade_label;
  }
  return sorted[sorted.length - 1]?.grade_label ?? '-';
}
const GPA = { A: 1, B: 2, C: 3, D: 4, F: 5 };
const GRADE_COLOR = {
  A: 'text-green-600 font-bold', B: 'text-teal-600 font-bold',
  C: 'text-yellow-600 font-bold', D: 'text-orange-500 font-bold',
  E: 'text-purple-600 font-bold',
  F: 'text-red-600 font-bold', '-': 'text-slate-300',
};
const GRADE_BG = {
  A: 'bg-green-500', B: 'bg-teal-500', C: 'bg-yellow-500',
  D: 'bg-orange-500', E: 'bg-purple-500', F: 'bg-red-500',
};

// ── Simple inline bar chart ───────────────────────────────────────────────────
function GradeBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-4 font-bold text-slate-600 dark:text-slate-300">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-5 text-right text-slate-500 dark:text-slate-400">{value}</span>
    </div>
  );
}

// ── Mini donut SVG ────────────────────────────────────────────────────────────
function DonutChart({ data, total, gradeLabels }) {
  const PALETTE = { A: '#16a34a', B: '#0d9488', C: '#ca8a04', D: '#ea580c', E: '#7c3aed', F: '#dc2626' };
  const keys = gradeLabels ?? ['A', 'B', 'C', 'D', 'F'];
  if (!total) return <div className="w-20 h-20 rounded-full border-4 border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs text-slate-400">—</div>;
  const R = 30, CX = 40, CY = 40, stroke = 12;
  const circumference = 2 * Math.PI * R;
  let offset = 0;
  const segments = keys.map((k) => {
    const val = data[k] || 0;
    const dash = (val / total) * circumference;
    const gap = circumference - dash;
    const seg = { key: k, dasharray: `${dash} ${gap}`, dashoffset: -offset, color: PALETTE[k] ?? '#94a3b8' };
    offset += dash;
    return seg;
  });
  return (
    <svg width={80} height={80} viewBox="0 0 80 80">
      {segments.map(s => (
        <circle key={s.key} cx={CX} cy={CY} r={R} fill="none"
          stroke={s.color} strokeWidth={stroke}
          strokeDasharray={s.dasharray} strokeDashoffset={s.dashoffset}
          style={{ transform: 'rotate(-90deg)', transformOrigin: `${CX}px ${CY}px` }} />
      ))}
      <text x={CX} y={CY + 4} textAnchor="middle" fontSize={11} fill="#64748b" fontWeight="bold">{total}</text>
    </svg>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MarkEntryPage() {
  const { auth } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null); // selected assignment
  const [toast, showToast, clearToast] = useToast();

  useEffect(() => {
    apiClient.get('/academy/my-assignments/')
      .then(r => setAssignments(r.data.results ?? r.data))
      .catch(() => showToast('Failed to load assignments.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (active) {
    return (
      <MarkConsole
        assignment={active}
        onBack={() => setActive(null)}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {toast && <Toast {...toast} onClose={clearToast} />}
      <PageHeader icon={UserCheck} title="My Subjects" subtitle="Click a subject to enter marks" />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <BookOpen size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No subject assignments yet. Ask your admin to assign subjects to you.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {assignments.map(a => (
            <button key={a.id} onClick={() => setActive(a)}
              className="flex flex-col items-start gap-2 bg-white dark:bg-slate-800 rounded-xl
                border border-slate-200 dark:border-slate-700 p-5
                hover:border-blue-400 hover:shadow-sm transition text-left group">
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2.5 group-hover:bg-blue-100 transition">
                <BookOpen size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{a.subject_name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{a.stream_label} · {a.academic_year}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mark Entry Console ────────────────────────────────────────────────────────
function MarkConsole({ assignment, onBack, showToast }) {
  const { auth, schoolCanAccess, refreshSchoolPayment } = useAuth();
  const isAdmin = auth?.role === 'ADMIN' || (auth?.roles ?? []).includes('ADMIN');
  const canPDF = schoolCanAccess('subject_pdf');
  const canCSV = schoolCanAccess('subject_csv');
  const [assessments, setAssessments] = useState([]);
  const [gradeConfigs, setGradeConfigs] = useState([]);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [pdfLoading, setPdfLoading]   = useState(false);
  const [invalidScores, setInvalidScores] = useState(new Set());

  // Refresh payment status on mount so Django admin toggles are picked up without re-login
  useEffect(() => { refreshSchoolPayment(); }, []);

  // Load active assessments and school grade configs
  useEffect(() => {
    Promise.all([
      apiClient.get('/academy/assessments/'),
      apiClient.get('/academy/grade-configs/'),
    ]).then(([assessRes, gcRes]) => {
      const all = assessRes.data.results ?? assessRes.data;
      setAssessments(all.filter(a => a.is_active));
      setGradeConfigs(gcRes.data.results ?? gcRes.data);
    }).catch(() => showToast('Failed to load assessments.', 'error'));
  }, []);

  // Load students + marks when assessment selected
  const loadMarks = useCallback(async (assessmentId) => {
    if (!assessmentId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(
        `/academy/marks/?subject=${assignment.subject}&stream=${assignment.stream}&assessment=${assessmentId}`
      );
      setRows((res.data.results ?? res.data).map(r => ({ ...r, score: r.score ?? '' })));
    } catch { showToast('Failed to load students.', 'error'); }
    finally { setLoading(false); }
  }, [assignment]);

  async function handleSave() {
    if (invalidScores.size > 0) {
      showToast('Some scores are out of range (0–100). Please correct them first.', 'error');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/academy/marks/bulk/', {
        subject: assignment.subject,
        assessment: selectedAssessment,
        stream: assignment.stream,
        marks: rows.map(r => ({ student_id: r.student_id, score: r.score === '' ? null : r.score })),
      });
      showToast('Marks saved.');
    } catch { showToast('Failed to save marks.', 'error'); }
    finally { setSaving(false); }
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      await handleSave();
      await apiClient.post('/academy/marks/submit/', {
        subject: assignment.subject,
        assessment: selectedAssessment,
        stream: assignment.stream,
      });
      showToast('Marks submitted successfully.');
      loadMarks(selectedAssessment);
    } catch { showToast('Failed to submit.', 'error'); }
    finally { setSaving(false); setConfirmSubmit(false); }
  }

  function updateScore(studentId, val) {
    const num = Number(val);
    const isInvalid = val !== '' && (isNaN(num) || num < 0 || num > 100);
    setInvalidScores(prev => {
      const next = new Set(prev);
      if (isInvalid) next.add(studentId);
      else next.delete(studentId);
      return next;
    });
    setRows(prev => prev.map(r => r.student_id === studentId ? { ...r, score: val } : r));
  }

  // ── Live stats ──────────────────────────────────────────────────────────────
  const gradeLabels = gradeConfigs.length > 0
    ? [...gradeConfigs].sort((a, b) => b.min_score - a.min_score).map(c => c.grade_label)
    : ['A', 'B', 'C', 'D', 'F'];
  const failLabel = gradeLabels[gradeLabels.length - 1];
  const gpaMap = gradeConfigs.length > 0
    ? Object.fromEntries(gradeConfigs.map(c => [c.grade_label, c.points]))
    : { A: 1, B: 2, C: 3, D: 4, F: 5 };

  const stats = (() => {
    const graded = rows.filter(r => r.score !== '' && !isNaN(Number(r.score)));
    const dist = Object.fromEntries(gradeLabels.map(g => [g, 0]));
    const gender = {
      M: { dist: Object.fromEntries(gradeLabels.map(g => [g, 0])), sum: 0, n: 0 },
      F: { dist: Object.fromEntries(gradeLabels.map(g => [g, 0])), sum: 0, n: 0 },
    };
    let gpas = 0;
    graded.forEach(r => {
      const g = gradeFromConfigs(r.score, gradeConfigs);
      if (g !== '-') {
        if (dist[g] !== undefined) dist[g]++;
        gpas += gpaMap[g] || 0;
        const gk = (r.gender === 'M' || r.gender === 'Male') ? 'M' : 'F';
        if (gender[gk].dist[g] !== undefined) gender[gk].dist[g]++;
        gender[gk].sum += Number(r.score);
        gender[gk].n++;
      }
    });
    const n = graded.length;
    const avgScore = n ? (graded.reduce((s, r) => s + Number(r.score), 0) / n).toFixed(1) : null;
    const avgGpa = n ? (gpas / n).toFixed(2) : null;
    const passCount = gradeLabels.filter(g => g !== failLabel).reduce((s, g) => s + dist[g], 0);
    const passRate = n ? Math.round((passCount / n) * 100) : null;
    const mAvg = gender.M.n ? (gender.M.sum / gender.M.n).toFixed(1) : null;
    const fAvg = gender.F.n ? (gender.F.sum / gender.F.n).toFixed(1) : null;
    const mPassCount = gradeLabels.filter(g => g !== failLabel).reduce((s, g) => s + gender.M.dist[g], 0);
    const fPassCount = gradeLabels.filter(g => g !== failLabel).reduce((s, g) => s + gender.F.dist[g], 0);
    const mPass = gender.M.n ? Math.round((mPassCount / gender.M.n) * 100) : null;
    const fPass = gender.F.n ? Math.round((fPassCount / gender.F.n) * 100) : null;
    return { dist, gradeLabels, avgScore, avgGpa, passRate, n, total: rows.length, gender, mAvg, fAvg, mPass, fPass };
  })();

  const isAllSubmitted = rows.length > 0 && rows.every(r => r.is_submitted);
  const isAnyReturned  = rows.some(r => r.is_returned);

  async function handlePrint() {
    if (!selectedAssessment) return;
    setPdfLoading(true);
    try {
      const r = await apiClient.get('/academy/marks/pdf/', {
        params: { subject: assignment.subject, stream: assignment.stream, assessment: selectedAssessment },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `marksheet_${assignment.subject}_${assignment.stream}_${selectedAssessment}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 30000);
    } catch { showToast('Failed to generate PDF.', 'error'); }
    finally { setPdfLoading(false); }
  }

  function handleDownloadCSV() {
    const assessmentName = assessments.find(a => a.id === selectedAssessment)?.name ?? '';
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['#', 'Student Name', 'Gender', 'Score /100', 'Grade', 'Status'];
    const dataRows = rows.map((r, i) => [
      i + 1,
      r.student_name,
      r.gender === 'M' ? 'Male' : r.gender === 'F' ? 'Female' : (r.gender || ''),
      r.score !== '' && r.score !== null ? r.score : '',
      gradeFromConfigs(r.score, gradeConfigs),
      r.is_submitted ? 'Submitted' : 'Draft',
    ]);
    const lines = [
      `# ${assignment.subject_name} \u2014 ${assignment.stream_label} \u2014 ${assessmentName}`,
      header.map(esc).join(','),
      ...dataRows.map(row => row.map(esc).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${assignment.subject_name}_${assignment.stream_label}_${assessmentName}.csv`.replace(/\s+/g, '_');
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition">
          <ChevronLeft size={16} /> Back
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {assignment.subject_name} — {assignment.stream_label}
          </h1>
          <p className="text-xs text-slate-400">{assignment.academic_year}</p>
        </div>
      </div>

      {/* Returned-by-admin banner */}
      {isAnyReturned && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 mb-5">
          <RotateCcw size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Marks Returned for Correction</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              An admin has unlocked these marks. Edit the scores and re-submit when ready.
            </p>
          </div>
        </div>
      )}

      {/* Assessment selector */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-4 mb-5 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-slate-500 mb-1">Select Assessment</label>
          {assessments.length === 0 ? (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle size={13} /> No active assessments. Ask admin to activate one.
            </p>
          ) : (
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none
                focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
              value={selectedAssessment ?? ''}
              onChange={e => {
                const v = e.target.value;
                setSelectedAssessment(v ? Number(v) : null);
                if (v) loadMarks(Number(v));
              }}
            >
              <option value="">Choose assessment…</option>
              {assessments.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.academic_year})</option>
              ))}
            </select>
          )}
        </div>

        {selectedAssessment && rows.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleSave} disabled={saving || isAllSubmitted || invalidScores.size > 0}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg
                border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
              title={invalidScores.size > 0 ? 'Fix out-of-range scores first' : ''}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Draft
            </button>
            {(canPDF || isAdmin) && (
              <button onClick={canPDF ? handlePrint : undefined} disabled={pdfLoading || !canPDF}
                title={!canPDF && isAdmin ? 'Upgrade to Basic or higher to download PDF' : undefined}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition
                  ${!canPDF
                    ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed opacity-70'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60'}`}>
                {pdfLoading ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />} PDF
                {!canPDF && isAdmin && <span className="ml-1 text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">Upgrade</span>}
              </button>
            )}
            {(canCSV || isAdmin) && (
              <button onClick={canCSV ? handleDownloadCSV : undefined} disabled={!canCSV}
                title={!canCSV && isAdmin ? 'Upgrade to Standard or Pro to download CSV' : undefined}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition
                  ${!canCSV
                    ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed opacity-70'
                    : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
                <Download size={13} /> CSV
                {!canCSV && isAdmin && <span className="ml-1 text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">Upgrade</span>}
              </button>
            )}
            <button onClick={() => setConfirmSubmit(true)} disabled={saving || isAllSubmitted || invalidScores.size > 0}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg
                bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
              title={invalidScores.size > 0 ? 'Fix out-of-range scores first' : ''}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : isAnyReturned ? <RotateCcw size={13} /> : <Send size={13} />}
              {isAllSubmitted ? 'Submitted ✓' : isAnyReturned ? 'Re-submit' : 'Submit'}
            </button>
          </div>
        )}
      </div>

      {!selectedAssessment ? null : loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No students found for this stream/subject.</div>
      ) : (
        <div className="space-y-5">
          {/* Mark entry table */}
          <div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-120">
                <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Student Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">G</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-28">Score /100</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Grade</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {rows.map((r, i) => {
                    const g = gradeFromConfigs(r.score, gradeConfigs);
                    return (
                      <tr key={r.student_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                        <td className="px-4 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">{r.student_name}</td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">{r.gender}</td>
                        <td className="px-4 py-2.5">
                          {r.is_submitted ? (
                            <span className="text-slate-600 dark:text-slate-300 font-mono">{r.score ?? '—'}</span>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <input
                                type="number" min="0" max="100" step="0.5"
                                value={r.score}
                                onChange={e => updateScore(r.student_id, e.target.value)}
                                className={`w-20 border rounded px-2 py-1 text-sm text-center outline-none focus:ring-2
                                  dark:bg-slate-700 dark:text-slate-100 transition
                                  ${invalidScores.has(r.student_id)
                                    ? 'border-red-400 bg-red-50 focus:ring-red-300 dark:bg-red-900/20 dark:border-red-500'
                                    : 'border-slate-200 dark:border-slate-600 focus:ring-blue-400'}`}
                                placeholder="0-100"
                              />
                              {invalidScores.has(r.student_id) && (
                                <span className="text-[10px] text-red-500 leading-tight">0–100 only</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className={`px-4 py-2.5 text-sm ${GRADE_COLOR[g] ?? ''}`}>{g}</td>
                        <td className="px-4 py-2.5">
                          {r.is_submitted
                            ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle size={12} /> Submitted</span>
                            : r.is_returned
                              ? <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-semibold"><RotateCcw size={12} /> Returned</span>
                              : <span className="text-xs text-slate-400">Draft</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </div>

          {/* Live analytics panel */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Live Class Analysis — {assignment.subject_name}
            </h3>

            {/* Summary stats + overall donut */}
            <div className="flex flex-wrap gap-6 items-start">
              <DonutChart data={stats.dist} total={stats.n} gradeLabels={stats.gradeLabels} />
              <div className="flex-1 min-w-48 space-y-2">
                {stats.gradeLabels.map(g => (
                  <GradeBar key={g} label={g} value={stats.dist[g]} max={stats.total} color={GRADE_BG[g] ?? 'bg-slate-400'} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <Stat label="Entries" value={`${stats.n} / ${stats.total}`} />
                <Stat label="Class Avg" value={stats.avgScore ?? '—'} />
                <Stat label="Mean GPA" value={stats.avgGpa ?? '—'} />
                <Stat label="Pass Rate" value={stats.passRate !== null ? `${stats.passRate}%` : '—'} />
              </div>
            </div>

            {/* Gender breakdown */}
            {(stats.gender.M.n > 0 || stats.gender.F.n > 0) && (
              <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Gender Breakdown</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Boys */}
                  <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Boys ({stats.gender.M.n})</span>
                      <span className="text-xs text-blue-600 dark:text-blue-400">
                        Avg: <strong>{stats.mAvg ?? '—'}</strong> · Pass: <strong>{stats.mPass !== null ? `${stats.mPass}%` : '—'}</strong>
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {stats.gradeLabels.map(g => (
                        <GradeBar key={g} label={g} value={stats.gender.M.dist[g]} max={stats.gender.M.n || 1} color={GRADE_BG[g] ?? 'bg-slate-400'} />
                      ))}
                    </div>
                  </div>
                  {/* Girls */}
                  <div className="bg-pink-50 dark:bg-pink-900/10 rounded-lg border border-pink-100 dark:border-pink-800 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-pink-700 dark:text-pink-400 uppercase tracking-wide">Girls ({stats.gender.F.n})</span>
                      <span className="text-xs text-pink-600 dark:text-pink-400">
                        Avg: <strong>{stats.fAvg ?? '—'}</strong> · Pass: <strong>{stats.fPass !== null ? `${stats.fPass}%` : '—'}</strong>
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {stats.gradeLabels.map(g => (
                        <GradeBar key={g} label={g} value={stats.gender.F.dist[g]} max={stats.gender.F.n || 1} color={GRADE_BG[g] ?? 'bg-slate-400'} />
                      ))}
                    </div>
                  </div>
                </div>
                 <br /><br />
                {/* Comparison row */}
                {stats.gender.M.n > 0 && stats.gender.F.n > 0 && (
                  <div className="mt-5 grid grid-cols-4 p-3 gap-2 bg-blue-100 dark:bg-blue-900/10 rounded-2xl text-center text-xs">
                    
                    {[
                      ['Avg Score', stats.mAvg ?? '—', stats.fAvg ?? '—', stats.mAvg && stats.fAvg ? `${Math.abs(Number(stats.mAvg)-Number(stats.fAvg)).toFixed(1)} pts` : '—'],
                      ['Pass Rate', stats.mPass !== null ? `${stats.mPass}%` : '—', stats.fPass !== null ? `${stats.fPass}%` : '—', stats.mPass !== null && stats.fPass !== null ? `${Math.abs(stats.mPass - stats.fPass)}%` : '—'],
                    ].map(([label, m, f, gap]) => (
                      <>
                        <div key={label+'-l'} className="col-span-1 text-left font-semibold text-slate-500 dark:text-slate-400 flex items-center">{label}</div>
                        <div key={label+'-m'} className="font-bold text-blue-600 dark:text-blue-400">{m}</div>
                        <div key={label+'-f'} className="font-bold text-pink-600 dark:text-pink-400">{f}</div>
                        <div key={label+'-g'} className="text-slate-500 dark:text-slate-400">{gap}</div>
                      </>
                    ))}
                    <div className="col-span-1" />
                    <div className="text-[10px] text-slate-400">Boys</div>
                    <div className="text-[10px] text-slate-400">Girls</div>
                    <div className="text-[10px] text-slate-400">Gap</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm submit dialog */}
      {confirmSubmit && (
        <Modal title="Confirm Submission" onClose={() => setConfirmSubmit(false)}>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
            Are you sure you want to <strong>submit marks</strong> for <em>{assignment.subject_name} — {assignment.stream_label}</em>?
            <br />
            <span className="text-xs text-slate-400 mt-1 block">This will lock the marks. You won't be able to edit them after submission.</span>
          </p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setConfirmSubmit(false)}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              {saving && <Loader2 size={13} className="animate-spin" />}
              Yes, Submit Marks
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-bold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}
