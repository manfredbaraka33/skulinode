/**
 * CommentSettingsModal
 * Lets each role customise their comment templates per performance band.
 * Props: onClose, assessmentId, streamId, sampleStudentId (for preview)
 */
import { useState, useEffect } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';
import { useComments } from '../hooks/useComments';

const ROLES = [
  { key: 'class_teacher',   label: 'Mwalimu wa Darasa',   hint: 'Uses {best_subject} and {weak_subject}' },
  { key: 'academic_master', label: 'Mwalimu wa Taaluma',  hint: 'Uses {avg}, {grade}, {division}' },
  { key: 'headmaster',      label: 'Mkuu wa Shule',       hint: 'Uses {position}, {total}, {division}' },
];

const BANDS = [
  { min: 75, max: 100, label: 'Vizuri Sana (75–100%)',  color: '#15803d' },
  { min: 65, max: 74,  label: 'Vizuri (65–74%)',         color: '#0369a1' },
  { min: 50, max: 64,  label: 'Wastani (50–64%)',        color: '#b45309' },
  { min: 30, max: 49,  label: 'Chini (30–49%)',          color: '#c2410c' },
  { min: 0,  max: 29,  label: 'Kushindwa (0–29%)',       color: '#b91c1c' },
];

const VARS = ['{name}','{avg}','{grade}','{best_subject}','{weak_subject}','{division}','{points}','{position}','{total}'];

export default function CommentSettingsModal({ onClose, assessmentId, streamId, sampleStudentId,activeRoleOverride,visibleRoles }) {
  const { getTemplates, getSystemTemplates, saveTemplate, deleteTemplate, previewComment } = useComments();

  // const [activeRole,    setActiveRole]    = useState('class_teacher');
  const [activeRole, setActiveRole] = useState(activeRoleOverride || 'class_teacher');
  const [templates,     setTemplates]     = useState({});
  const [systemTpls,    setSystemTpls]    = useState({});
  const [dirty,         setDirty]         = useState({});
  const [saving,        setSaving]        = useState(false);
  const [preview,       setPreview]       = useState(null);
  const [previewLoading,setPreviewLoading]= useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [userT, sysT] = await Promise.all([getTemplates(), getSystemTemplates()]);
    setSystemTpls(sysT);
    const org = {};
    for (const t of userT) {
      if (!org[t.role]) org[t.role] = {};
      org[t.role][t.min_score] = { id: t.id, text: t.template_text };
    }
    setTemplates(org);
    setDirty({});
  }

  function userText(role, band)   { return templates[role]?.[band.min]?.text ?? ''; }
  function systemText(role, band) { return (systemTpls[role] ?? []).find(t => t.min === band.min)?.text ?? ''; }
  function hasCustom(role, band)  { return !!userText(role, band).trim(); }

  function handleEdit(role, band, value) {
    setTemplates(p => ({ ...p, [role]: { ...(p[role]??{}), [band.min]: { ...(p[role]?.[band.min]??{}), text: value } } }));
    setDirty(p => ({ ...p, [`${role}:${band.min}`]: true }));
    setPreview(null);
  }

  function handleReset(role, band) {
    setTemplates(p => ({ ...p, [role]: { ...(p[role]??{}), [band.min]: { ...(p[role]?.[band.min]??{}), text: '' } } }));
    setDirty(p => ({ ...p, [`${role}:${band.min}`]: true }));
    setPreview(null);
  }

  async function handleSave() {
    setSaving(true);
    const roleTpls = templates[activeRole] ?? {};
    for (const band of BANDS) {
      const key = `${activeRole}:${band.min}`;
      if (!dirty[key]) continue;
      const entry = roleTpls[band.min];
      if (!entry?.text?.trim()) {
        if (entry?.id) await deleteTemplate(entry.id);
      } else {
        await saveTemplate({ role: activeRole, min_score: band.min, max_score: band.max, template_text: entry.text });
      }
    }
    await load();
    setSaving(false);
  }

  async function handlePreview(band) {
    if (!sampleStudentId || !assessmentId) return;
    setPreviewLoading(true);
    setPreview(null);
    try {
      const customTpl = userText(activeRole, band) || undefined;
      const r = await previewComment({ student: sampleStudentId, assessment: assessmentId, role: activeRole, templateText: customTpl });
      setPreview({ band, ...r });
    } finally { setPreviewLoading(false); }
  }

  const hasDirty = Object.keys(dirty).some(k => k.startsWith(activeRole));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Mipangilio ya Maoni</h2>
            <p className="text-xs text-slate-500 mt-0.5">Acha wazi ili tumia maoni ya mfumo. Ongeza yako ili kubadilisha.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><X size={16}/></button>
        </div>

        {/* Role tabs — only show roles this user can edit */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 px-4">
          {ROLES.filter(r => !visibleRoles || visibleRoles.includes(r.key)).map(r => (
            <button key={r.key} onClick={() => setActiveRole(r.key)}
              className={`px-4 py-3 text-xs font-semibold transition border-b-2 ${
                activeRole === r.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Variable chips */}
        <div className="px-5 py-2 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700 flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-slate-400">Variables:</span>
          {VARS.map(v => (
            <span key={v} className="text-xs font-mono bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5 text-blue-600 dark:text-blue-300 cursor-default">{v}</span>
          ))}
        </div>

        {/* Bands */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <p className="text-xs text-slate-400 italic">{ROLES.find(r => r.key === activeRole)?.hint}</p>
          {BANDS.map(band => {
            const custom = hasCustom(activeRole, band);
            const sys    = systemText(activeRole, band);
            return (
              <div key={band.min} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2"
                  style={{ borderLeft: `4px solid ${band.color}` }}>
                  <span className="text-xs font-semibold" style={{ color: band.color }}>{band.label}</span>
                  <div className="flex items-center gap-2">
                    {custom && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Imebadilishwa</span>}
                    {sampleStudentId && assessmentId && (
                      <button onClick={() => handlePreview(band)} disabled={previewLoading}
                        className="text-xs text-slate-400 hover:text-blue-600 underline">
                        {previewLoading ? 'Inaonyesha...' : 'Onyesha'}
                      </button>
                    )}
                  </div>
                </div>
                {!custom && sys && (
                  <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-400 italic border-t border-slate-100 dark:border-slate-700">
                    Mfumo: {sys}
                  </div>
                )}
                <div className="p-3">
                  <textarea rows={2} value={userText(activeRole, band)}
                    onChange={e => handleEdit(activeRole, band, e.target.value)}
                    placeholder={sys || 'Andika kiolezo chako hapa...'}
                    className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 dark:text-slate-100 placeholder:text-slate-300"
                  />
                  {custom && (
                    <button onClick={() => handleReset(activeRole, band)}
                      className="mt-1 text-xs text-slate-400 hover:text-red-500 flex items-center gap-1">
                      <RotateCcw size={10}/> Rudisha mfumo
                    </button>
                  )}
                </div>
                {preview?.band.min === band.min && (
                  <div className="px-4 pb-3 text-xs text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200">
                    <strong>Mfano — {preview.student_name}</strong> (wastani: {preview.avg}%, daraja: {preview.grade}):
                    <p className="mt-1 italic">"{preview.comment}"</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Funga</button>
          <button onClick={handleSave} disabled={saving || !hasDirty}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            <Save size={13}/> {saving ? 'Inahifadhi...' : 'Hifadhi Mipangilio'}
          </button>
        </div>
      </div>
    </div>
  );
}