import { useState, useEffect } from 'react';
import { Layers, Plus, Trash2, Loader2, X } from 'lucide-react';
import { PageHeader, Toast, useToast, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/axios';

export default function AssignmentsPage() {
  const { auth } = useAuth();
  const [toast, showToast, clearToast] = useToast();

  const [assignments, setAssignments] = useState([]);
  const [teachers, setTeachers]       = useState([]);
  const [subjects, setSubjects]       = useState([]);
  const [streams, setStreams]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [deleting, setDeleting]       = useState(null);
  const [showModal, setShowModal]     = useState(false);

  // Filters
  const [filterStream, setFilterStream]   = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');

  useEffect(() => {
    Promise.all([
      apiClient.get('/academy/assignments/'),
      apiClient.get('/users/'),
      apiClient.get('/academy/subjects/'),
      apiClient.get('/academy/classes/'),
    ]).then(([a, u, sub, s]) => {
      setAssignments(a.data.results ?? a.data);
      const allUsers = u.data.results ?? u.data;
      setTeachers(allUsers.filter(u => u.role === 'TEACHER' || u.role === 'ADMIN'));
      setSubjects(sub.data.results ?? sub.data);
      setStreams(s.data.results ?? s.data);
    }).catch(() => showToast('Failed to load data.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  async function deleteAssignment(id) {
    if (!confirm('Delete this assignment?')) return;
    setDeleting(id);
    try {
      await apiClient.delete(`/academy/assignments/${id}/`);
      setAssignments(prev => prev.filter(a => a.id !== id));
      showToast('Assignment deleted.');
    } catch { showToast('Failed to delete.', 'error'); }
    finally { setDeleting(null); }
  }

  function onCreated(newAssignment) {
    setAssignments(prev => [newAssignment, ...prev]);
    setShowModal(false);
    showToast('Assignment created.');
  }

  // Apply filters
  const filtered = assignments.filter(a => {
    if (filterStream  && String(a.stream)   !== String(filterStream))  return false;
    if (filterTeacher && String(a.teacher)  !== String(filterTeacher)) return false;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {toast && <Toast {...toast} onClose={clearToast} />}

      <PageHeader
        icon={Layers}
        title="Subject Assignments"
        subtitle="Assign teachers to subjects and classes"
        action={
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
            <Plus size={15} /> New Assignment
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Filter by Class</label>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 min-w-44"
            value={filterStream} onChange={e => setFilterStream(e.target.value)}>
            <option value="">All classes</option>
            {streams.map(s => <option key={s.id} value={s.id}>{s.display_label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Filter by Teacher</label>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 min-w-48"
            value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}>
            <option value="">All teachers</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
          </select>
        </div>
        {(filterStream || filterTeacher) && (
          <div className="flex items-end">
            <button onClick={() => { setFilterStream(''); setFilterTeacher(''); }}
              className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-50 transition">
              Clear filters
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState message="No assignments found. Create one to get started." />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                {['Subject', 'Class / Stream', 'Teacher', 'Year', ''].map((h, i) => (
                  <th key={i} className={`px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide ${i < 4 ? 'text-left' : 'text-right'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{a.subject_name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{a.stream_label}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{a.teacher_name}</td>
                  <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">{a.academic_year}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteAssignment(a.id)}
                      disabled={deleting === a.id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition disabled:opacity-50">
                      {deleting === a.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {showModal && (
        <NewAssignmentModal
          teachers={teachers}
          subjects={subjects}
          streams={streams}
          onClose={() => setShowModal(false)}
          onCreated={onCreated}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function NewAssignmentModal({ teachers, subjects, streams, onClose, onCreated, showToast }) {
  const { auth } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    teacher: '',
    subject: '',
    stream: '',
    academic_year: new Date().getFullYear(),
  });
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: undefined }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.teacher) errs.teacher = 'Required.';
    if (!form.subject) errs.subject = 'Required.';
    if (!form.stream)  errs.stream  = 'Required.';
    if (!form.academic_year) errs.academic_year = 'Required.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const res = await apiClient.post('/academy/assignments/', {
        school: auth.schoolId,
        teacher: Number(form.teacher),
        subject: Number(form.subject),
        stream:  Number(form.stream),
        academic_year: Number(form.academic_year),
      });
      onCreated(res.data);
    } catch (err) {
      const data = err.response?.data ?? {};
      if (data.non_field_errors) {
        showToast(data.non_field_errors[0], 'error');
      } else {
        const fieldErrs = {};
        ['teacher','subject','stream','academic_year'].forEach(f => {
          if (data[f]) fieldErrs[f] = Array.isArray(data[f]) ? data[f][0] : data[f];
        });
        setErrors(fieldErrs);
        if (Object.keys(fieldErrs).length === 0) showToast('Failed to create assignment.', 'error');
      }
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">New Subject Assignment</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field label="Teacher" error={errors.teacher}>
            <select name="teacher" value={form.teacher} onChange={handleChange}
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100">
              <option value="">Select teacher...</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
            </select>
          </Field>

          <Field label="Subject" error={errors.subject}>
            <select name="subject" value={form.subject} onChange={handleChange}
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100">
              <option value="">Select subject...</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>)}
            </select>
          </Field>

          <Field label="Class / Stream" error={errors.stream}>
            <select name="stream" value={form.stream} onChange={handleChange}
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100">
              <option value="">Select class...</option>
              {streams.map(s => <option key={s.id} value={s.id}>{s.display_label}</option>)}
            </select>
          </Field>

          <Field label="Academic Year" error={errors.academic_year}>
            <input
              type="number"
              name="academic_year"
              value={form.academic_year}
              onChange={handleChange}
              min="2000" max="2100"
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2 transition">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Create Assignment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  );
}
