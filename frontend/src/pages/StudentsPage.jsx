import { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Plus, Pencil, Trash2, Loader2, Search, Upload, Download, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Modal, Toast, FieldError, PageHeader, useToast, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/axios';

const GENDER_LABEL = { M: 'Male', F: 'Female' };


const CSV_HEADERS = ['first_name', 'middle_name', 'last_name', 'gender', 'class_label', 'admission_number', 'parent_phone'];

function downloadTemplate(streams) {
  const classExamples = streams.map(s => s.display_label).join(' / ') || 'Form I A';
  const rows = [
    CSV_HEADERS.join(','),
    `Amina,,Said,F,"${streams[0]?.display_label ?? 'Form I A'}",,+255712345678`,
    `John,Peter,Mwangi,M,"${streams[1]?.display_label ?? streams[0]?.display_label ?? 'Form I B'}",,`,
  ];
  const note = `# Available classes: ${classExamples}\n# gender: M or F\n# class_label must exactly match a registered class name\n`;
  const blob = new Blob([note + rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'students_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = [];
    let inQuote = false, cur = '';
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    values.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (values[i] ?? '').replace(/^"|"$/g, '').trim(); });
    return obj;
  }).filter(r => r.first_name || r.last_name);
}

export default function StudentsPage() {
  const { auth } = useAuth();
  const [toast, showToast, clearToast] = useToast();
  const [students, setStudents] = useState([]);
  const [totalCount,  setTotalCount]  = useState(0);
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStream, setFilterStream] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [tab, setTab] = useState('list'); // 'list' | 'bulk'

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, stRes] = await Promise.all([
        apiClient.get('/academy/classes/'),
        apiClient.get('/academy/students/?all=true'),
      ]);
      setStreams(sRes.data.results ?? sRes.data);
      const stData = stRes.data;
      setStudents(stData.results ?? stData);
      setTotalCount(stData.count ?? (stData.results ?? stData).length);
    } catch { showToast('Failed to load.', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = students.filter(s => {
    const name = `${s.first_name} ${s.middle_name} ${s.last_name}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase());
    const matchStream = filterStream ? String(s.stream) === filterStream : true;
    return matchSearch && matchStream;
  });

  async function remove(id) {
    if (!confirm('Delete this student record?')) return;
    try {
      await apiClient.delete(`/academy/students/${id}/`);
      showToast('Student deleted.');
      load();
    } catch { showToast('Failed to delete.', 'error'); }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {toast && <Toast {...toast} onClose={clearToast} />}

      {showAdd && (
        <StudentFormModal
          streams={streams}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); load(); showToast('Student registered.'); }}
          onError={m => showToast(m, 'error')}
        />
      )}
      {editItem && (
        <StudentFormModal
          student={editItem}
          streams={streams}
          onClose={() => setEditItem(null)}
          onSuccess={() => { setEditItem(null); load(); showToast('Student updated.'); }}
          onError={m => showToast(m, 'error')}
        />
      )}

      <PageHeader
        icon={Users}
        title="Students"
        subtitle={`${totalCount} student${totalCount !== 1 ? 's' : ''} registered`}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => { setTab('bulk'); }}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              <Upload size={15} /> Bulk Upload
            </button>
            <button
              onClick={() => { setTab('list'); setShowAdd(true); }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              <Plus size={15} /> Register Student
            </button>
          </div>
        }
      />

      {/* Tab Switcher */}
      <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
        {[['list', 'Student List'], ['bulk', 'Bulk Upload']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
              tab === key
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Student List Tab */}
      {tab === 'list' && (
        <>
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100" />
            </div>
            <select value={filterStream} onChange={e => setFilterStream(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100">
              <option value="">All classes</option>
              {streams.map(s => <option key={s.id} value={String(s.id)}>{s.display_label}</option>)}
            </select>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
            ) : filtered.length === 0 ? (
              <EmptyState message={search ? 'No results found.' : 'No students yet. Register your first student!'} />
            ) : (
              <div className="overflow-x-auto">
                <p className='dark:text-gray-100 px-4'>Showing {filtered.length}</p>
              <table className="w-full text-sm min-w-160">
                
                <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    {['#','Name', 'Gender', 'Class', 'Parent Phone', 'Adm. No.', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filtered.map((s,i) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{i+1}</td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{s.display_name}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{GENDER_LABEL[s.gender] ?? s.gender}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{s.stream_label}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{s.parent_phone || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{s.admission_number || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button title="Edit" onClick={() => setEditItem(s)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition"><Pencil size={14} /></button>
                          <button title="Delete" onClick={() => remove(s.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Bulk Upload Tab */}
      {tab === 'bulk' && (
        <BulkUploadPanel streams={streams} onSuccess={() => { load(); showToast('Bulk upload complete.'); }} />
      )}
    </div>
  );
}

/* â”€â”€â”€ Bulk Upload Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function BulkUploadPanel({ streams, onSuccess }) {
  const { auth } = useAuth();
  const fileRef = useRef();
  const [parsed, setParsed] = useState(null);   // null | array of row objects
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);   // null | { created, errors }
  const [parseError, setParseError] = useState('');

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setParseError('');
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const rows = parseCSV(ev.target.result);
        if (rows.length === 0) {
          setParseError('No data rows found. Make sure the file has a header row and at least one data row.');
          setParsed(null);
        } else {
          setParsed(rows);
        }
      } catch {
        setParseError('Failed to parse CSV. Check the file format.');
      }
    };
    reader.readAsText(file);
  }

  async function handleUpload() {
    if (!parsed?.length) return;
    setUploading(true);
    try {
      const res = await apiClient.post('/academy/students/bulk/', {
        students: parsed.map(r => ({ ...r, school: auth.schoolId })),
      });
      setResult(res.data);
      setParsed(null);
      if (fileRef.current) fileRef.current.value = '';
      if (res.data.created > 0) onSuccess();
    } catch (err) {
      const detail = err.response?.data?.error ?? 'Upload failed.';
      setParseError(detail);
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setParsed(null);
    setResult(null);
    setParseError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="space-y-5">
      {/* Step 1: Download template */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Step 1 — Download the CSV Template</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          The template includes all registered class names as a reference. Fill it in and upload below.
          <br />
          Columns: <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">{CSV_HEADERS.join(', ')}</span>
        </p>
        <button
          onClick={() => downloadTemplate(streams)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-900/40 transition"
        >
          <Download size={15} /> Download Template
        </button>
      </div>

      {/* Step 2: Upload file */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Step 2 — Upload Filled CSV</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Select the completed CSV file. The data will be previewed before uploading.
        </p>
        <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl cursor-pointer hover:border-blue-400 transition">
          <Upload size={18} className="text-slate-400" />
          <span className="text-sm text-slate-500 dark:text-slate-400">Click to choose a CSV file…</span>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        </label>

        {parseError && (
          <div className="mt-3 flex items-start gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-700 rounded-lg p-3">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            {parseError}
          </div>
        )}
      </div>

      {/* Preview */}
      {parsed && parsed.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Preview — {parsed.length} student{parsed.length !== 1 ? 's' : ''} found
            </p>
            <button onClick={reset} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                <tr>
                  {['#', 'First Name', 'Middle', 'Last Name', 'Gender', 'Class', 'Adm. No.', 'Parent Phone'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {parsed.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/20">
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.first_name}</td>
                    <td className="px-3 py-2 text-slate-500">{r.middle_name || '—'}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.last_name}</td>
                    <td className="px-3 py-2 text-slate-500">{r.gender}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.class_label}</td>
                    <td className="px-3 py-2 text-slate-500 font-mono">{r.admission_number || '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{r.parent_phone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Uploading…' : `Upload ${parsed.length} Student${parsed.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Upload complete — {result.created} student{result.created !== 1 ? 's' : ''} added
            </span>
          </div>
          {result.errors?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">{result.errors.length} row(s) failed:</p>
              {result.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded px-3 py-1.5">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" />
                  <span>Row {e.row}: {e.error}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={reset} className="text-xs text-blue-600 hover:underline">Upload another file</button>
        </div>
      )}
    </div>
  );
}


function StudentFormModal({ student, streams, onClose, onSuccess, onError }) {
  const { auth } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: student ? {
      first_name: student.first_name, middle_name: student.middle_name,
      last_name: student.last_name, gender: student.gender,
      parent_phone: student.parent_phone, stream: student.stream,
      admission_number: student.admission_number,
    } : {},
  });

  async function onSubmit(data) {
    try {
      const payload = { ...data, school: auth.schoolId };
      if (student) {
        await apiClient.put(`/academy/students/${student.id}/`, payload);
      } else {
        await apiClient.post('/academy/students/', payload);
      }
      onSuccess();
    } catch (err) {
      const detail = err.response?.data;
      onError(typeof detail === 'object' ? Object.values(detail).flat().join(' ') : 'Failed to save.');
    }
  }

  return (
    <Modal title={student ? 'Edit Student' : 'Register Student'} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">First Name</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              {...register('first_name', { required: 'Required' })} />
            <FieldError message={errors.first_name?.message} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Middle Name <span className="text-slate-400 font-normal">(opt.)</span></label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              {...register('middle_name')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Last Name</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              {...register('last_name', { required: 'Required' })} />
            <FieldError message={errors.last_name?.message} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Gender</label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              {...register('gender', { required: 'Required' })}>
              <option value="">Select…</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
            <FieldError message={errors.gender?.message} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Class / Stream</label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              {...register('stream', { required: 'Required' })}>
              <option value="">Select class…</option>
              {streams.map(s => <option key={s.id} value={s.id}>{s.display_label}</option>)}
            </select>
            <FieldError message={errors.stream?.message} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Parent Phone <span className="text-slate-400 font-normal">(opt.)</span></label>
            <input type="tel" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+255712345678" {...register('parent_phone')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Admission No. <span className="text-slate-400 font-normal">(opt.)</span></label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              {...register('admission_number')} />
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            {student ? 'Save' : 'Register'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

