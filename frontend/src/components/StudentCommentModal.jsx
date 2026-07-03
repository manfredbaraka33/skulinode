/**
 * StudentCommentModal
 * Opens when a student row is clicked on the results list.
 * Shows their performance + 3 comment tabs (one per role).
 * The logged-in user can only edit their own role's tab.
 *
 * Props:
 *   student      — {student_id, display_name, average, grade, division, rank, total_students}
 *   assessment   — assessment ID
 *   stream       — stream ID
 *   userRole     — 'class_teacher' | 'academic_master' | 'headmaster'
 *   onClose      — fn()
 *   onSave       — fn(savedComment)
 *   onOpenSettings — fn() opens CommentSettingsModal
 */
import { useState, useEffect, useCallback } from 'react';
import { X, Save, RotateCcw, Settings, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useComments } from '../hooks/useComments';

const ROLES = [
  { key: 'class_teacher',   label: 'Mwalimu wa Darasa' },
  { key: 'academic_master', label: 'Mtaaluma' },
  { key: 'headmaster',      label: 'Mkuu wa shule' },
];

const GRADE_COLOR = { A: '#15803d', B: '#0369a1', C: '#b45309', D: '#c2410c', F: '#b91c1c' };

export default function StudentCommentModal({
  student, assessment, snapshot, stream, userRole, editableRoles,
  onClose, onSave, onOpenSettings,
}) {
  const { getComments, saveComment, generateComments, deleteComment } = useComments();

  const [activeTab,   setActiveTab]   = useState(userRole);
  const [comments,    setComments]    = useState({ class_teacher: null, academic_master: null, headmaster: null });
  const [editTexts,   setEditTexts]   = useState({ class_teacher: '', academic_master: '', headmaster: '' });
  const [dirty,       setDirty]       = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [generating,  setGenerating]  = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);

  const load = useCallback(async () => {
    try {
      const all = await getComments({ assessment, stream, snapshot });
      const mine = all.filter(c => c.student === student.student_id);
      const map  = {};
      for (const c of mine) map[c.role] = c;
      setComments(map);
      setEditTexts({
        class_teacher:   map.class_teacher?.comment_text   ?? '',
        academic_master: map.academic_master?.comment_text ?? '',
        headmaster:      map.headmaster?.comment_text      ?? '',
      });
    } finally { setLoadingInit(false); }
  }, [assessment, snapshot, stream, student.student_id]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      const existing = comments[activeTab];
      const result = await saveComment({
        student:      student.student_id,
        ...(assessment ? { assessment } : {}),
        ...(snapshot   ? { snapshot }   : {}),
        role:         activeTab,
        comment_text: editTexts[activeTab],
        is_manual:    true,
      });
      setComments(p => ({ ...p, [activeTab]: result }));
      setDirty(false);
      onSave?.(result);
    } finally { setSaving(false); }
  }

  async function handleRegenerate() {
    setGenerating(true);
    try {
      await generateComments({ 
        stream, 
        ...(assessment ? { assessment } : {}),
        ...(snapshot ? { snapshot } : {}),
        role: activeTab, 
        overwriteManual: true 
      });
      await load();
      setDirty(false);
    } finally { setGenerating(false); }
  }


 

  const currentComment = comments[activeTab];
  const isMyRole       = editableRoles
    ? editableRoles.includes(activeTab)
    : activeTab === userRole;
  const isManual       = currentComment?.is_manual ?? false;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{student.display_name}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
              {student.average != null && <span>Wastani: <strong>{student.average}%</strong></span>}
              {student.grade   && <span style={{ color: GRADE_COLOR[student.grade], fontWeight: 700 }}>{student.grade}</span>}
              {student.division && <span>{student.division}</span>}
              {student.rank    && <span>Nafasi: <strong>{student.rank}/{student.total_students}</strong></span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={onOpenSettings} title="Mipangilio ya Maoni"
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
              <Settings size={15}/>
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
              <X size={15}/>
            </button>
          </div>
        </div>

        {/* Role tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          {ROLES.map(r => (
            <button key={r.key} onClick={() => { setActiveTab(r.key); setDirty(false); }}
              className={`flex-1 py-3 text-xs font-semibold transition border-b-2 relative ${
                activeTab === r.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}>
              {r.label}
              {comments[r.key]?.is_manual && (
                <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-amber-500"/>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loadingInit ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-blue-500"/></div>
          ) : (
            <>
              {/* Not-your-role notice */}
              {!isMyRole && (
                <div className="mb-3 flex items-center gap-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/30 rounded-lg px-3 py-2">
                  <AlertCircle size={13}/>
                  Unaweza kusoma tu. Haya ni maoni ya {ROLES.find(r => r.key === activeTab)?.label}.
                </div>
              )}

              {/* Manual edit notice */}
              {isMyRole && isManual && (
                <div className="mb-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                  <AlertCircle size={13}/>
                  <span className="flex-1">Imebadilishwa kwa mkono.</span>
                  <button onClick={handleRegenerate} disabled={generating}
                    className="flex items-center gap-1 underline hover:no-underline disabled:opacity-50">
                    {generating ? <Loader2 size={11} className="animate-spin"/> : <RotateCcw size={11}/>}
                    Tengeneza upya
                  </button>
                </div>
              )}

              {/* Auto-generated label */}
              {isMyRole && !isManual && currentComment && (
                <div className="mb-3 flex items-center gap-2 text-xs text-green-700 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                  <CheckCircle2 size={13}/>
                  Imetengenezwa kiotomatiki kutoka kiolezo chako.
                </div>
              )}

              <textarea
                rows={6}
                value={editTexts[activeTab]}
                onChange={e => {
                  if (!isMyRole) return;
                  setEditTexts(p => ({ ...p, [activeTab]: e.target.value }));
                  setDirty(true);
                }}
                readOnly={!isMyRole}
                placeholder={
                  !currentComment
                    ? 'Bonyeza "Tengeneza" kwenye orodha ya wanafunzi ili uzalishe maoni.'
                    : ''
                }
                className={`w-full text-sm border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 resize-none focus:ring-2 focus:ring-blue-500 outline-none dark:text-slate-100 ${
                  !isMyRole
                    ? 'bg-slate-50 dark:bg-slate-900/30 cursor-default text-slate-500'
                    : 'bg-white dark:bg-slate-800'
                }`}
              />

              {/* Generate prompt when no comment exists */}
              {isMyRole && !currentComment && !generating && (
                <button onClick={handleRegenerate}
                  className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <RotateCcw size={12}/> Tengeneza maoni kiotomatiki
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700">
          <span className="text-xs text-slate-400">
            {dirty ? '● Mabadiliko hayajahifadhiwa' : isManual ? '✎ Mkono' : currentComment ? '✓ Kiotomatiki' : ''}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Funga</button>
            {isMyRole && (
              <button onClick={handleSave} disabled={saving || !dirty}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                <Save size={13}/> {saving ? 'Inahifadhi...' : 'Hifadhi'}
              </button>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}