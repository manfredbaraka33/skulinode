/**
 * GradeConfigPage — Admin manages grade definitions: label, score ranges, points, remarks.
 * All fields are editable. Grades can be added and deleted freely, or reset to NECTA defaults.
 */
import { useState, useEffect, useRef } from 'react';
import { SlidersHorizontal, RotateCcw, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { PageHeader, Toast, useToast } from '../components/ui';
import apiClient from '../api/axios';

const SCHOOL_TYPE_LABEL = {
  PRIMARY:  'Primary (SFNA/PSLE)',
  ORDINARY: 'O-Level (CSEE)',
  ADVANCED: 'A-Level (ACSEE)',
  COMBINED: 'Combined (O-Level)',
};

let _tempSeq = 0;
function tempId() { return `new_${++_tempSeq}`; }

export default function GradeConfigPage() {
  const [toast, showToast, clearToast] = useToast();
  const [configs, setConfigs]         = useState([]);   // existing rows from API
  const [edits, setEdits]             = useState({});   // { id: { grade_label, min_score, max_score, points, remarks } }
  const [newRows, setNewRows]         = useState([]);   // unsaved additions
  const [deletedIds, setDeletedIds]   = useState([]);   // ids to DELETE on save
  const [schoolType, setSchoolType]   = useState('');
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [resetting, setResetting]     = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    Promise.all([
      apiClient.get('/academy/grade-configs/'),
      apiClient.get('/school/'),
    ]).then(([gc, sc]) => {
      const rows = gc.data.results ?? gc.data;
      setConfigs(rows);
      initEdits(rows);
      setSchoolType(sc.data.school_type ?? '');
    }).catch(() => showToast('Failed to load grade config.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  function initEdits(rows) {
    const map = {};
    rows.forEach(r => {
      map[r.id] = {
        grade_label: r.grade_label,
        min_score:   r.min_score,
        max_score:   r.max_score,
        points:      r.points,
        remarks:     r.remarks,
      };
    });
    setEdits(map);
  }

  function handleChange(id, field, value) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function handleNewChange(tid, field, value) {
    setNewRows(prev => prev.map(r => r._tid === tid ? { ...r, [field]: value } : r));
  }

  function addRow() {
    const tid = tempId();
    setNewRows(prev => [...prev, { _tid: tid, grade_label: '', min_score: 0, max_score: 100, points: 1, remarks: '' }]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function markDelete(id) {
    setDeletedIds(prev => [...prev, id]);
  }

  function removeNewRow(tid) {
    setNewRows(prev => prev.filter(r => r._tid !== tid));
  }

  async function saveAll() {
    setSaving(true);
    try {
      // validate new rows have a grade label
      if (newRows.some(r => !r.grade_label.trim())) {
        showToast('All new grades must have a label.', 'error');
        return;
      }

      await Promise.all([
        // delete removed rows
        ...deletedIds.map(id => apiClient.delete(`/academy/grade-configs/${id}/`)),
        // patch existing rows
        ...configs
          .filter(r => !deletedIds.includes(r.id))
          .map(r => {
            const e = edits[r.id] ?? {};
            return apiClient.patch(`/academy/grade-configs/${r.id}/`, {
              grade_label: e.grade_label ?? r.grade_label,
              min_score:   Number(e.min_score ?? r.min_score),
              max_score:   Number(e.max_score ?? r.max_score),
              points:      Number(e.points    ?? r.points),
              remarks:     e.remarks ?? r.remarks,
            });
          }),
        // post new rows
        ...newRows.map(r =>
          apiClient.post('/academy/grade-configs/', {
            grade_label: r.grade_label.trim(),
            min_score:   Number(r.min_score),
            max_score:   Number(r.max_score),
            points:      Number(r.points),
            remarks:     r.remarks,
          })
        ),
      ]);

      // reload
      const gc = await apiClient.get('/academy/grade-configs/');
      const rows = gc.data.results ?? gc.data;
      setConfigs(rows);
      initEdits(rows);
      setNewRows([]);
      setDeletedIds([]);
      showToast('Grade config saved.', 'success');
    } catch {
      showToast('Failed to save. Check for duplicate labels.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefaults() {
    if (!window.confirm('Reset all grade ranges to NECTA defaults for this school type?')) return;
    setResetting(true);
    try {
      const r = await apiClient.post('/academy/grade-configs/reset/');
      const rows = r.data.results ?? r.data;
      setConfigs(rows);
      initEdits(rows);
      setNewRows([]);
      setDeletedIds([]);
      showToast('Reset to NECTA defaults.', 'success');
    } catch {
      showToast('Reset failed.', 'error');
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    );
  }

  const visibleConfigs = configs.filter(r => !deletedIds.includes(r.id));
  const hasRows = visibleConfigs.length > 0 || newRows.length > 0;
  const hasChanges = deletedIds.length > 0 || newRows.length > 0 ||
    configs.some(r => {
      const e = edits[r.id] ?? {};
      return Object.keys(e).some(k => String(e[k]) !== String(r[k]));
    });

  const inputCls = 'border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {toast && <Toast {...toast} onClose={clearToast} />}

      <PageHeader
        icon={SlidersHorizontal}
        title="Grade Ranges"
        subtitle="Define every grade: label, score range, points, and remarks. Add or remove grades freely."
        action={
          <div className="flex gap-2">
            <button
              onClick={resetToDefaults}
              disabled={resetting}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              {resetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              NECTA Defaults
            </button>
            <button
              onClick={saveAll}
              disabled={saving || !hasChanges}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          </div>
        }
      />

      {schoolType && (
        <div className="mb-5 px-4 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300">
          School type: <strong>{SCHOOL_TYPE_LABEL[schoolType] ?? schoolType}</strong>
        </div>
      )}

      {!hasRows ? (
        <div className="text-center py-12 text-slate-500">
          <p className="mb-3">No grades configured yet.</p>
          <div className="flex justify-center gap-3">
            <button onClick={addRow}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition">
              <Plus size={14} /> Add Grade
            </button>
            <button onClick={resetToDefaults} disabled={resetting}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition">
              {resetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Load NECTA Defaults
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-120">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Grade</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Min</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Max</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">Pts</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Remarks</th>
                <th className="px-2 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {visibleConfigs.map((row, i) => {
                const e = edits[row.id] ?? {};
                const label = e.grade_label ?? row.grade_label;
                return (
                  <tr key={row.id} className={`border-b border-slate-100 dark:border-slate-700/60 ${i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-700/20'}`}>
                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        maxLength={10}
                        value={label}
                        onChange={e => handleChange(row.id, 'grade_label', e.target.value)}
                        className={`w-20 text-center font-bold text-base uppercase ${inputCls}`}
                        placeholder="A"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <input type="number" min={0} max={100}
                        value={e.min_score ?? row.min_score}
                        onChange={ev => handleChange(row.id, 'min_score', ev.target.value)}
                        className={`w-18 text-center ${inputCls}`} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <input type="number" min={0} max={100}
                        value={e.max_score ?? row.max_score}
                        onChange={ev => handleChange(row.id, 'max_score', ev.target.value)}
                        className={`w-18 text-center ${inputCls}`} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <input type="number" min={0} max={99}
                        value={e.points ?? row.points}
                        onChange={ev => handleChange(row.id, 'points', ev.target.value)}
                        className={`w-14 text-center font-mono ${inputCls}`} />
                    </td>
                    <td className="px-4 py-2.5">
                      <input type="text"
                        value={e.remarks ?? row.remarks}
                        onChange={ev => handleChange(row.id, 'remarks', ev.target.value)}
                        className={`w-full ${inputCls}`}
                        placeholder="e.g. Excellent" />
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <button onClick={() => markDelete(row.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                        title="Remove this grade">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {newRows.map((row, i) => (
                <tr key={row._tid} className={`border-b border-blue-100 dark:border-slate-700/60 bg-blue-50/40 dark:bg-blue-900/10`}>
                  <td className="px-4 py-2.5">
                    <input
                      type="text"
                      maxLength={10}
                      value={row.grade_label}
                      onChange={e => handleNewChange(row._tid, 'grade_label', e.target.value)}
                      className={`w-20 text-center font-bold text-base uppercase ${inputCls} border-blue-300`}
                      placeholder="e.g. A"
                      autoFocus={i === newRows.length - 1}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input type="number" min={0} max={100} value={row.min_score}
                      onChange={e => handleNewChange(row._tid, 'min_score', e.target.value)}
                      className={`w-18 text-center ${inputCls}`} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input type="number" min={0} max={100} value={row.max_score}
                      onChange={e => handleNewChange(row._tid, 'max_score', e.target.value)}
                      className={`w-18 text-center ${inputCls}`} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input type="number" min={0} max={99} value={row.points}
                      onChange={e => handleNewChange(row._tid, 'points', e.target.value)}
                      className={`w-14 text-center font-mono ${inputCls}`} />
                  </td>
                  <td className="px-4 py-2.5">
                    <input type="text" value={row.remarks}
                      onChange={e => handleNewChange(row._tid, 'remarks', e.target.value)}
                      className={`w-full ${inputCls}`}
                      placeholder="e.g. Excellent" />
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <button onClick={() => removeNewRow(row._tid)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                      title="Cancel">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700/60">
            <button onClick={addRow}
              className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition">
              <Plus size={14} /> Add Grade
            </button>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
      <p className="mt-4 text-xs text-slate-400">
        Enter any grade label (e.g. A, B+, C, D, E, F). Each label must be unique. Use <em>NECTA Defaults</em> to restore standard ranges.
      </p>
    </div>
  );
}
