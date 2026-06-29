/**
 * FinancePage — Ada/Michango definitions + awamu + student fee records + debt report.
 * Route: /:schoolSlug/finance  Roles: ADMIN, BURSAR
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DollarSign, Plus, Trash2, Loader2, X, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, Download, Edit2, Save, ReceiptText,
} from 'lucide-react';
import { PageHeader, Toast, useToast } from '../components/ui';
import apiClient from '../api/axios';

const fmt = n => `TZS ${Number(n || 0).toLocaleString()}`;
const YEAR = new Date().getFullYear();

export default function FinancePage() {
  const [tab, setTab] = useState('definitions');
  const [toast, showToast, clearToast] = useToast();
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {toast && <Toast {...toast} onClose={clearToast}/>}
      <PageHeader icon={DollarSign} title="Fedha za Shule"
        subtitle="Simamia ada, michango, malipo na ripoti za madeni"/>
      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
        {[
          { key: 'definitions', label: 'Ada & Michango' },
          { key: 'records',     label: 'Malipo ya Wanafunzi' },
          { key: 'report',      label: 'Ripoti ya Madeni' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-sm font-semibold transition border-b-2 ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'definitions' && <DefinitionsTab showToast={showToast}/>}
      {tab === 'records'     && <RecordsTab     showToast={showToast}/>}
      {tab === 'report'      && <DebtReportTab  showToast={showToast}/>}
    </div>
  );
}

/* ─── Tab 1: Ada & Michango Definitions ─────────────────────────────────── */
function DefinitionsTab({ showToast }) {
  const [definitions, setDefinitions] = useState([]);
  const [streams,     setStreams]     = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [expanded,    setExpanded]   = useState(null);
  const [showForm,    setShowForm]   = useState(false);
  const [saving,      setSaving]     = useState(false);
  const [editingPhase,setEditingPhase] = useState(null);
  const [form, setForm] = useState({
    name: '', category: 'ADA', academic_year: YEAR,
    applies_to: 'ALL', stream: '', notes: '', amount: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        apiClient.get('/academy/fee-definitions/'),
        apiClient.get('/academy/classes/'),
      ]);
      setDefinitions(d.data);
      setStreams(s.data.results ?? s.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createDefinition() {
    if (!form.name) return;
    setSaving(true);
    try {
      await apiClient.post('/academy/fee-definitions/', form);
      setShowForm(false);
      setForm({ name:'', category:'ADA', academic_year:YEAR, applies_to:'ALL', stream:'', notes:'', amount:'' });
      showToast('Imeundwa.', 'success'); load();
    } catch (e) {
      showToast(e.response?.data?.error ?? 'Imeshindwa kuunda.', 'error');
    } finally { setSaving(false); }
  }

  async function updateDefinitionName(id, name, notes) {
    try {
      await apiClient.patch(`/academy/fee-definitions/${id}/`, { name, notes });
      showToast('Imehifadhiwa.', 'success'); load();
      setEditingPhase(null);
    } catch { showToast('Imeshindwa.', 'error'); }
  }

  async function deleteDefinition(id) {
    if (!confirm('Futa ada hii?')) return;
    try {
      await apiClient.delete(`/academy/fee-definitions/${id}/`);
      showToast('Imefutwa.', 'success'); load();
    } catch (e) {
      showToast(e.response?.data?.error ?? 'Imeshindwa kufuta.', 'error');
    }
  }

  async function addPhase(defnId, name, amount, dueDate) {
    if (!name || !amount) return;
    setSaving(true);
    try {
      await apiClient.post('/academy/fee-phases/', {
        definition: defnId, name, amount, due_date: dueDate || null,
      });
      showToast('Awamu imeongezwa.', 'success'); load();
    } catch { showToast('Imeshindwa.', 'error'); }
    finally { setSaving(false); }
  }

  async function updatePhase(id, patch) {
    try {
      const r = await apiClient.patch(`/academy/fee-phases/${id}/`, patch);
      if (r.status === 400 && r.data?.can_edit_amount === false) {
        showToast(r.data.error, 'error'); return false;
      }
      showToast('Imehifadhiwa.', 'success'); load(); return true;
    } catch (e) {
      showToast(e.response?.data?.error ?? 'Imeshindwa.', 'error'); return false;
    }
  }

  async function deletePhase(id) {
    if (!confirm('Futa awamu hii?')) return;
    try {
      await apiClient.delete(`/academy/fee-phases/${id}/`);
      showToast('Imefutwa.', 'success'); load();
    } catch (e) { showToast(e.response?.data?.error ?? 'Imeshindwa.', 'error'); }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
          <Plus size={14}/> Ada / Mchango Mpya
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Aina Mpya ya Ada</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <label className="text-xs text-slate-500 mb-1 block">Jina</label>
              <input value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))}
                placeholder="e.g. Ada ya Shule 2026, Ada ya Mtihani"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600"/>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Aina</label>
              <select value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600">
                <option value="ADA">Ada ya Shule (ina awamu)</option>
                <option value="MCHANGO">Mchango Mwingine (malipo moja)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Mwaka</label>
              <input type="number" value={form.academic_year} onChange={e => setForm(p=>({...p,academic_year:Number(e.target.value)}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600"/>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Wanaolipa</label>
              <select value={form.applies_to} onChange={e => setForm(p=>({...p,applies_to:e.target.value}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600">
                <option value="ALL">Wanafunzi Wote</option>
                <option value="STREAM">Mkondo Maalum</option>
              </select>
            </div>
            {form.applies_to === 'STREAM' && (
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Mkondo</label>
                <select value={form.stream} onChange={e => setForm(p=>({...p,stream:e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600">
                  <option value="">Chagua...</option>
                  {streams.map(s => <option key={s.id} value={s.id}>{s.display_label}</option>)}
                </select>
              </div>
            )}
            {form.category === 'MCHANGO' && (
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Kiasi (TZS)</label>
                <input type="number" value={form.amount} onChange={e => setForm(p=>({...p,amount:e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600"/>
              </div>
            )}
            <div className="col-span-2">
              <label className="text-xs text-slate-500 mb-1 block">Maelezo (hiari)</label>
              <input value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600"/>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createDefinition} disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Inahifadhi...' : 'Unda'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              Ghairi
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500"/></div>
      ) : definitions.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">Hakuna ada zilizofafanuliwa bado.</div>
      ) : (
        <div className="space-y-3">
          {definitions.map(def => (
            <DefinitionCard key={def.id} def={def}
              expanded={expanded === def.id}
              onToggle={() => setExpanded(expanded === def.id ? null : def.id)}
              onDelete={() => deleteDefinition(def.id)}
              onUpdateName={(name, notes) => updateDefinitionName(def.id, name, notes)}
              onAddPhase={(name, amount, date) => addPhase(def.id, name, amount, date)}
              onUpdatePhase={updatePhase}
              onDeletePhase={deletePhase}
              saving={saving}
              showToast={showToast}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DefinitionCard({ def, expanded, onToggle, onDelete, onUpdateName, onAddPhase, onUpdatePhase, onDeletePhase, saving, showToast }) {
  const [editingName,  setEditingName]  = useState(false);
  const [nameVal,      setNameVal]      = useState(def.name);
  const [notesVal,     setNotesVal]     = useState(def.notes);
  const [newPhase,     setNewPhase]     = useState({ name:'', amount:'', due_date:'' });
  const [editPhaseId,  setEditPhaseId]  = useState(null);
  const [editPhaseVal, setEditPhaseVal] = useState({});

  function startEditPhase(phase) {
    setEditPhaseId(phase.id);
    setEditPhaseVal({ name: phase.name, amount: phase.amount, due_date: phase.due_date || '' });
  }

  async function savePhase() {
    const ok = await onUpdatePhase(editPhaseId, editPhaseVal);
    if (ok) setEditPhaseId(null);
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={onToggle} className="text-slate-400 hover:text-slate-600 shrink-0">
            {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
          {editingName ? (
            <div className="flex items-center gap-2 flex-1">
              <input value={nameVal} onChange={e => setNameVal(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm dark:bg-slate-700 dark:border-slate-600"/>
              <button onClick={() => { onUpdateName(nameVal, notesVal); setEditingName(false); }}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Save size={14}/></button>
              <button onClick={() => { setNameVal(def.name); setEditingName(false); }}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"><X size={14}/></button>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{def.name}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  def.category === 'ADA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                }`}>{def.category_label}</span>
                <span className="text-xs text-slate-400">{def.academic_year}</span>
                {def.applies_to === 'STREAM' && <span className="text-xs text-amber-600">Mkondo Maalum</span>}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!editingName && (
            <button onClick={() => setEditingName(true)}
              className="p-1.5 text-slate-400 hover:text-blue-500 rounded hover:bg-blue-50">
              <Edit2 size={13}/>
            </button>
          )}
          <button onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-red-50">
            <Trash2 size={13}/>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-4">
          {/* Notes edit */}
          {editingName && (
            <div className="mb-3">
              <label className="text-xs text-slate-500 mb-1 block">Maelezo</label>
              <input value={notesVal} onChange={e => setNotesVal(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm dark:bg-slate-700 dark:border-slate-600"/>
            </div>
          )}

          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            {def.category === 'ADA' ? 'Awamu za Malipo' : 'Kiasi cha Mchango'}
          </div>

          <div className="space-y-2 mb-3">
            {def.phases.map(phase => (
              <div key={phase.id} className="bg-slate-50 dark:bg-slate-900/30 rounded-lg px-4 py-2.5">
                {editPhaseId === phase.id ? (
                  <div className="grid grid-cols-4 gap-2 items-center">
                    <input value={editPhaseVal.name} onChange={e => setEditPhaseVal(p=>({...p,name:e.target.value}))}
                      placeholder="Jina" className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs dark:bg-slate-700 dark:border-slate-600"/>
                    <input type="number" value={editPhaseVal.amount} onChange={e => setEditPhaseVal(p=>({...p,amount:e.target.value}))}
                      placeholder="Kiasi"
                      disabled={!phase.can_edit_amount}
                      title={!phase.can_edit_amount ? 'Kuna malipo — kiasi kisibadilishwe' : ''}
                      className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs dark:bg-slate-700 dark:border-slate-600 disabled:opacity-50"/>
                    <input type="date" value={editPhaseVal.due_date || ''} onChange={e => setEditPhaseVal(p=>({...p,due_date:e.target.value}))}
                      className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs dark:bg-slate-700 dark:border-slate-600"/>
                    <div className="flex gap-1">
                      <button onClick={savePhase}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Save size={12}/></button>
                      <button onClick={() => setEditPhaseId(null)}
                        className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"><X size={12}/></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{phase.name}</span>
                      {phase.due_date && <span className="text-xs text-slate-400 ml-2">Tarehe: {phase.due_date}</span>}
                      {!phase.can_edit_amount && (
                        <span className="text-xs text-amber-600 ml-2" title="Kuna malipo">🔒</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-blue-600">{fmt(phase.amount)}</span>
                      <button onClick={() => startEditPhase(phase)}
                        className="p-1 text-slate-300 hover:text-blue-500 rounded"><Edit2 size={11}/></button>
                      <button onClick={() => onDeletePhase(phase.id)}
                        className="p-1 text-slate-300 hover:text-red-500 rounded"><X size={11}/></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {def.category === 'ADA' && (
            <div className="grid grid-cols-4 gap-2 items-end dark:text-gray-200">
              <input value={newPhase.name} onChange={e => setNewPhase(p=>({...p,name:e.target.value}))}
                placeholder="e.g. Awamu ya Kwanza"
                className="col-span-2 border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600"/>
              <input type="number" value={newPhase.amount} onChange={e => setNewPhase(p=>({...p,amount:e.target.value}))}
                placeholder="Kiasi (TZS)"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600"/>
              <button onClick={() => { onAddPhase(newPhase.name, newPhase.amount, newPhase.due_date); setNewPhase({name:'',amount:'',due_date:''}); }}
                disabled={saving}
                className="py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                + Awamu
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Tab 2: Fee Records ─────────────────────────────────────────────────── */
function RecordsTab({ showToast }) {
  const [definitions, setDefinitions] = useState([]);
  const [streams,     setStreams]     = useState([]);
  const [defnId,      setDefnId]     = useState('');
  const [streamId,    setStreamId]   = useState('');
  const [records,     setRecords]    = useState([]);
  const [loading,     setLoading]    = useState(false);
  const [generating,  setGenerating] = useState(false);
  const [payModal,    setPayModal]   = useState(null);

  useEffect(() => {
    Promise.all([
      apiClient.get('/academy/fee-definitions/'),
      apiClient.get('/academy/classes/'),
    ]).then(([d, s]) => {
      setDefinitions(d.data);
      setStreams(s.data.results ?? s.data);
    });
  }, []);

  const load = useCallback(async () => {
    if (!defnId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ definition: defnId });
      if (streamId) params.append('stream', streamId);
      const r = await apiClient.get(`/academy/fee-records/?${params}`);
      setRecords(r.data);
    } catch { showToast('Imeshindwa kupakia.', 'error'); }
    finally { setLoading(false); }
  }, [defnId, streamId]);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    if (!defnId) return;
    setGenerating(true);
    try {
      const r = await apiClient.post('/academy/fee-records/generate/', { definition: defnId });
      showToast(`Rekodi ${r.data.created} zimeundwa.`, 'success'); load();
    } catch (e) { showToast(e.response?.data?.error ?? 'Imeshindwa.', 'error'); }
    finally { setGenerating(false); }
  }

  // Group records by student then by phase
  const byStudent = records.reduce((acc, rec) => {
    if (!acc[rec.student_id]) {
      acc[rec.student_id] = {
        id: rec.student_id, name: rec.student_name,
        adm: rec.admission_number, stream: rec.stream,
        phases: [],
      };
    }
    acc[rec.student_id].phases.push(rec);
    return acc;
  }, {});
  const students = Object.values(byStudent).map(s => ({
    ...s,
    expected: s.phases.reduce((t, r) => t + r.amount_expected, 0),
    paid:     s.phases.reduce((t, r) => t + r.amount_paid,     0),
    balance:  s.phases.reduce((t, r) => t + r.balance,         0),
  })).sort((a, b) => b.balance - a.balance);

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="text-xs text-slate-500 dark:text-gray-200 mb-1 block">Ada / Mchango</label>
          <select value={defnId} onChange={e => setDefnId(e.target.value)}
            className="border border-slate-200 dark:text-gray-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 min-w-56">
            <option value="">Chagua ada...</option>
            {definitions.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.academic_year})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-gray-200 mb-1 block">Darasa (hiari)</label>
          <select value={streamId} onChange={e => setStreamId(e.target.value)}
            className="border border-slate-200 dark:text-gray-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 min-w-44">
            <option value="">Madarasa Yote</option>
            {streams.map(s => <option key={s.id} value={s.id}>{s.display_label}</option>)}
          </select>
        </div>
        <button onClick={generate} disabled={!defnId || generating}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
          {generating ? <Loader2 size={14} className="animate-spin"/> : <ReceiptText size={14}/>}
          Tengeneza Rekodi
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500"/></div>
      ) : students.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          Chagua ada kisha bonyeza "Tengeneza Rekodi".
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 dark:text-gray-200 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200  dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                <th className="text-left px-4 py-3 text-xs  dark:text-gray-200 font-semibold text-slate-500 uppercase">Mwanafunzi</th>
                <th className="text-left px-4 py-3 text-xs dark:text-gray-200 font-semibold text-slate-500 uppercase">Awamu</th>
                <th className="text-right px-4 py-3 text-xs dark:text-gray-200 font-semibold text-slate-500 uppercase">Inayotarajiwa</th>
                <th className="text-right px-4 py-3 text-xs dark:text-gray-200 font-semibold text-slate-500 uppercase">Imelipwa</th>
                <th className="text-right px-4 py-3 text-xs dark:text-gray-200 font-semibold text-slate-500 uppercase">Salio</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((st, i) => (
                <>
                  <tr key={st.id}
                    className={`border-b  border-slate-500 dark:border-slate-300 ${i%2===0?'':'bg-slate-50/40'}`}>
                    <td className="px-4 py-3" rowSpan={st.phases.length + 1}>
                      <div className="font-medium text-slate-800 dark:text-slate-100">{st.name}</div>
                      <div className="text-xs dark:text-gray-200">{st.adm} · {st.stream}</div>
                    </td>
                  </tr>
                  {st.phases.map(phase => (
                    <tr key={phase.phase_id}
                      className="border-b border-slate-100 dark:border-slate-700">
                      <td className="px-4 py-2 text-xs text-slate-500 dark:text-gray-200">{phase.phase_name}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-600 dark:text-gray-200">{fmt(phase.amount_expected)}</td>
                      <td className="px-4 py-2 text-right font-mono text-green-600">{fmt(phase.amount_paid)}</td>
                      <td className="px-4 py-2 text-right font-mono font-semibold"
                        style={{ color: phase.balance > 0 ? '#b91c1c' : '#15803d' }}>
                        {fmt(phase.balance)}
                      </td>
                      <td className="px-4 py-2">
                        {phase.balance > 0 && (
                          <button onClick={() => setPayModal({ record: phase })}
                            className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold">
                            Lipa
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payModal && (
        <PaymentModal record={payModal.record}
          onClose={() => setPayModal(null)}
          onSaved={() => { setPayModal(null); load(); showToast('Malipo yamehifadhiwa.', 'success'); }}
          showToast={showToast}/>
      )}
    </div>
  );
}

function PaymentModal({ record, onClose, onSaved, showToast }) {
  const [amount, setAmount] = useState('');
  const [dt,     setDt]     = useState(new Date().toISOString().split('T')[0]);
  const [notes,  setNotes]  = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      await apiClient.post(`/academy/fee-records/${record.id}/payment/`, {
        amount_paid: Number(amount), payment_date: dt, notes,
      });
      onSaved();
    } catch { showToast('Imeshindwa.', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 dark:text-gray-200">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-100">Rekodi Malipo</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {record.definition_name} / {record.phase_name}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Salio: <span className="font-semibold text-red-600">{fmt(record.balance)}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X size={15}/></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Kiasi (TZS)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder={`Max: ${fmt(record.balance)}`}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600"/>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Tarehe</label>
            <input type="date" value={dt} onChange={e => setDt(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600"/>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Maelezo (hiari)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Malipo ya awamu ya kwanza"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600"/>
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="flex-1 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 dark:text-gray-200 hover:bg-slate-500">Ghairi</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Inahifadhi...' : 'Hifadhi'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Tab 3: Debt Report ─────────────────────────────────────────────────── */
function DebtReportTab({ showToast }) {
  const [streams,    setStreams]    = useState([]);
  const [streamId,   setStreamId]  = useState('');
  const [year,       setYear]      = useState(YEAR);
  const [allYears,   setAllYears]  = useState(false);
  const [report,     setReport]    = useState(null);
  const [loading,    setLoading]   = useState(false);
  const [downloading,setDownloading]=useState(false);
  const [expanded,   setExpanded]  = useState(null);

  useEffect(() => {
    apiClient.get('/academy/classes/')
      .then(r => setStreams(r.data.results ?? r.data));
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ academic_year: year, include_all_years: allYears });
      if (streamId) params.append('stream', streamId);
      const r = await apiClient.get(`/academy/fee-reports/?${params}`);
      setReport(r.data);
    } catch { showToast('Imeshindwa.', 'error'); }
    finally { setLoading(false); }
  }

  async function downloadCSV() {
    setDownloading(true);
    try {
      const params = new URLSearchParams({ academic_year: year });
      if (streamId) params.append('stream', streamId);
      const r = await apiClient.get(`/academy/fee-reports/csv/?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `madeni_${year}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 30000);
    } catch { showToast('Imeshindwa kupakua.', 'error'); }
    finally { setDownloading(false); }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-end dark:text-gray-200">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Mwaka</label>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 w-28"/>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Darasa (hiari)</label>
          <select value={streamId} onChange={e => setStreamId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 min-w-44">
            <option value="">Madarasa Yote</option>
            {streams.map(s => <option key={s.id} value={s.id}>{s.display_label}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={allYears} onChange={e => setAllYears(e.target.checked)} className="rounded"/>
          Jumuisha madeni ya miaka yote
        </label>
        <button onClick={load} disabled={loading}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Inapakia...' : 'Onyesha'}
        </button>
        {report && (
          <button onClick={downloadCSV} disabled={downloading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            <Download size={14}/> {downloading ? 'Inapakua...' : 'CSV'}
          </button>
        )}
      </div>

      {report && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Jumla Inayotarajiwa', value: fmt(report.total_expected), color: '#185FA5' },
              { label: 'Jumla Imelipwa',      value: fmt(report.total_paid),     color: '#0F6E56' },
              { label: 'Jumla Salio',         value: fmt(report.total_balance),  color: '#A32D2D' },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="text-xs text-slate-500 mb-1">{s.label}</div>
                <div className="text-xl font-semibold" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mb-4 text-sm text-slate-500">
            <span>Wanafunzi: <strong>{report.total_students}</strong></span>
            <span>Wenye Deni: <strong className="text-red-600">{report.debtors}</strong></span>
            <span>Walishalipa: <strong className="text-green-600">{report.cleared}</strong></span>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                  <th className="text-left px-4 py-3 text-xs dark:text-gray-200 font-semibold text-slate-500 uppercase">#</th>
                  <th className="text-left px-4 py-3 text-xs dark:text-gray-200 font-semibold text-slate-500 uppercase">Mwanafunzi</th>
                  <th className="text-left px-4 py-3 text-xs  dark:text-gray-200 font-semibold text-slate-500 uppercase">Darasa</th>
                  <th className="text-right px-4 py-3 text-xs dark:text-gray-200 font-semibold text-slate-500 uppercase">Inayotarajiwa</th>
                  <th className="text-right px-4 py-3 text-xs dark:text-gray-200 font-semibold text-slate-500 uppercase">Imelipwa</th>
                  <th className="text-right px-4 py-3 text-xs dark:text-gray-200 font-semibold text-slate-500 uppercase">Salio</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {report.students.map((st, i) => (
                  <>
                    <tr key={st.student_id}
                      onClick={() => setExpanded(expanded === st.student_id ? null : st.student_id)}
                      className="border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-400 text-xs">{i+1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-400">{st.name}</div>
                        <div className="text-xs text-slate-400">{st.admission_no}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{st.stream}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">{fmt(st.total_expected)}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-600">{fmt(st.total_paid)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold"
                        style={{ color: st.total_balance > 0 ? '#b91c1c' : '#15803d' }}>
                        {fmt(st.total_balance)}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {expanded === st.student_id ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                      </td>
                    </tr>
                    {expanded === st.student_id && (
                      <tr key={`${st.student_id}-detail`} className="bg-blue-50/50 dark:bg-blue-950/10 dark:text-gray-200">
                        <td colSpan={7} className="px-8 py-3">
                          {st.current.length > 0 && (
                            <>
                              <div className="text-xs font-semibold text-slate-500 dark:text-gray-200 mb-1.5">Mwaka Huu</div>
                              {st.current.map((r, ri) => (
                                <div key={ri} className="flex justify-between text-xs dark:text-gray-200 py-0.5 hover:bg-yellow-600">
                                  <span className="text-slate-600 dark:text-gray-200">{r.definition} / {r.phase}</span>
                                  <span className='font-bold text-xl' style={{ color: r.balance > 0 ? '#b91c1c' : '#15803d' }}>{fmt(r.balance)}</span>
                                </div>
                              ))}
                            </>
                          )}
                          {st.historical.length > 0 && (
                            <>
                              <div className="text-xs font-semibold text-amber-600 mt-2 mb-1.5">Madeni ya Awali</div>
                              {st.historical.map((r, ri) => (
                                <div key={ri} className="flex justify-between text-xs py-0.5">
                                  <span className="text-slate-500">{r.definition} / {r.phase} ({r.year})</span>
                                  <span className="text-amber-600 font-semibold">{fmt(r.balance)}</span>
                                </div>
                              ))}
                            </>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}