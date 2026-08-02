import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, Pencil, Trash2, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Modal, Toast, FieldError, PageHeader, useToast, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/axios';

export default function AssessmentsPage() {
  const { auth } = useAuth();
  const [toast, showToast, clearToast] = useToast();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/academy/assessments/');
      setAssessments(res.data.results ?? res.data);
    } catch { showToast('Failed to load assessments.', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(id) {
    try {
      const res = await apiClient.post(`/academy/assessments/${id}/toggle/`);
      setAssessments(prev => prev.map(a => a.id === id ? res.data : a));
      showToast(res.data.is_active ? 'Assessment activated.' : 'Assessment deactivated.');
    } catch { showToast('Failed to toggle.', 'error'); }
  }

  async function remove(id) {
    if (!confirm('Delete this assessment? All marks linked to it will be removed.')) return;
    try {
      await apiClient.delete(`/academy/assessments/${id}/`);
      showToast('Assessment deleted.');
      load();
    } catch { showToast('Failed to delete.', 'error'); }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {toast && <Toast {...toast} onClose={clearToast} />}

      {showAdd && (
        <AssessmentFormModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); load(); showToast('Assessment created.'); }}
          onError={m => showToast(m, 'error')}
        />
      )}
      {editItem && (
        <AssessmentFormModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={() => { setEditItem(null); load(); showToast('Assessment updated.'); }}
          onError={m => showToast(m, 'error')}
        />
      )}

      <PageHeader
        icon={ClipboardList}
        title="Assessments"
        subtitle="Manage exams and tests for mark entry"
        action={
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            <Plus size={15} /> New Assessment
          </button>
        }
      />

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
        ) : assessments.length === 0 ? (
          <EmptyState message="No assessments yet. Create your first exam or test!" />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-105">
            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Name', 'Year', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {assessments.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{a.name}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{a.academic_year}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full
                      ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button title={a.is_active ? 'Deactivate' : 'Activate'} onClick={() => toggle(a.id)}
                        className={`p-1.5 rounded-lg transition ${a.is_active ? 'text-green-600 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                        {a.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                      <button title="Edit" onClick={() => setEditItem(a)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition">
                        <Pencil size={14} />
                      </button>
                      <button title="Delete" onClick={() => remove(a.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AssessmentFormModal({ item, onClose, onSuccess, onError }) {
  const { auth } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: item ? { name: item.name, academic_year: item.academic_year } : { academic_year: new Date().getFullYear() },
  });

  async function onSubmit(data) {
    try {
      const payload = { ...data, school: auth.schoolId };
      if (item) {
        await apiClient.put(`/academy/assessments/${item.id}/`, payload);
      } else {
        await apiClient.post('/academy/assessments/', payload);
      }
      onSuccess();
    } catch (err) {
      const detail = err.response?.data;
      onError(typeof detail === 'object' ? Object.values(detail).flat().join(' ') : 'Failed to save.');
    }
  }

  return (
    <Modal title={item ? 'Edit Assessment' : 'New Assessment'} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block  font-medium text-slate-400 mb-1">Assessment Name</label>
          <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Mid-term Test, Annual Exam"
            {...register('name', { required: 'Required' })} />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <label className="block font-medium text-slate-400 mb-1">Academic Year</label>
          <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
            {...register('academic_year', { required: 'Required', valueAsNumber: true })} />
          <FieldError message={errors.academic_year?.message} />
        </div>
        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            {item ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
