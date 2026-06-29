/**
 * ClassMastersPage — Assign class master per stream per academic year.
 * Route: /:schoolSlug/class-masters  Roles: ADMIN
 */
import { useState, useEffect } from 'react';
import { Users, Loader2, Check } from 'lucide-react';
import { PageHeader, Toast, useToast } from '../components/ui';
import apiClient from '../api/axios';

export default function ClassMastersPage() {
  const [toast, showToast, clearToast] = useToast();
  const [streams,     setStreams]     = useState([]);
  const [teachers,    setTeachers]    = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [year, setYear]   = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, t, a] = await Promise.all([
        apiClient.get('/academy/classes/'),
        apiClient.get('/users/'),
        apiClient.get(`/academy/class-masters/?academic_year=${year}`),
      ]);
      setStreams(s.data.results ?? s.data);
      setTeachers((t.data.results ?? t.data).filter(u => u.role === 'TEACHER' || u.role === 'ADMIN'));
      setAssignments(a.data);
    } catch {
      showToast('Imeshindwa kupakia data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [year]);

  const assignmentMap = Object.fromEntries(assignments.map(a => [a.stream_id, a]));

  async function handleAssign(streamId, teacherId) {
    setSaving(streamId);
    try {
      const existing = assignmentMap[streamId];
      if (!teacherId) {
        if (existing) await apiClient.delete(`/academy/class-masters/${existing.id}/`);
      } else {
        await apiClient.post('/academy/class-masters/', {
          stream: streamId, teacher: teacherId, academic_year: year,
        });
      }
      showToast(teacherId ? 'Mwalimu amepewa darasa.' : 'Imefutwa.', 'success');
      await load();
    } catch {
      showToast('Imeshindwa kuhifadhi.', 'error');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {toast && <Toast {...toast} onClose={clearToast}/>}
      <PageHeader icon={Users} title="Walimu wa Madarasa"
        subtitle="Panga mwalimu wa darasa kwa kila mkondo na mwaka wa masomo"/>

      <div className="flex items-center gap-3 mb-6">
        <label className="text-xs text-slate-500 font-medium">Mwaka wa Masomo</label>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100">
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500"/></div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Darasa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Mwalimu wa Darasa</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Hali</th>
              </tr>
            </thead>
            <tbody>
              {streams.map((stream, i) => {
                const assignment = assignmentMap[stream.id];
                const isSaving   = saving === stream.id;
                return (
                  <tr key={stream.id}
                    className={`border-b border-slate-100 dark:border-slate-700 ${i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-900/20'}`}>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                      {stream.display_label}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={assignment?.teacher_id ?? ''}
                        onChange={e => handleAssign(stream.id, e.target.value || null)}
                        disabled={isSaving}
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 min-w-52 disabled:opacity-50">
                        <option value="">— Haijapewa —</option>
                        {teachers.map(t => (
                          <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isSaving
                        ? <Loader2 size={14} className="animate-spin text-blue-500 inline"/>
                        : assignment
                        ? <span className="text-xs text-green-600 flex items-center justify-end gap-1"><Check size={12}/> Amepewa</span>
                        : <span className="text-xs text-slate-400">Haijapewa</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}