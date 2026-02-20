import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, AlertTriangle, Clock, ChevronRight, ChevronDown, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_COLORS = {
  RUNNING: "bg-blue-100 text-blue-700",
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  PARTIAL: "bg-yellow-100 text-yellow-700",
};
const CHECK_COLORS = {
  PASSED: "bg-green-50 text-green-700",
  FAILED: "bg-red-50 text-red-700",
  SKIPPED: "bg-yellow-50 text-yellow-700",
  RUNNING: "bg-blue-50 text-blue-700",
};

export default function QaHistoryTab() {
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [checks, setChecks] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [expandedCheck, setExpandedCheck] = useState(null);

  useEffect(() => { loadRuns(); }, []);

  const loadRuns = async () => {
    setLoading(true);
    const r = await base44.entities.QaRun.list("-created_date", 50);
    setRuns(r);
    setLoading(false);
  };

  const openRun = async (run) => {
    setSelectedRun(run);
    const c = await base44.entities.QaCheck.filter({ qa_run_id: run.id }, "created_at", 50);
    setChecks(c);
  };

  const filtered = runs.filter(r => {
    const matchType = filterType === "all" || r.run_type === filterType;
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    return matchType && matchStatus;
  });

  if (selectedRun) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedRun(null); setChecks([]); }} className="gap-2">
            <ChevronRight className="w-4 h-4 rotate-180" /> Volver
          </Button>
          <div>
            <h3 className="font-heading font-semibold text-[#1B2731]">{selectedRun.run_id}</h3>
            <p className="text-xs text-[#3E4C59]">
              {selectedRun.run_type} · {selectedRun.tenant_scope} · {selectedRun.started_by}
            </p>
          </div>
          <Badge className={`${STATUS_COLORS[selectedRun.status] || ""} border-0 ml-auto`}>{selectedRun.status}</Badge>
        </div>

        <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-4">
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-green-700">{selectedRun.summary_passed || 0}</p>
              <p className="text-xs text-green-600">PASSED</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-red-700">{selectedRun.summary_failed || 0}</p>
              <p className="text-xs text-red-600">FAILED</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-700">{checks.length}</p>
              <p className="text-xs text-gray-500">TOTAL</p>
            </div>
          </div>
          {selectedRun.summary_notes && (
            <div className={`rounded-lg p-3 text-sm ${selectedRun.status === "SUCCESS" ? "bg-green-50 text-green-800" : selectedRun.status === "FAILED" ? "bg-red-50 text-red-800" : "bg-yellow-50 text-yellow-800"}`}>
              {selectedRun.summary_notes}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {checks.map(c => (
            <div key={c.id} className={`rounded-xl border ${c.status === "FAILED" ? "border-red-200" : "border-[#B7CAC9]/20"} overflow-hidden`}>
              <button
                className={`w-full flex items-center gap-3 p-3 text-left ${CHECK_COLORS[c.status] || ""}`}
                onClick={() => setExpandedCheck(expandedCheck === c.id ? null : c.id)}
              >
                {c.status === "PASSED" && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
                {c.status === "FAILED" && <XCircle className="w-4 h-4 flex-shrink-0" />}
                {c.status === "SKIPPED" && <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                <span className="font-mono text-xs font-bold">{c.check_code}</span>
                <span className="text-sm flex-1">{c.check_name}</span>
                <span className="flex items-center gap-1 text-xs opacity-60">
                  <Clock className="w-3 h-3" />{c.duration_ms || 0}ms
                </span>
                {expandedCheck === c.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {expandedCheck === c.id && (
                <div className="bg-white border-t border-[#B7CAC9]/20 p-3 space-y-2 text-xs">
                  {c.evidence && (
                    <div>
                      <p className="font-semibold text-[#1B2731] mb-1">Evidencia:</p>
                      <pre className="bg-[#FFFAF3] rounded p-2 text-[#3E4C59] whitespace-pre-wrap text-[11px] max-h-40 overflow-auto">{c.evidence}</pre>
                    </div>
                  )}
                  {c.error_detail && (
                    <div>
                      <p className="font-semibold text-red-700 mb-1">Error:</p>
                      <pre className="bg-red-50 rounded p-2 text-red-700 whitespace-pre-wrap text-[11px] max-h-40 overflow-auto">{c.error_detail}</pre>
                    </div>
                  )}
                  <p className="text-[#B7CAC9]">
                    {c.created_at ? format(new Date(c.created_at), "dd MMM yyyy HH:mm:ss", { locale: es }) : ""}
                  </p>
                </div>
              )}
            </div>
          ))}
          {checks.length === 0 && <p className="text-sm text-[#B7CAC9] text-center py-4">Sin checks registrados</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {["SMOKE","FULL","EMAIL_ONLY","NOTIF_ONLY","TRANSCRIPTION_ONLY","FILES_ONLY"].map(t =>
              <SelectItem key={t} value={t}>{t}</SelectItem>
            )}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 bg-white"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {["RUNNING","SUCCESS","FAILED","PARTIAL"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={loadRuns} className="gap-2 ml-auto">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(run => (
            <button key={run.id} onClick={() => openRun(run)}
              className="w-full bg-white rounded-xl border border-[#B7CAC9]/20 p-4 hover:shadow-md transition-all text-left flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-[#1B2731]">{run.run_id}</span>
                  <Badge className={`${STATUS_COLORS[run.status] || ""} border-0 text-xs`}>{run.status}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[#3E4C59]">
                  <span>{run.run_type}</span>
                  <span>·</span>
                  <span>{run.tenant_scope || "—"}</span>
                  <span>·</span>
                  <span>{run.started_by}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs flex-shrink-0">
                <span className="text-green-700 font-semibold">{run.summary_passed || 0}✓</span>
                <span className="text-red-600 font-semibold">{run.summary_failed || 0}✗</span>
                <ChevronRight className="w-4 h-4 text-[#B7CAC9]" />
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-[#B7CAC9]">
              <Clock className="w-10 h-10 mx-auto mb-2" />
              <p className="text-sm">Sin runs QA registrados</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}