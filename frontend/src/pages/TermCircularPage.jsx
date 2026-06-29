/**
 * TermCircularPage — Build, store and print end-of-term circulars per student.
 * Route: /:schoolSlug/circulars  Roles: ADMIN
 */
import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Plus, Trash2, Edit2, Loader2, X, Save,
  Download, ChevronDown, ChevronUp, GripVertical, Eye,
} from 'lucide-react';
import { PageHeader, Toast, useToast } from '../components/ui';
import apiClient from '../api/axios';

const DEFAULT_ITEMS = [
  { heading: 'Matangazo Muhimu / Important Announcements', content: '' },
  { heading: 'Hitimisho / Conclusion', content: 'Tunashukuru wazazi na walezi kwa ushirikiano wao. Tunaomba wasaidiane na watoto wao katika masomo wakati wa likizo.' },
];

export default function TermCircularPage() {
  const [toast, showToast, clearToast] = useToast();
  const [circulars,  setCirculars]  = useState([]);
  const [streams,    setStreams]    = useState([]);
  const [selected,   setSelected]  = useState(null);
  const [editing,    setEditing]   = useState(null);
  const [loading,    setLoading]   = useState(true);
  const [saving,     setSaving]    = useState(false);
  const [printing,   setPrinting]  = useState(false);
  const [printStream,setPrintStream]= useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        apiClient.get('/academy/circulars/'),
        apiClient.get('/academy/classes/'),
      ]);
      setCirculars(c.data);
      setStreams(s.data.results ?? s.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function startNew() {
    setEditing({
      id:                 null,
      title:              'End of Term Circular',
      academic_year:      new Date().getFullYear(),
      stream:             '',
      closing_date:       '',
      opening_date:       '',
      school_motto:       '',
      items:              JSON.parse(JSON.stringify(DEFAULT_ITEMS)),
      show_fee_statement: true,
    });
    setSelected(null);
  }

  function startEdit(circ) {
    setEditing({ ...circ, items: JSON.parse(JSON.stringify(circ.items || [])) });
    setSelected(circ.id);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        title:              editing.title,
        academic_year:      editing.academic_year,
        stream:             editing.stream || null,
        closing_date:       editing.closing_date || null,
        opening_date:       editing.opening_date || null,
        school_motto:       editing.school_motto,
        items:              editing.items,
        show_fee_statement: editing.show_fee_statement,
      };
      let saved;
      if (editing.id) {
        const r = await apiClient.put(`/academy/circulars/${editing.id}/`, payload);
        saved = r.data;
      } else {
        const r = await apiClient.post('/academy/circulars/', payload);
        saved = r.data;
      }
      showToast('Imehifadhiwa.', 'success');
      await load();
      setEditing({ ...saved, items: JSON.parse(JSON.stringify(saved.items || [])) });
      setSelected(saved.id);
    } catch { showToast('Imeshindwa kuhifadhi.', 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('Futa taarifa hii?')) return;
    try {
      await apiClient.delete(`/academy/circulars/${id}/`);
      showToast('Imefutwa.', 'success');
      if (selected === id) { setSelected(null); setEditing(null); }
      await load();
    } catch { showToast('Imeshindwa kufuta.', 'error'); }
  }

  async function handlePrint(studentId = null) {
    if (!editing?.id) { showToast('Hifadhi kwanza kabla ya kuchapisha.', 'error'); return; }
    const sid = printStream || editing.stream;
    if (!sid) { showToast('Chagua darasa la kuchapisha.', 'error'); return; }
    setPrinting(true);
    try {
      const payload = { stream: sid };
      if (studentId) payload.student_id = studentId;
      const r = await apiClient.post(
        `/academy/circulars/${editing.id}/pdf/`,
        payload,
        { responseType: 'blob' },
      );
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a   = document.createElement('a');
      a.href    = url;
      a.download = `circular_${editing.id}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 30000);
    } catch { showToast('Imeshindwa kuchapisha.', 'error'); }
    finally { setPrinting(false); }
  }

  // Item helpers
  function addItem() {
    setEditing(p => ({ ...p, items: [...(p.items || []), { heading: '', content: '' }] }));
  }
  function removeItem(i) {
    setEditing(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  }
  function updateItem(i, field, value) {
    setEditing(p => {
      const items = [...(p.items || [])];
      items[i] = { ...items[i], [field]: value };
      return { ...p, items };
    });
  }
  function moveItem(i, dir) {
    setEditing(p => {
      const items = [...(p.items || [])];
      const j = i + dir;
      if (j < 0 || j >= items.length) return p;
      [items[i], items[j]] = [items[j], items[i]];
      return { ...p, items };
    });
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {toast && <Toast {...toast} onClose={clearToast}/>}

      <PageHeader icon={FileText} title="Taarifa za Muhula"
        subtitle="Tengeneza na chapisha taarifa za mwisho wa muhula kwa kila mwanafunzi"
        action={
          <button onClick={startNew}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
            <Plus size={14}/> Taarifa Mpya
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-6">

        {/* LEFT — saved circulars list */}
        <div className="col-span-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Taarifa Zilizohifadhiwa
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-blue-500"/></div>
          ) : circulars.length === 0 ? (
            <div className="text-xs text-slate-400 italic text-center py-8">Hakuna taarifa bado.</div>
          ) : (
            <div className="space-y-2">
              {circulars.map(c => (
                <div key={c.id}
                  onClick={() => startEdit(c)}
                  className={`rounded-xl border p-3 cursor-pointer transition ${
                    selected === c.id
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{c.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{c.academic_year}</div>
                      <div className="text-xs text-slate-400">
                        {c.closing_date ? `Inafunga: ${c.closing_date}` : 'Tarehe haijawekwa'}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDelete(c.id); }}
                      className="p-1 text-slate-300 hover:text-red-500 rounded shrink-0">
                      <Trash2 size={12}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — editor */}
        <div className="col-span-2">
          {!editing ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              <FileText size={32} className="mb-3 opacity-30"/>
              <p className="text-sm">Chagua taarifa au bonyeza "Taarifa Mpya"</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">

              {/* Editor header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {editing.id ? 'Hariri Taarifa' : 'Taarifa Mpya'}
                </span>
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                    <Save size={12}/> {saving ? 'Inahifadhi...' : 'Hifadhi'}
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-5 overflow-y-auto max-h-[calc(100vh-260px)]">

                {/* Basic info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-slate-500 mb-1 block">Kichwa / Title</label>
                    <input value={editing.title}
                      onChange={e => setEditing(p => ({...p, title: e.target.value}))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"/>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Mwaka wa Masomo</label>
                    <input type="number" value={editing.academic_year}
                      onChange={e => setEditing(p => ({...p, academic_year: Number(e.target.value)}))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"/>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Darasa (hiari)</label>
                    <select value={editing.stream || ''}
                      onChange={e => setEditing(p => ({...p, stream: e.target.value || null}))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                      <option value="">Madarasa Yote</option>
                      {streams.map(s => <option key={s.id} value={s.id}>{s.display_label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Tarehe ya Kufunga</label>
                    <input type="date" value={editing.closing_date || ''}
                      onChange={e => setEditing(p => ({...p, closing_date: e.target.value}))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"/>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Tarehe ya Kufungua</label>
                    <input type="date" value={editing.opening_date || ''}
                      onChange={e => setEditing(p => ({...p, opening_date: e.target.value}))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"/>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-slate-500 mb-1 block">Kauli Mbiu ya Shule / Motto (hiari)</label>
                    <input value={editing.school_motto}
                      onChange={e => setEditing(p => ({...p, school_motto: e.target.value}))}
                      placeholder="e.g. Excellence Through Hard Work"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"/>
                  </div>
                </div>

                {/* Fee statement toggle */}
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg px-4 py-3">
                  <input type="checkbox" id="fee-toggle"
                    checked={editing.show_fee_statement}
                    onChange={e => setEditing(p => ({...p, show_fee_statement: e.target.checked}))}
                    className="rounded"/>
                  <label htmlFor="fee-toggle" className="text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                    Onyesha hali ya ada kwa kila mwanafunzi
                  </label>
                </div>

                {/* Dynamic content items */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Maudhui / Content Sections
                    </div>
                    <button onClick={addItem}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                      <Plus size={12}/> Ongeza Kipande
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(editing.items || []).map((item, i) => (
                      <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        {/* Item header */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                          <GripVertical size={14} className="text-slate-300 shrink-0"/>
                          <input
                            value={item.heading}
                            onChange={e => updateItem(i, 'heading', e.target.value)}
                            placeholder="Kichwa cha kipande / Section heading..."
                            className="flex-1 text-sm font-semibold bg-transparent outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-300 placeholder:font-normal"
                          />
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => moveItem(i, -1)} disabled={i === 0}
                              className="p-1 text-slate-300 hover:text-slate-500 disabled:opacity-20 rounded">
                              <ChevronUp size={12}/>
                            </button>
                            <button onClick={() => moveItem(i, 1)} disabled={i === (editing.items.length - 1)}
                              className="p-1 text-slate-300 hover:text-slate-500 disabled:opacity-20 rounded">
                              <ChevronDown size={12}/>
                            </button>
                            <button onClick={() => removeItem(i)}
                              className="p-1 text-slate-300 hover:text-red-500 rounded">
                              <X size={12}/>
                            </button>
                          </div>
                        </div>
                        {/* Item content */}
                        <div className="p-3">
                          <textarea
                            rows={3}
                            value={item.content}
                            onChange={e => updateItem(i, 'content', e.target.value)}
                            placeholder="Andika maudhui hapa... (kila mstari mpya = bullet point mpya kwenye PDF)"
                            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:text-slate-100 placeholder:text-slate-300"
                          />
                        </div>
                      </div>
                    ))}

                    {(!editing.items || editing.items.length === 0) && (
                      <div className="text-center py-6 text-slate-400 text-xs border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                        Bonyeza "Ongeza Kipande" kuanzisha maudhui.
                      </div>
                    )}
                  </div>
                </div>

                {/* Print section */}
                {editing.id && (
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-5">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                      Chapisha Taarifa
                    </div>
                    <div className="flex flex-wrap gap-3 items-end">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Chagua Darasa</label>
                        <select value={printStream || editing.stream || ''}
                          onChange={e => setPrintStream(e.target.value)}
                          className="border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 min-w-44">
                          <option value="">Chagua darasa...</option>
                          {streams.map(s => <option key={s.id} value={s.id}>{s.display_label}</option>)}
                        </select>
                      </div>
                      <button onClick={() => handlePrint()}
                        disabled={printing}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition">
                        {printing ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>}
                        Chapisha Wote
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      PDF itatengenezwa na mwanafunzi mmoja kwa ukurasa, ikijumuisha ada zake na sahihi ya mkuu wa shule.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}