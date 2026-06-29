/**
 * CommentsPage — Per-role comment management after results are published.
 * Each role sees their students' results and manages comments per student.
 * Route: /:schoolSlug/comments
 */
import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Settings, Loader2, ChevronDown, ChevronUp, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { PageHeader, Toast, useToast } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useComments } from '../hooks/useComments';
import apiClient from '../api/axios';
import StudentCommentModal from '../components/StudentCommentModal';
import CommentSettingsModal from '../components/CommentSettingsModal';

const ROLE_LABEL_MAP = {
  ADMIN:     'academic_master',
  TEACHER:  'class_teacher',
};

const GRADE_COLOR = {
  A: '#15803d', B: '#0369a1', C: '#b45309', D: '#c2410c', F: '#b91c1c',
};

export default function CommentsPage() {
  const { auth } = useAuth();
  const { generateComments, getComments, loading: genLoading } = useComments();
  const [toast, showToast, clearToast] = useToast();

  const userRole = ROLE_LABEL_MAP[auth?.role] ?? 'class_teacher';

  const [streams,     setStreams]     = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [stream,      setStream]      = useState('');
  const [assessment,  setAssessment]  = useState('');

  const [results,     setResults]     = useState([]);
  const [comments,    setComments]    = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  const [selectedStudent,   setSelectedStudent]   = useState(null);
  const [showCommentModal,  setShowCommentModal]  = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [generating,        setGenerating]        = useState(false);
  const [classMasterStreams, setClassMasterStreams] = useState([]);
  const [commentMode,       setCommentMode]        = useState('single');
  const [snapshots,         setSnapshots]          = useState([]);
  const [selectedSnapshot,  setSelectedSnapshot]   = useState('');
  const [snapshotStudents,  setSnapshotStudents]   = useState([]);

  useEffect(() => {
    const calls = [
      apiClient.get('/academy/classes/'),
      apiClient.get('/academy/assessments/'),
    ];
    if (auth?.role === 'TEACHER') calls.push(apiClient.get('/academy/my-class-master-streams/'));
    Promise.all(calls).then(([s, a, cm]) => {
      setStreams(s.data.results ?? s.data);
      setAssessments((a.data.results ?? a.data).filter(x => !x.is_active === false || true));
      if (cm) setClassMasterStreams((cm.data ?? []).map(x => Number(x.stream_id)));
    });
  }, []);

  useEffect(() => {
    if (!stream) { setSnapshots([]); return; }
    apiClient.get(`/academy/combined-snapshots/?stream=${stream}`)
      .then(r => setSnapshots(r.data))
      .catch(() => setSnapshots([]));
  }, [stream]);

  const load = useCallback(async () => {
    if (commentMode === 'combined') {
      if (!selectedSnapshot) return;
      setLoadingData(true);
      try {
        const [snapDetail, c] = await Promise.all([
          apiClient.get(`/academy/combined-snapshots/${selectedSnapshot}/`),
          apiClient.get(`/academy/comments/list/?snapshot=${selectedSnapshot}&role=${userRole}`),
        ]);
        setSnapshotStudents(snapDetail.data.students ?? []);
        setResults(snapDetail.data.students ?? []);
        setComments(c.data);
      } catch {
        showToast('Imeshindwa kupakia data.', 'error');
      } finally {
        setLoadingData(false);
      }
      return;
    }
    if (!stream || !assessment) return;
    setLoadingData(true);
    try {
      const [r, c] = await Promise.all([
        apiClient.get(`/academy/results/?assessment=${assessment}&stream=${stream}`),
        apiClient.get(`/academy/comments/list/?assessment=${assessment}&stream=${stream}&role=${userRole}`),
      ]);
      setResults(r.data.students ?? []);
      setComments(c.data);
    } catch {
      showToast('Failed to load data.', 'error');
    } finally {
      setLoadingData(false);
    }
  }, [stream, assessment, userRole, commentMode, selectedSnapshot]);

  useEffect(() => { load(); }, [load]);

  const commentsMap = Object.fromEntries(
    comments.map(c => [c.student, c])
  );

  async function handleGenerateAll() {
    setGenerating(true);
    try {
      const params = commentMode === 'combined'
        ? { stream, role: userRole, overwriteManual: false, snapshot: selectedSnapshot }
        : { stream, assessment, role: userRole, overwriteManual: false };
      const r = await generateComments(params);
      showToast(`Generated ${r.generated} comments. ${r.skipped_manual} manual comments kept.`, 'success');
      await load();
    } catch {
      showToast('Failed to generate comments.', 'error');
    } finally {
      setGenerating(false);
    }
  }

  function openStudent(student) {
    setSelectedStudent(student);
    setShowCommentModal(true);
  }

  const canWriteComments = auth?.role === 'ADMIN'
    || (auth?.role === 'TEACHER' && classMasterStreams.includes(Number(stream)));

  const totalStudents   = results.length;
  const commentedCount  = results.filter(s => commentsMap[s.student_id]).length;
  const manualCount     = comments.filter(c => c.is_manual).length;
  const autoCount       = commentedCount - manualCount;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {toast && <Toast {...toast} onClose={clearToast} />}

      <PageHeader
        icon={MessageSquare}
        title="Maoni ya Wanafunzi"
        subtitle="Simamia maoni ya ripoti kwa kila mwanafunzi"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
              <Settings size={14}/> Mipangilio
            </button>
            {stream && assessment && canWriteComments && (
              <button
                onClick={handleGenerateAll}
                disabled={generating}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition">
                {generating ? <Loader2 size={14} className="animate-spin"/> : <RotateCcw size={14}/>}
                Tengeneza Maoni Yote
              </button>
            )}
          </div>
        }
      />

      {/* Mode toggle */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:bg-slate-800 dark:border-slate-600 mb-4">
        <button onClick={() => { setCommentMode('single'); setResults([]); setSelectedSnapshot(''); }}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition ${commentMode === 'single' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-200'}`}>
          Tathmini Moja
        </button>
        <button onClick={() => { setCommentMode('combined'); setResults([]); setAssessment(''); }}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition ${commentMode === 'combined' ? 'bg-green-600 text-white' : 'text-slate-600 dark:text-slate-200'}`}>
          Matokeo ya Pamoja
        </button>
      </div>

      {/* Selectors */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Darasa</label>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 min-w-44"
            value={stream} onChange={e => { setStream(e.target.value); setResults([]); }}>
            <option value="">Chagua darasa...</option>
            {streams.map(s => <option key={s.id} value={s.id}>{s.display_label}</option>)}
          </select>
        </div>
        {commentMode !== 'combined' && 
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Tathmini</label>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 min-w-44"
            value={assessment} onChange={e => { setAssessment(e.target.value); setResults([]); }}>
            <option value="">Chagua tathmini...</option>
            {assessments.map(a => <option key={a.id} value={a.id}>{a.name} ({a.academic_year})</option>)}
          </select>
        </div>
        }
        {commentMode === 'combined' && stream && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Matokeo Yaliyohifadhiwa</label>
            <select value={selectedSnapshot}
              onChange={e => { setSelectedSnapshot(e.target.value); setResults([]); }}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 min-w-64">
              <option value="">Chagua matokeo ya pamoja...</option>
              {snapshots.map(s => (
                <option key={s.id} value={s.id}>{s.name} · {s.student_count} wanafunzi</option>
              ))}
            </select>
          </div>
        )}
        {commentMode === 'combined' && stream && snapshots.length === 0 && (
          <p className="text-xs text-amber-600 py-2">
            Hakuna matokeo ya pamoja yaliyohifadhiwa kwa darasa hili.
            Chapisha matokeo ya pamoja kwanza ukurasa wa matokeo.
          </p>
        )}
      </div>

      {/* Class master warning for teachers */}
      {auth?.role === 'TEACHER' && stream && !canWriteComments && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0"/>
          <span>
            Huna ruhusa ya kuandika maoni kwa darasa hili.
            Msimamizi anahitaji kukupewa nafasi ya Mwalimu wa Darasa kwanza.
          </span>
        </div>
      )}

      {/* Stats bar */}
      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Wanafunzi', value: totalStudents, color: '#185FA5' },
            { label: 'Maoni Yaliyoandikwa', value: commentedCount, color: '#0F6E56' },
            { label: 'Yasiyo na Maoni', value: totalStudents - commentedCount, color: '#A32D2D' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="text-xs text-slate-500 mb-1">{s.label}</div>
              <div className="text-2xl font-semibold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {loadingData && (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-blue-500"/>
        </div>
      )}

      {!loadingData && results.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Jina</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Wastani</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Daraja</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Maoni</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Hali</th>
              </tr>
            </thead>
            <tbody>
              {results.map((student, i) => {
                const comment = commentsMap[student.student_id];
                const grade   = student.grade || '-';
                return (
                  <tr
                    key={student.student_id}
                    onClick={() => openStudent(student)}
                    className="border-b border-slate-100 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700/50 cursor-pointer transition">
                    <td className="px-4 py-3 text-slate-400 text-xs">{student.rank ?? i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{student.display_name}</td>
                    <td className="px-4 py-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-200">
                      {student.average ?? '–'}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-white text-xs font-bold"
                        style={{ background: GRADE_COLOR[grade] ?? '#64748b' }}>
                        {grade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">
                      {comment ? comment.comment_text : <span className="italic text-slate-300">Hakuna maoni</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {comment ? (
                        comment.is_manual
                          ? <span className="flex items-center justify-center gap-1 text-xs text-amber-600"><AlertCircle size={12}/> Mkono</span>
                          : <span className="flex items-center justify-center gap-1 text-xs text-green-600"><CheckCircle2 size={12}/> Auto</span>
                      ) : (
                        <span className="text-xs text-slate-300">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loadingData && stream && assessment && results.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-sm">
          Hakuna matokeo. Hakikisha matokeo yamechapishwa kwanza.
        </div>
      )}

      {showCommentModal && selectedStudent && (
        <StudentCommentModal
          student={selectedStudent}
          assessment={commentMode === 'combined' ? null : assessment}
          snapshot={commentMode === 'combined' ? selectedSnapshot : null}
          stream={stream}
          userRole={userRole}
          editableRoles={
            auth?.role === 'ADMIN'
              ? ['academic_master', 'headmaster']
              : canWriteComments
              ? ['class_teacher']
              : []
          }
          onClose={() => {
             setShowCommentModal(false); 
            setSelectedStudent(null);
             load();
          }}
          onSave={() => load()}
          onOpenSettings={() => { 
            setShowCommentModal(false);
             setShowSettingsModal(true);
           
            }}
        />
      )}

      {showSettingsModal && (
        <CommentSettingsModal
          onClose={() => { 
            setShowSettingsModal(false); 
            if (selectedStudent) setShowCommentModal(true);
             load();
          }}
          assessmentId={assessment}
          streamId={stream}
          sampleStudentId={results[0]?.student_id}
        />
      )}
    </div>
  );
}