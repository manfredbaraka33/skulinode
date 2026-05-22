import { useState, useEffect, useCallback } from 'react';
import { School, Plus, Pencil, Trash2, Loader2, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Modal, Toast, FieldError, PageHeader, useToast, EmptyState } from '../components/ui';
import apiClient from '../api/axios';

const LEVELS = [
  { value: 'PRIMARY',     label: 'Primary' },
  { value: 'SECONDARY_O', label: 'O-Level Secondary' },
  { value: 'SECONDARY_A', label: 'A-Level Secondary' },
];

export default function ClassesPage() {
  const [toast, showToast, clearToast] = useToast();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/academy/classes/');
      setClasses(res.data.results ?? res.data);
    } catch {
      showToast('Failed to load classes.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(item) {
    const count = item.student_count ?? 0;
    const msg = count > 0
      ? `Delete "${item.display_label}"? This will also permanently delete ${count} student(s) and all their marks!`
      : `Delete "${item.display_label}"?`;
    if (!confirm(msg)) return;
    try {
      await apiClient.delete(`/academy/classes/${item.id}/`);
      showToast(`"${item.display_label}" deleted.`);
      load();
    } catch {
      showToast('Failed to delete class.', 'error');
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {toast && <Toast {...toast} onClose={clearToast} />}

      {showAdd && (
        <ClassFormModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); load(); showToast('Class added.'); }}
          onError={m => showToast(m, 'error')}
        />
      )}
      {editItem && (
        <ClassFormModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={() => { setEditItem(null); load(); showToast('Class updated.'); }}
          onError={m => showToast(m, 'error')}
        />
      )}

      <PageHeader
        icon={School}
        title="Classes"
        subtitle={`${classes.length} class${classes.length !== 1 ? 'es' : ''} registered`}
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            <Plus size={15} /> Add Class
          </button>
        }
      />

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : classes.length === 0 ? (
          <EmptyState message="No classes yet. Add your first class to get started!" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Class', 'Stream', 'Level', 'Students', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {classes.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                    {c.display_label}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {c.name
                      ? <span className="font-medium text-blue-600 dark:text-blue-400">{c.name}</span>
                      : <span className="text-slate-400 italic text-xs">No Stream</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {LEVELS.find(l => l.value === c.class_level_level)?.label ?? c.class_level_level}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <Users size={13} />
                      {c.student_count}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        title="Edit"
                        onClick={() => setEditItem(c)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        title="Delete"
                        onClick={() => remove(c)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ─── Class Form Modal ────────────────────────────────────────────────────── */
function ClassFormModal({ item, onClose, onSuccess, onError }) {
  const [noStream, setNoStream] = useState(item ? item.name === '' : false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: item
      ? { class_name: item.class_level_name, stream_name: item.name, level: item.class_level_level }
      : { level: 'SECONDARY_O' },
  });

  async function onSubmit(data) {
    try {
      const payload = {
        class_name: data.class_name.trim(),
        stream_name: noStream ? '' : (data.stream_name ?? '').trim(),
        level: data.level,
      };
      if (item) {
        await apiClient.patch(`/academy/classes/${item.id}/`, payload);
      } else {
        await apiClient.post('/academy/classes/', payload);
      }
      onSuccess();
    } catch (err) {
      const detail = err.response?.data;
      const msg = detail && typeof detail === 'object'
        ? Object.values(detail).flat().join(' ')
        : 'Failed to save class.';
      onError(msg);
    }
  }

  return (
    <Modal title={item ? 'Edit Class' : 'Add Class'} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Class Name
          </label>
          <input
            placeholder="e.g. Form I, Form IV, Standard 3"
            className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500
              dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100
              ${errors.class_name ? 'border-red-400' : 'border-slate-200'}`}
            {...register('class_name', { required: 'Class name is required.' })}
          />
          <FieldError message={errors.class_name?.message} />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Level
          </label>
          <select
            className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none
              focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
            {...register('level', { required: 'Required' })}
          >
            {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Stream</label>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={noStream}
                onChange={e => setNoStream(e.target.checked)}
                className="rounded"
              />
              No Stream
            </label>
          </div>
          {noStream ? (
            <p className="text-xs text-slate-400 italic py-2 px-3 border border-dashed border-slate-200 dark:border-slate-600 rounded-lg">
              Class will appear without a stream — e.g. "Form I"
            </p>
          ) : (
            <input
              placeholder="e.g. A, B, East, Science"
              className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500
                dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100
                ${errors.stream_name ? 'border-red-400' : 'border-slate-200'}`}
              {...register('stream_name', {
                validate: v => noStream || (v && v.trim()) ? true : 'Enter a stream name or select "No Stream".',
              })}
            />
          )}
          {!noStream && <FieldError message={errors.stream_name?.message} />}
        </div>

        <div className="flex gap-3 justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            {item ? 'Save Changes' : 'Add Class'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
