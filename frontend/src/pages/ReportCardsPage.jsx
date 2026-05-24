/**
 * ReportCardsPage — Admin generates & prints student report cards.
 */
import { useState, useEffect } from 'react';
import { FileText, Loader2, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { PageHeader, Toast, useToast } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/axios';

const GRADE_COMMENT = {
  A: 'Excellent', B: 'Very Good', C: 'Good', D: 'Average', F: 'Improve',
};

const GRADE_COLOR = {
  A: { bg: '#15803d', text: '#fff' },
  B: { bg: '#0369a1', text: '#fff' },
  C: { bg: '#b45309', text: '#fff' },
  D: { bg: '#c2410c', text: '#fff' },
  F: { bg: '#b91c1c', text: '#fff' },
};

function gradeFromScore(score) {
  if (score === null || score === undefined || score === '') return '-';
  const s = Number(score);
  if (s >= 75) return 'A';
  if (s >= 65) return 'B';
  if (s >= 50) return 'C';
  if (s >= 30) return 'D';
  return 'F';
}

export default function ReportCardsPage() {
  const { auth, schoolCanAccess } = useAuth();
  const [toast, showToast, clearToast] = useToast();

  const isTeacher = auth?.role === 'TEACHER';
  const showPaymentNotice = !isTeacher && !schoolCanAccess('report_cards');
  const [streams, setStreams]         = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [school, setSchool]           = useState(null);
  const [stream, setStream]           = useState('');
  const [assessment, setAssessment]   = useState('');
  const [mode, setMode]               = useState('single');
  const [combinedSelection, setCombinedSelection] = useState({});
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [missingPayload, setMissingPayload] = useState([]);
  const [treatMissingAsZero, setTreatMissingAsZero] = useState(false);
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(false);
  const [idx, setIdx]                 = useState(0);
  const [pdfLoading, setPdfLoading]   = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.get('/academy/classes/'),
      apiClient.get('/academy/assessments/'),
      apiClient.get('/school/'),
    ]).then(([s, a, sc]) => {
      setStreams(s.data.results ?? s.data);
      setAssessments(a.data.results ?? a.data);
      setSchool(sc.data);
    }).catch(() => {});
  }, []);

  const selectedCombinedAssessments = assessments
    .filter(a => combinedSelection[a.id]?.selected)
    .map(a => ({
      assessment_id: a.id,
      name: a.name,
      academic_year: a.academic_year,
      weight: Number(combinedSelection[a.id]?.weight || 0),
    }));
  const combinedWeightTotal = selectedCombinedAssessments
    .reduce((acc, item) => acc + (Number.isFinite(item.weight) ? item.weight : 0), 0);

  async function loadData() {
    if (!stream) return;
    setLoading(true);
    try {
      if (mode === 'combined') {
        const r = await apiClient.post('/academy/results/combined/', {
          stream,
          assessments: selectedCombinedAssessments.map(a => ({ assessment_id: a.assessment_id, weight: a.weight })),
          treat_missing_as_zero: false,
        });
        if (r.data?.requires_confirmation) {
          setMissingPayload(r.data.missing_marks ?? []);
          setShowMissingModal(true);
          setData(null);
          return;
        }
        setTreatMissingAsZero(false);
        setData(r.data);
      } else {
        const r = await apiClient.get(`/academy/results/?assessment=${assessment}&stream=${stream}`);
        setData(r.data);
      }
      setIdx(0);
    } catch (e) {
      showToast(e.response?.data?.error ?? 'Failed to load data.', 'error');
    }
    finally { setLoading(false); }
  }

  const selectedStreamLabel = (() => {
    const s = streams.find(x => String(x.id) === String(stream));
    return s ? s.display_label : '';
  })();
  const selectedAssessmentName = assessments.find(a => String(a.id) === String(assessment))?.name ?? '';

  function toggleCombinedAssessment(assessmentId, selected) {
    setCombinedSelection(prev => ({
      ...prev,
      [assessmentId]: {
        selected,
        weight: selected ? (prev[assessmentId]?.weight || '') : '',
      },
    }));
    setData(null);
  }

  function updateCombinedWeight(assessmentId, weight) {
    setCombinedSelection(prev => ({
      ...prev,
      [assessmentId]: {
        selected: true,
        weight,
      },
    }));
    setData(null);
  }

  async function continueWithMissingAsZero() {
    if (!stream) return;
    setShowMissingModal(false);
    setLoading(true);
    try {
      const r = await apiClient.post('/academy/results/combined/', {
        stream,
        assessments: selectedCombinedAssessments.map(a => ({ assessment_id: a.assessment_id, weight: a.weight })),
        treat_missing_as_zero: true,
      });
      setTreatMissingAsZero(true);
      setData(r.data);
      setIdx(0);
    } catch {
      showToast('Failed to load combined data.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function downloadPDF(singleStudentId = null) {
    if (!data) return;
    setPdfLoading(true);
    try {
      const payload = mode === 'combined'
        ? {
          stream,
          assessments: selectedCombinedAssessments.map(a => ({ assessment_id: a.assessment_id, weight: a.weight })),
          treat_missing_as_zero: treatMissingAsZero,
        }
        : { assessment, stream };
      if (singleStudentId) payload.student_id = singleStudentId;
      const r = await apiClient.post(
        mode === 'combined' ? '/academy/report-cards/combined/pdf/' : '/academy/report-cards/pdf/',
        payload,
        { responseType: 'blob' },
      );
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const filename = singleStudentId
        ? `report_card_${singleStudentId}.pdf`
        : mode === 'combined' ? `report_cards_combined_${stream}.pdf` : `report_cards_${stream}_${assessment}.pdf`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 30000);
    } catch { showToast('Failed to generate PDF.', 'error'); }
    finally { setPdfLoading(false); }
  }

  const students = data?.students ?? [];
  const subjects = data?.subjects ?? [];
  const currentStudent = students[idx];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {toast && <Toast {...toast} onClose={clearToast} />}

      {/* Subscription notice — shown to admins when school is unpaid/expired */}
      {showPaymentNotice && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong>PDF generation is disabled.</strong> Report card printing requires an active subscription.
            Contact your SkuliNode administrator to activate.
          </span>
        </div>
      )}

      <PageHeader icon={FileText} title="Report Cards"
        subtitle="Generate printable report cards per stream and assessment"
        action={
          data && (
            <div className="flex gap-2">
              <button onClick={() => !showPaymentNotice && downloadPDF(currentStudent?.student_id)}
                disabled={pdfLoading || showPaymentNotice}
                title={showPaymentNotice ? 'Upgrade to Standard or Pro to generate PDFs' : undefined}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border transition
                  ${showPaymentNotice
                    ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed opacity-70'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60'}`}>
                {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} This Card
                {showPaymentNotice && <span className="ml-1 text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">Upgrade</span>}
              </button>
              <button onClick={() => !showPaymentNotice && downloadPDF()}
                disabled={pdfLoading || showPaymentNotice}
                title={showPaymentNotice ? 'Upgrade to Standard or Pro to generate PDFs' : undefined}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition
                  ${showPaymentNotice
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-70'
                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60'}`}>
                {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} All Cards ({students.length})
                {showPaymentNotice && <span className="ml-1 text-xs bg-slate-300 text-slate-500 px-1.5 py-0.5 rounded-full">Upgrade</span>}
              </button>
            </div>
          )
        }
      />

      {/* Selectors */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Stream / Class</label>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 min-w-44"
            value={stream} onChange={e => { setStream(e.target.value); setData(null); }}>
            <option value="">Select class...</option>
            {streams.map(s => <option key={s.id} value={s.id}>{s.display_label}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:bg-slate-800 dark:border-slate-600">
            <button
              onClick={() => { setMode('single'); setData(null); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${mode === 'single' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-200'}`}>
              Single Assessment
            </button>
            <button
              onClick={() => { setMode('combined'); setData(null); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${mode === 'combined' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-200'}`}>
              Combined
            </button>
          </div>
        </div>
        {mode === 'single' ? (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Assessment</label>
              <select
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 min-w-44"
                value={assessment} onChange={e => { setAssessment(e.target.value); setData(null); }}>
                <option value="">Select assessment...</option>
                {assessments.map(a => <option key={a.id} value={a.id}>{a.name} ({a.academic_year})</option>)}
              </select>
            </div>
            {stream && assessment && (
              <div className="flex items-end">
                <button onClick={loadData}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
                  Generate
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="w-full rounded-xl border border-slate-200 bg-white p-4 dark:bg-slate-800 dark:border-slate-700">
            <div className="flex flex-wrap gap-3">
              {assessments.map(a => {
                const selected = Boolean(combinedSelection[a.id]?.selected);
                return (
                  <label key={a.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={e => toggleCombinedAssessment(a.id, e.target.checked)}
                    />
                    <span>{a.name} ({a.academic_year})</span>
                    {selected && (
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={combinedSelection[a.id]?.weight ?? ''}
                        onChange={e => updateCombinedWeight(a.id, e.target.value)}
                        className="w-20 rounded-md border border-slate-200 px-2 py-1 text-xs dark:bg-slate-700 dark:border-slate-600"
                        placeholder="weight"
                      />
                    )}
                    {selected && <span className="text-xs text-slate-500">%</span>}
                  </label>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className={`text-sm font-semibold ${combinedWeightTotal === 100 ? 'text-green-600' : 'text-amber-600'}`}>
                Total Weight: {combinedWeightTotal}%
              </span>
              <button
                onClick={loadData}
                disabled={!stream || selectedCombinedAssessments.length < 2 || combinedWeightTotal !== 100}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50">
                Generate
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div>}

      {!loading && data && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
            <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition">
              <ChevronLeft size={16} />
            </button>
            <span className="flex-1 text-center text-sm font-medium text-slate-700 dark:text-slate-200">
              {currentStudent?.display_name}
              <span className="text-xs text-slate-400 ml-2">{idx + 1} of {students.length}</span>
            </span>
            <button onClick={() => setIdx(Math.min(students.length - 1, idx + 1))} disabled={idx === students.length - 1}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition">
              <ChevronRight size={16} />
            </button>
          </div>

          <div>
            {students.map((student, i) => (
              <ReportCard
                key={student.student_id}
                student={student}
                subjects={subjects}
                school={school}
                schoolType={data?.school_type}
                assessmentName={mode === 'combined' ? 'Combined' : selectedAssessmentName}
                assessments={data?.assessments ?? []}
                mode={mode}
                streamLabel={selectedStreamLabel}
                isVisible={i === idx}
              />
            ))}
          </div>
        </div>
      )}

      {showMissingModal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Missing Marks Detected</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
              Some students are missing marks in selected assessments.
            </p>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              {missingPayload.map(item => (
                <div key={item.assessment_id} className="text-xs text-amber-900">
                  <p className="font-semibold">{item.assessment_name}</p>
                  <p>{item.students.join(', ')}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowMissingModal(false)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                Cancel and fix missing marks first
              </button>
              <button
                onClick={continueWithMissingAsZero}
                className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700">
                Treat missing marks as 0 and continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Professional Report Card ---- */
function ReportCard({ student, subjects, school, schoolType, assessmentName, assessments, mode, streamLabel, isVisible }) {
  const isPrimary = schoolType === 'PRIMARY';
  const scoredSubjects = subjects.filter(s => {
    const d = student.subjects[s];
    if (!d || d.excluded) return false;
    if (mode === 'combined') return d.final_score !== null && d.final_score !== undefined;
    return d.score !== null && d.score !== undefined;
  });
  const combinedLabel = mode === 'combined'
    ? assessments.map(a => `${a.name} (${a.weight}%)`).join(' | ')
    : assessmentName;

  return (
    <div
      id={`report-card-${student.student_id}`}
      style={{
        display: isVisible ? 'block' : 'none',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '11px',
        background: '#ffffff',
        maxWidth: '760px',
        margin: '0 auto',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
      }}
      className="print:block print:shadow-none print:border-0 print:rounded-none"
    >
      <div style={{ background: 'linear-gradient(90deg,#1e3a5f,#2563eb)', height: '7px' }} />

      {/* School Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 20px', borderBottom: '3px solid #c4a014', background: '#fff' }}>
        {school?.logo ? (
          <img src={school.logo} alt="Logo" style={{ width: '56px', height: '56px', objectFit: 'contain', borderRadius: '50%', border: '2px solid #1e3a5f', flexShrink: 0 }} />
        ) : (
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px solid #1e3a5f', background: '#f0f6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 'bold', color: '#1e3a5f', flexShrink: 0 }}>
            {(school?.name ?? 'S').charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '16px', fontWeight: 'bold', color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.2 }}>
            {school?.name ?? 'School Name'}
          </div>
          {(school?.region || school?.district) && (
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>
              {[school.ward, school.district, school.region].filter(Boolean).join(', ')}
            </div>
          )}
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
            {[school?.po_box ? `${school.po_box}` : null, school?.phone, school?.email].filter(Boolean).join(' | ')}
          </div>
          <div style={{ height: '2px', background: 'linear-gradient(90deg,transparent,#c4a014,transparent)', margin: '7px auto', maxWidth: '300px' }} />
          <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '13px', fontWeight: '700', color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Academic Progress Report
          </div>
        </div>
      </div>

      {/* Student Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', padding: '6px 20px', background: '#f0f6ff', borderBottom: '1px solid #dbeafe' }}>
        {[
          ['Student Name', student.display_name],
          ['Class / Stream', streamLabel],
          ['Assessment', combinedLabel],
          student.admission_number ? ['Adm. No.', student.admission_number] : null,
          student.rank ? ['Class Position', `${student.rank} / ${student.total_students}`] : null,
        ].filter(Boolean).map(([label, value]) => (
          <div key={label} style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '10px', minWidth: '90px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}:</span>
            <span style={{ fontWeight: '700', color: '#1e293b' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Marks Table */}
      <div style={{ padding: '10px 20px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: '#1e3a5f' }}>
              {[
                '#',
                'Subject',
                ...(mode === 'combined'
                  ? assessments.map(a => `${a.name} (${a.weight}%)`)
                  : ['Marks', 'Out Of']),
                ...(mode === 'combined' ? ['Final'] : []),
                'Grade',
                'Remarks',
              ].map((h, i) => (
                <th key={h} style={{ padding: '6px 8px', color: '#fff', textAlign: i <= 1 ? 'left' : 'center', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map((subj, rowIdx) => {
              const d = student.subjects[subj];
              if (!d || d.excluded || d.excluded_for_no_marks) return null;
              const g = mode === 'combined'
                ? (d.grade ?? gradeFromScore(d.final_score))
                : (d.grade ?? gradeFromScore(d.score));
              const gc = GRADE_COLOR[g] ?? { bg: '#64748b', text: '#fff' };
              return (
                <tr key={subj} style={{ background: rowIdx % 2 === 0 ? '#fff' : '#f8faff' }}>
                  <td style={{ padding: '4px 8px', color: '#94a3b8', borderBottom: '1px solid #e2e8f0', width: '28px' }}>{rowIdx + 1}</td>
                  <td style={{ padding: '4px 8px', fontWeight: '500', color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>{subj}</td>
                  {mode === 'combined' ? assessments.map(a => {
                    const score = d.assessment_scores?.[a.id];
                    return (
                      <td key={a.id} style={{ padding: '4px 8px', textAlign: 'center', fontFamily: '"Courier New",monospace', fontWeight: '700', color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>
                        {score == null ? '0' : score}
                      </td>
                    );
                  }) : (
                    <>
                      <td style={{ padding: '4px 8px', textAlign: 'center', fontFamily: '"Courier New",monospace', fontWeight: '700', color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>{d.score ?? '-'}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'center', color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>100</td>
                    </>
                  )}
                  {mode === 'combined' && (
                    <td style={{ padding: '4px 8px', textAlign: 'center', fontFamily: '"Courier New",monospace', fontWeight: '700', color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>
                      {d.final_score == null ? '-' : Number(d.final_score).toFixed(2)}
                    </td>
                  )}
                  <td style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ background: gc.bg, color: gc.text, padding: '2px 10px', borderRadius: '4px', fontWeight: '700', display: 'inline-block' }}>{g}</span>
                  </td>
                  <td style={{ padding: '4px 8px', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                    {mode === 'combined' ? (d.remarks ?? '-') : (GRADE_COMMENT[g] ?? '-')}
                  </td>
                </tr>
              );
            })}
            <tr style={{ background: '#1e3a5f', color: '#fff', fontWeight: '700' }}>
              <td colSpan={2} style={{ padding: '6px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {mode === 'combined' ? 'Average' : 'Total'}
              </td>
              {mode === 'combined' ? (
                <>
                {assessments.map(a => {
                  const rawAverage = student.assessment_averages?.[a.id]?.raw_average;
                  return (
                    <td key={a.id} style={{ padding: '6px 8px', textAlign: 'center', fontFamily: '"Courier New",monospace' }}>
                      {rawAverage == null ? '-' : Number(rawAverage).toFixed(2)}
                    </td>
                  );
                })}
                <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: '"Courier New",monospace' }}>
                  {student.average == null ? '-' : Number(student.average).toFixed(2)}
                </td>
                </>
              ) : (
                <>
                  <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: '"Courier New",monospace' }}>{student.total_score ?? '-'}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', opacity: 0.7 }}>{student.total_possible ?? scoredSubjects.length * 100}</td>
                </>
              )}
              {isPrimary ? (
                <>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    {student.grade ? (
                      <span style={{ background: (GRADE_COLOR[student.grade] ?? { bg: '#64748b' }).bg, color: '#fff', padding: '2px 10px', borderRadius: '4px', fontWeight: '700', display: 'inline-block' }}>{student.grade}</span>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    {mode === 'combined' ? (student.grade_remarks ?? '-') : `Avg: ${student.average ?? '-'}`}
                  </td>
                </>
              ) : (
                <>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>{mode === 'combined' ? (student.grade ?? '-') : `Avg: ${student.average ?? '-'}`}</td>
                  <td style={{ padding: '6px 8px' }}>
                    {mode === 'combined'
                      ? `Pts: ${student.points ?? '-'} | Div: ${student.division ?? '-'}`
                      : `Pts: ${student.points ?? '-'} | Div: ${student.division ?? '-'}`}
                  </td>
                </>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Ranking */}
      {student.rank && (
        <div style={{ margin: '8px 20px', padding: '6px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '4px solid #c4a014', borderRadius: '0 6px 6px 0', color: '#1e293b', fontSize: '11px' }}>
          Amekuwa nafasi ya <strong>{student.rank}</strong> kati ya wanafunzi <strong>{student.total_students}</strong>,
          akiwa na wastani wa alama <strong>{student.average}</strong>
          {isPrimary
            ? ` — Daraja: ${student.grade ?? '-'} (${student.grade_remarks ?? '-'}).`
            : ` — Alama: ${student.points ?? '-'}, Daraja: ${student.division ?? '-'}.`}
        </div>
      )}

      {/* Staff Sections — 2-column: comment (wider) + signature side by side */}
      <div style={{ margin: '8px 20px 10px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
        {[
          'Mwalimu wa Darasa',
          'Mwalimu wa Masomo',
          'Mkuu wa Shule',
        ].map(label => (
          <div key={label} style={{ border: '1px solid #e2e8f0', borderRadius: '5px', padding: '6px 10px', background: '#fafafa', marginBottom: '5px' }}>
            <div style={{ fontSize: '9px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>{label}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '8px', color: '#94a3b8', marginBottom: '2px' }}>Maoni / Comment:</div>
                <div style={{ borderBottom: '1px dashed #cbd5e1', height: '18px' }} />
              </div>
              <div>
                <div style={{ fontSize: '8px', color: '#94a3b8', marginBottom: '2px' }}>Sahihi / Signature:</div>
                <div style={{ borderBottom: '1.5px solid #334155', height: '18px' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: 'linear-gradient(90deg,#1e3a5f,#2563eb)', height: '5px' }} />
    </div>
  );
}


