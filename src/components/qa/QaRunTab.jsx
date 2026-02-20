import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Zap, FileAudio, FileText, Mail, Bell, CheckCircle, XCircle, Clock, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { generateRunId, runSmoke, runFull, finalizeRun } from "./qaEngine";

const STATUS_COLORS = {
  RUNNING: "bg-blue-100 text-blue-700",
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  PARTIAL: "bg-yellow-100 text-yellow-700",
};
const CHECK_COLORS = {
  PASSED: "text-green-600 bg-green-50",
  FAILED: "text-red-600 bg-red-50",
  SKIPPED: "text-yellow-600 bg-yellow-50",
  RUNNING: "text-blue-600 bg-blue-50",
};

export default function QaRunTab({ selectedClient, selectedProject, user }) {
  const [running, setRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState(null);
  const [liveChecks, setLiveChecks] = useState([]);
  const [progressMsg, setProgressMsg] = useState("");
  const [projects, setProjects] = useState([]);
  const [scopeProject, setScopeProject] = useState(selectedProject?.id || "");

  useEffect(() => {
    const load = async () => {
      const p = selectedClient
        ? await base44.entities.Project.filter({ client_id: selectedClient.id })
        : await base44.entities.Project.list();
      setProjects(p);
    };
    load();
  }, [selectedClient]);

  useEffect(() => {
    if (!currentRun) return;
    const unsub = base44.entities.QaCheck.subscribe((event) => {
      if (event.data?.qa_run_id === currentRun.id) {
        if (event.type === "create") setLiveChecks(prev => [...prev, event.data]);
        else if (event.type === "update") setLiveChecks(prev => prev.map(c => c.id === event.id ? event.data : c));
      }
    });
    return unsub;
  }, [currentRun?.id]);

  const getProjectForRun = () => projects.find(p => p.id === scopeProject) || selectedProject;

  const executeRun = async (runType) => {
    if (running) return;
    setRunning(true);
    setLiveChecks([]);
    setProgressMsg("Iniciando QA Run...");

    const runId = generateRunId();
    const project = getProjectForRun();

    const run = await base44.entities.QaRun.create({
      run_id: runId,
      run_type: runType,
      environment: "PROD",
      tenant_scope: selectedClient?.name || "Global",
      project_scope: project?.name || "",
      started_by: user?.email || "",
      started_at: new Date().toISOString(),
      status: "RUNNING",
      summary_passed: 0,
      summary_failed: 0,
    });
    setCurrentRun(run);

    try {
      const onProgress = (msg) => setProgressMsg(msg);
      let checks = [];

      if (runType === "SMOKE") {
        const res = await runSmoke({ run, selectedClient, selectedProject: project, user, onProgress });
        checks = res.checks;
      } else if (runType === "FULL") {
        const res = await runFull({ run, selectedClient, selectedProject: project, user, onProgress });
        checks = res.checks;
      } else if (runType === "FILES_ONLY") {
        const { checks: c } = await runSmoke({ run, selectedClient, selectedProject: project, user, onProgress });
        checks = c.filter(ch => ch.check_code?.startsWith("FILE"));
      } else if (runType === "TRANSCRIPTION_ONLY") {
        const { checks: c } = await runFull({ run, selectedClient, selectedProject: project, user, onProgress });
        checks = c.filter(ch => ch.check_code?.startsWith("TRANS") || ch.check_code?.startsWith("FILE"));
      } else if (runType === "EMAIL_ONLY") {
        const { checks: c } = await runFull({ run, selectedClient, selectedProject: project, user, onProgress });
        checks = c.filter(ch => ch.check_code?.startsWith("EMAIL"));
      } else if (runType === "NOTIF_ONLY") {
        const { checks: c } = await runSmoke({ run, selectedClient, selectedProject: project, user, onProgress });
        checks = c.filter(ch => ch.check_code?.startsWith("NOTIF"));
      }

      const result = await finalizeRun(run.id, checks);
      setCurrentRun(r => ({ ...r, ...result }));
      setProgressMsg(`Finalizado: ${result.status}`);
      toast.success(`QA Run ${runId}: ${result.status} (${result.passed} PASSED, ${result.failed} FAILED)`);
    } catch (e) {
      await base44.entities.QaRun.update(run.id, { status: "FAILED", summary_notes: String(e), finished_at: new Date().toISOString() });
      setProgressMsg(`Error crítico: ${e.message}`);
      toast.error("QA Run falló con error crítico");
    }
    setRunning(false);
  };

  const RunButton = ({ label, icon: Icon, runType, variant = "outline", color }) => (
    <Button
      variant={variant}
      onClick={() => executeRun(runType)}
      disabled={running}
      className={`gap-2 ${color || ""}`}
    >
      {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </Button>
  );

  return (
    <div className="space-y-5">
      {/* Scope selector */}
      <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-5 space-y-3">
        <h3 className="font-heading font-semibold text-[#1B2731]">Scope de ejecución</h3>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#3E4C59]">Tenant:</span>
            <Badge className="bg-[#33A19A]/10 text-[#33A19A] border-0">{selectedClient?.name || "Global"}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#3E4C59]">Proyecto:</span>
            <Select value={scopeProject} onValueChange={setScopeProject}>
              <SelectTrigger className="w-48 h-8 text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Sin proyecto</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Run buttons */}
      <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-5 space-y-4">
        <h3 className="font-heading font-semibold text-[#1B2731]">Ejecutar QA</h3>
        <div className="flex flex-wrap gap-3">
          <RunButton label="SMOKE (5-10 min)" icon={Zap} runType="SMOKE" color="bg-[#33A19A] hover:bg-[#2A857F] text-white border-0" variant="default" />
          <RunButton label="FULL (completo)" icon={Play} runType="FULL" color="bg-[#1B2731] hover:bg-[#2A857F] text-white border-0" variant="default" />
          <RunButton label="Solo archivos" icon={FileAudio} runType="FILES_ONLY" />
          <RunButton label="Solo transcripción" icon={FileText} runType="TRANSCRIPTION_ONLY" />
          <RunButton label="Solo emails" icon={Mail} runType="EMAIL_ONLY" />
          <RunButton label="Solo notificaciones" icon={Bell} runType="NOTIF_ONLY" />
        </div>
      </div>

      {/* Live progress */}
      {(running || currentRun) && (
        <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-semibold text-[#1B2731]">
                Run: {currentRun?.run_id}
              </h3>
              <p className="text-xs text-[#3E4C59] mt-0.5">{currentRun?.run_type} · {currentRun?.tenant_scope}</p>
            </div>
            {currentRun?.status && (
              <Badge className={`${STATUS_COLORS[currentRun.status] || ""} border-0`}>
                {running ? <><Loader2 className="w-3 h-3 mr-1 animate-spin inline"/>RUNNING</> : currentRun.status}
              </Badge>
            )}
          </div>

          {progressMsg && (
            <div className="flex items-center gap-2 text-sm text-[#3E4C59] bg-[#FFFAF3] rounded-lg px-3 py-2">
              {running && <Loader2 className="w-4 h-4 animate-spin text-[#33A19A] flex-shrink-0" />}
              <span>{progressMsg}</span>
            </div>
          )}

          {/* Live checks */}
          <div className="space-y-2">
            {liveChecks.map(c => (
              <div key={c.id || c.check_code} className={`flex items-start gap-3 p-3 rounded-lg ${CHECK_COLORS[c.status] || "bg-gray-50 text-gray-600"}`}>
                <div className="flex-shrink-0 mt-0.5">
                  {c.status === "PASSED" && <CheckCircle className="w-4 h-4" />}
                  {c.status === "FAILED" && <XCircle className="w-4 h-4" />}
                  {c.status === "SKIPPED" && <AlertTriangle className="w-4 h-4" />}
                  {c.status === "RUNNING" && <Loader2 className="w-4 h-4 animate-spin" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold">{c.check_code}</span>
                    <span className="text-xs">{c.check_name}</span>
                    {c.duration_ms > 0 && (
                      <span className="ml-auto text-xs opacity-60 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{c.duration_ms}ms
                      </span>
                    )}
                  </div>
                  {c.evidence && (
                    <p className="text-xs mt-1 opacity-80 truncate">{c.evidence}</p>
                  )}
                  {c.error_detail && (
                    <p className="text-xs mt-1 text-red-700 font-mono">{c.error_detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          {currentRun?.summary_notes && !running && (
            <div className={`rounded-lg p-3 text-sm ${currentRun.status === "SUCCESS" ? "bg-green-50 text-green-800" : currentRun.status === "FAILED" ? "bg-red-50 text-red-800" : "bg-yellow-50 text-yellow-800"}`}>
              <p className="font-semibold mb-1">Resumen:</p>
              <p>{currentRun.summary_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}