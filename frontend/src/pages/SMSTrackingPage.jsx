import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, RotateCcw, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { PageHeader, Toast, useToast } from '../components/ui';
import apiClient from '../api/axios';

const STATUS_LABELS = {
  sent: { label: 'Imetumwa', color: 'text-green-600 bg-green-50', icon: CheckCircle2 },
  failed: { label: 'Imeshindikana', color: 'text-red-600 bg-red-50', icon: XCircle },
  dry_run: { label: 'Jaribio (Dry Run)', color: 'text-slate-500 bg-slate-100', icon: AlertTriangle },
  queued: { label: 'Inasubiri', color: 'text-amber-600 bg-amber-50', icon: Loader2 },
};

export default function SMSTrackingPage() {
  const [toast, showToast, clearToast] = useToast();
  const [logs, setLogs] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [resendingId, setResendingId] = useState(null);
  const [bulkResending, setBulkResending] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page, page_size: 30 });
    if (statusFilter) params.append('status', statusFilter);
    try {
      const r = await apiClient.get(`/academy/sms-logs/?${params}`);
      setLogs(r.data);
    } catch {
      showToast('Imeshindwa kupakia rekodi za SMS.', 'error');
    }
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  async function resend(id) {
    setResendingId(id);
    try {
      const r = await apiClient.post(`/academy/sms-logs/${id}/resend/`);
      showToast(r.data.message, r.data.success ? 'success' : 'error');
      await load();
    } catch {
      showToast('Imeshindwa kutuma upya.', 'error');
    } finally {
      setResendingId(null);
    }
  }

  async function bulkResend() {
    if (!confirm(`Tuma upya SMS zote ${logs.summary.failed} zilizoshindikana?`)) return;
    setBulkResending(true);
    try {
      const r = await apiClient.post('/academy/sms-logs/bulk-resend/', {});
      showToast(`Zimetumwa upya: ${r.data.resent}. Bado zimeshindikana: ${r.data.still_failed}.`, 'success');
      await load();
    } catch {
      showToast('Imeshindwa kutuma upya kwa wingi.', 'error');
    } finally {
      setBulkResending(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {toast && <Toast {...toast} onClose={clearToast} />}

      <PageHeader
        icon={MessageSquare}
        title="Ufuatiliaji wa SMS"
        subtitle="Angalia SMS zilizotumwa na zilizoshindikana kwa wazazi"
        action={
          logs?.summary.failed > 0 && (
            <button onClick={bulkResend} disabled={bulkResending}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition">
              {bulkResending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Tuma Upya Zote Zilizoshindikana ({logs.summary.failed})
            </button>
          )
        }
      />

      {logs && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatCard label="Jumla" value={logs.summary.total} color="#185FA5" />
          <StatCard label="Zimetumwa" value={logs.summary.sent} color="#0F6E56" />
          <StatCard label="Zimeshindikana" value={logs.summary.failed} color="#A32D2D" />
          <StatCard label="Dry Run" value={logs.summary.dry_run} color="#64748b" />
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {['', 'sent', 'failed', 'dry_run'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition ${
              statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
            {s === '' ? 'Zote' : STATUS_LABELS[s]?.label ?? s}
          </button>
        ))}
      </div>

      {!logs ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : logs.results.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">Hakuna rekodi za SMS bado.</div>
      ) : (
        <div className="bg-white rounded-xl border max-h-100 border-slate-200 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {/* <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase sticky  left-0">Mwanafunzi</th> */}
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase sticky top-0">Simu</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase sticky top-0">Tathmini</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase sticky top-0">Hali</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase sticky top-0">Muda</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {logs.results.map((log, i) => {
                const statusInfo = STATUS_LABELS[log.status] ?? STATUS_LABELS.queued;
                const Icon = statusInfo.icon;
                return (
                  <tr key={log.id} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                    {/* <td className="px-4 py-3 font-medium text-slate-800 " >{log.student_name ?? '—'}</td> */}
                    <td className="px-4 py-3 font-mono text-slate-600 sticky  left-0">{log.parent_phone}</td>
                    <td className="px-4 py-3 text-slate-500">{log.assessment_name ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${statusInfo.color}`}>
                        <Icon size={12} /> {statusInfo.label}
                      </span>
                      {log.status === 'failed' && log.error && (
                        <div className="text-xs text-slate-400 mt-1 max-w-xs truncate" title={log.error}>{log.error}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(log.created_at).toLocaleString('sw-TZ')}</td>
                    <td className="px-4 py-3 text-right">
                      {log.status === 'failed' && (
                        <button onClick={() => resend(log.id)} disabled={resendingId === log.id}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold disabled:opacity-50">
                          {resendingId === log.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                          Tuma Upya
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex justify-center gap-2 py-3 border-t border-slate-100">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 text-xs border rounded disabled:opacity-40">Nyuma</button>
            <span className="text-xs text-slate-500">Ukurasa {logs.page} / {logs.total_pages}</span>
            <button disabled={page >= logs.total_pages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 text-xs border rounded disabled:opacity-40">Mbele</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-2xl font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}