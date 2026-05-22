/**
 * SubjectsPage — Admin manages subjects and assigns them to teachers+streams.
 */
import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Pencil, Trash2, Loader2, UserCheck, Link as LinkIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Modal, Toast, FieldError, PageHeader, useToast, EmptyState } from '../components/ui';
import apiClient from '../api/axios';

const GRADE_COLOR = { A: 'text-green-600', B: 'text-teal-600', C: 'text-yellow-600', D: 'text-orange-500', F: 'text-red-600' };

export default function SubjectsPage() {
  const { auth } = useAuth();
  const slug = auth?.schoolSlug ?? '';
  const [toast, showToast, clearToast] = useToast();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editSubject, setEditSubject] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [assignSubject, setAssignSubject] = useState(null); // open assignment modal

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/academy/subjects/');
      setSubjects(res.data.results ?? res.data);
    } catch { showToast('Failed to load subjects.', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteSubject(id) {
    if (!confirm('Delete this subject? All related marks will also be removed.')) return;
    try {
      await apiClient.delete(`/academy/subjects/${id}/`);
      showToast('Subject deleted.');
      load();
    } catch { showToast('Failed to delete.', 'error'); }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {toast && <Toast {...toast} onClose={clearToast} />}

      {showAdd && (
        <SubjectFormModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); load(); showToast('Subject added.'); }}
          onError={msg => showToast(msg, 'error')}
        />
      )}
      {editSubject && (
        <SubjectFormModal
          subject={editSubject}
          onClose={() => setEditSubject(null)}
          onSuccess={() => { setEditSubject(null); load(); showToast('Subject updated.'); }}
          onError={msg => showToast(msg, 'error')}
        />
      )}
      {assignSubject && (
        <AssignSubjectModal
          subject={assignSubject}
          slug={slug}
          onClose={() => setAssignSubject(null)}
          showToast={showToast}
        />
      )}

      <PageHeader
        icon={BookOpen}
        title="Subjects"
        subtitle={`${subjects.length} subject${subjects.length !== 1 ? 's' : ''} registered`}
        action={
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            <Plus size={15} /> Add Subject
          </button>
        }
      />

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
        ) : subjects.length === 0 ? (
          <EmptyState message="No subjects yet. Add your first subject!" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Subject Name', 'Code', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {subjects.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{s.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{s.code}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button title="Assign to teacher" onClick={() => setAssignSubject(s)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition">
                        <UserCheck size={14} />
                      </button>
                      <button title="Edit" onClick={() => setEditSubject(s)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition">
                        <Pencil size={14} />
                      </button>
                      <button title="Delete" onClick={() => deleteSubject(s.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition">
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

function SubjectFormModal({ subject, onClose, onSuccess, onError }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: subject ? { name: subject.name, code: subject.code } : {},
  });
  const { auth } = useAuth();

  async function onSubmit(data) {
    try {
      const payload = { ...data, school: auth.schoolId };
      if (subject) {
        await apiClient.put(`/academy/subjects/${subject.id}/`, payload);
      } else {
        await apiClient.post('/academy/subjects/', payload);
      }
      onSuccess();
    } catch (err) {
      const detail = err.response?.data;
      onError(typeof detail === 'object' ? Object.values(detail).flat().join(' ') : 'Failed to save.');
    }
  }

  return (
    <Modal title={subject ? 'Edit Subject' : 'Add Subject'} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Subject Name</label>
          <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
            placeholder="e.g. Biology, Kiswahili"
            {...register('name', { required: 'Required' })} />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Code</label>
          <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
            placeholder="e.g. BIO, KIS"
            {...register('code', { required: 'Required' })} />
          <FieldError message={errors.code?.message} />
        </div>
        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            {subject ? 'Save' : 'Add Subject'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AssignSubjectModal({ subject, slug, onClose, showToast }) {
  const { auth } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [streams, setStreams] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm();

  useEffect(() => {
    Promise.all([
      apiClient.get('/users/'),
      apiClient.get('/academy/streams/'),
      apiClient.get(`/academy/assignments/?subject=${subject.id}`), // wait no — filter by subject not supported, use all
    ]).then(([u, s, a]) => {
      setTeachers(u.data.results ?? u.data);
      setStreams(s.data.results ?? s.data);
      // Filter assignments for this subject
      const allAssignments = a.data.results ?? a.data;
      setAssignments(allAssignments.filter(x => x.subject === subject.id));
    }).catch(() => showToast('Failed to load data.', 'error'))
      .finally(() => setLoading(false));
  }, [subject.id]);

  async function onSubmit(data) {
    if (!data.teacher || !data.stream) return;
    try {
      await apiClient.post('/academy/assignments/', {
        school: auth.schoolId,
        teacher: parseInt(data.teacher),
        subject: subject.id,
        stream: parseInt(data.stream),
        academic_year: new Date().getFullYear(),
      });
      showToast('Assignment added.');
      // Refresh assignments
      const res = await apiClient.get(`/academy/assignments/`);
      setAssignments((res.data.results ?? res.data).filter(x => x.subject === subject.id));
    } catch (err) {
      const detail = err.response?.data;
      showToast(typeof detail === 'object' ? Object.values(detail).flat().join(' ') : 'Failed to assign.', 'error');
    }
  }

  async function removeAssignment(id) {
    try {
      await apiClient.delete(`/academy/assignments/${id}/`);
      setAssignments(prev => prev.filter(a => a.id !== id));
      showToast('Assignment removed.');
    } catch { showToast('Failed to remove.', 'error'); }
  }

  const teachersInSchool = teachers.filter(t =>
    ['TEACHER', 'ADMIN'].includes(t.role) || (t.roles ?? []).includes('TEACHER')
  );

  return (
    <Modal title={`Assign "${subject.name}" to Teachers`} onClose={onClose} maxWidth="max-w-lg">
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : (
        <div className="space-y-5">
          {/* Quick link if no subjects / no teachers */}
          {teachersInSchool.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800 flex items-center gap-2">
              <LinkIcon size={13} />
              No teachers found. <Link to={`/${slug}/users`} className="underline font-semibold">Add staff first →</Link>
            </div>
          )}
          {streams.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
              No streams found. Add class levels and streams first.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Teacher</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700"
                {...register('teacher', { required: true })}>
                <option value="">Select teacher…</option>
                {teachersInSchool.map(t => (
                  <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Stream (Class)</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700"
                {...register('stream', { required: true })}>
                <option value="">Select stream…</option>
                {streams.map(s => (
                  <option key={s.id} value={s.id}>{s.class_level_name} {s.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={isSubmitting}
              className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap">
              {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Assign
            </button>
          </form>

          {assignments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Current Assignments</p>
              <div className="space-y-1.5">
                {assignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm">
                    <span className="text-slate-700 dark:text-slate-200">
                      <strong>{a.teacher_name}</strong> — {a.stream_label}
                    </span>
                    <button onClick={() => removeAssignment(a.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-600 transition">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
