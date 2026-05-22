import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Loader2, Users } from 'lucide-react';
import { PageHeader, Toast, useToast, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/axios';

export default function StudentSubjectsPage() {
  const { auth } = useAuth();
  const [toast, showToast, clearToast] = useToast();

  const [streams, setStreams]           = useState([]);
  const [subjects, setSubjects]         = useState([]);
  const [students, setStudents]         = useState([]);
  const [exclusions, setExclusions]     = useState([]);
  const [stream, setStream]             = useState('');
  const [selectedIds, setSelectedIds]   = useState(new Set()); // selected student ids (strings)
  const [loadingData, setLoadingData]   = useState(false);
  const [saving, setSaving]             = useState(null); // subjectId being toggled

  // Load streams + all subjects on mount
  useEffect(() => {
    Promise.all([
      apiClient.get('/academy/classes/'),
      apiClient.get('/academy/subjects/'),
    ]).then(([s, sub]) => {
      setStreams(s.data.results ?? s.data);
      setSubjects(sub.data.results ?? sub.data);
    });
  }, []);

  // Load students + exclusions when stream changes
  const loadStream = useCallback(async (streamId) => {
    if (!streamId) { setStudents([]); setExclusions([]); setSelectedIds(new Set()); return; }
    setLoadingData(true);
    try {
      const [stRes, exRes] = await Promise.all([
        apiClient.get(`/academy/students/?stream=${streamId}`),
        apiClient.get('/academy/subject-exclusions/'),
      ]);
      setStudents(stRes.data.results ?? stRes.data);
      setExclusions(exRes.data.results ?? exRes.data);
      setSelectedIds(new Set());
    } catch { showToast('Failed to load class data.', 'error'); }
    finally { setLoadingData(false); }
  }, []);

  function handleStreamChange(val) {
    setStream(val);
    loadStream(val);
  }

  function toggleStudent(studentId) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(String(studentId))) next.delete(String(studentId));
      else next.add(String(studentId));
      return next;
    });
  }

  const allSelected = students.length > 0 && selectedIds.size === students.length;

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(students.map(s => String(s.id))));
  }

  /**
   * For a given subject, compute state across all selected students:
   *   'all'   — all selected students are taking it (no exclusions)
   *   'none'  — all selected students are excluded
   *   'mixed' — some taking, some excluded
   */
  function getSubjectState(subjectId) {
    if (selectedIds.size === 0) return 'none';
    const sid = String(subjectId);
    let excludedCount = 0;
    for (const studentId of selectedIds) {
      if (exclusions.some(e => String(e.student) === studentId && String(e.subject) === sid)) {
        excludedCount++;
      }
    }
    if (excludedCount === 0) return 'all';
    if (excludedCount === selectedIds.size) return 'none';
    return 'mixed';
  }

  async function toggleSubject(subjectId) {
    if (selectedIds.size === 0 || saving !== null) return;
    setSaving(subjectId);
    const sid = String(subjectId);
    const state = getSubjectState(subjectId);

    try {
      if (state === 'all') {
        // All taking → exclude all selected students from this subject
        const newExclusions = [];
        for (const studentId of selectedIds) {
          const res = await apiClient.post('/academy/subject-exclusions/', {
            school: auth.schoolId,
            student: Number(studentId),
            subject: Number(subjectId),
          });
          newExclusions.push(res.data);
        }
        setExclusions(prev => [...prev, ...newExclusions]);
      } else {
        // Mixed or all excluded → make all selected take this subject (remove exclusions)
        const toDelete = exclusions.filter(
          e => String(e.subject) === sid && selectedIds.has(String(e.student))
        );
        await Promise.all(toDelete.map(e => apiClient.delete(`/academy/subject-exclusions/${e.id}/`)));
        setExclusions(prev => prev.filter(e => !toDelete.some(d => d.id === e.id)));
      }
    } catch (err) {
      showToast(err.response?.data?.non_field_errors?.[0] ?? 'Failed to update.', 'error');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {toast && <Toast {...toast} onClose={clearToast} />}

      <PageHeader
        icon={BookOpen}
        title="Student Subject Assignments"
        subtitle="Select students, then assign or exclude subjects"
      />

      {/* Class selector */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-slate-500 mb-1">Select Class / Stream</label>
        <select
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 min-w-56"
          value={stream} onChange={e => handleStreamChange(e.target.value)}
        >
          <option value="">Select class...</option>
          {streams.map(s => <option key={s.id} value={s.id}>{s.display_label}</option>)}
        </select>
      </div>

      {loadingData && (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      )}

      {!loadingData && stream && students.length === 0 && (
        <EmptyState message="No students in this class yet." />
      )}

      {!loadingData && stream && students.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Left: Student selection ───────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 shrink-0">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Users size={14} /> Students
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedIds.size} of {students.length} selected
                </p>
              </div>
              <button
                onClick={toggleSelectAll}
                className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-700 overflow-y-auto max-h-[480px]">
              {students.map(st => {
                const isSelected = selectedIds.has(String(st.id));
                const stExcl = exclusions.filter(e => String(e.student) === String(st.id));
                const taking = subjects.length - stExcl.length;
                return (
                  <button
                    key={st.id}
                    onClick={() => toggleStudent(st.id)}
                    className={`w-full flex items-center gap-3 px-5 py-3 text-left transition ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                    }`}
                  >
                    <span className={`flex items-center justify-center w-5 h-5 rounded border-2 shrink-0 transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                    }`}>
                      {isSelected && (
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{st.display_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{taking} of {subjects.length} subjects</p>
                    </div>
                    {stExcl.length > 0 && (
                      <span className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                        {stExcl.length} excl.
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right: Subject assignment ─────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 shrink-0">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <BookOpen size={14} /> Subjects
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedIds.size === 0
                  ? 'Select students on the left first'
                  : `Assigning to ${selectedIds.size} student${selectedIds.size > 1 ? 's' : ''} — click to toggle`}
              </p>
            </div>

            {selectedIds.size === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 py-16 text-slate-400 gap-3">
                <Users size={36} className="opacity-25" />
                <p className="text-sm">Select students to assign subjects</p>
              </div>
            ) : subjects.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">No subjects registered yet.</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700 overflow-y-auto max-h-[480px]">
                {subjects.map(subj => {
                  const state = getSubjectState(subj.id);
                  const isSaving = saving === subj.id;
                  const isAllTaking = state === 'all';
                  const isMixed = state === 'mixed';
                  return (
                    <button
                      key={subj.id}
                      onClick={() => toggleSubject(subj.id)}
                      disabled={saving !== null}
                      className="w-full flex items-center gap-4 px-5 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700/30 disabled:opacity-60"
                    >
                      <span className={`flex items-center justify-center w-5 h-5 rounded border-2 shrink-0 transition ${
                        isAllTaking
                          ? 'border-blue-500 bg-blue-500'
                          : isMixed
                          ? 'border-amber-400 bg-amber-400'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                      }`}>
                        {isSaving ? (
                          <Loader2 size={11} className="animate-spin text-white" />
                        ) : isAllTaking ? (
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : isMixed ? (
                          <svg width="9" height="2" viewBox="0 0 9 2" fill="none">
                            <rect width="9" height="2" rx="1" fill="white"/>
                          </svg>
                        ) : null}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium ${
                          state === 'none'
                            ? 'text-slate-400 dark:text-slate-500'
                            : 'text-slate-800 dark:text-slate-100'
                        }`}>
                          {subj.name}
                        </span>
                        <span className="ml-2 text-xs text-slate-400 font-mono">{subj.code}</span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                        isAllTaking
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                          : isMixed
                          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                      }`}>
                        {isAllTaking ? 'All taking' : isMixed ? 'Mixed' : 'All excluded'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
