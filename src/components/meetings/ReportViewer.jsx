import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  FileText, CheckCircle2, XCircle, Clock, Send, Download,
  Loader2, ExternalLink, CheckSquare, RefreshCw, Link as LinkIcon, X
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-700",
  generated: "bg-blue-50 text-blue-700",
  pending_approval: "bg-amber-50 text-amber-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
};

const STATUS_LABELS = {
  draft: "Borrador", generated: "Generado",
  pending_approval: "Pendiente aprobación", approved: "Aprobado", rejected: "Rechazado"
};

export default function ReportViewer({ meetingId, meeting }) {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);

  // Approval state
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [approverEmails, setApproverEmails] = useState("");
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [approvalRequests, setApprovalRequests] = useState([]);
  const [decisionComment, setDecisionComment] = useState("");
  const [deciding, setDeciding] = useState(null);

  // Task linking state
  const [allMeetingTasks, setAllMeetingTasks] = useState([]);
  const [showLinkTasks, setShowLinkTasks] = useState(false);

  useEffect(() => { loadAll(); }, [meetingId]);

  const loadAll = async () => {
    setLoading(true);
    const [data, user, meetingTasks, approvals] = await Promise.all([
      base44.entities.Report.filter({ meeting_id: meetingId }, '-version'),
      base44.auth.me(),
      base44.entities.Task.filter({ meeting_id: meetingId }, '-created_date'),
      base44.entities.ApprovalRequest.filter({ meeting_id: meetingId, entity_type: "report" }, '-created_date'),
    ]);
    setReports(data);
    setMe(user);
    setAllMeetingTasks(meetingTasks);
    setApprovalRequests(approvals);
    if (data.length > 0) setSelectedReport(data[0]);
    setLoading(false);
  };

  // Link/unlink a task from the current report
  const toggleTaskLink = async (task) => {
    if (!selectedReport) return;
    const linked = selectedReport.linked_tasks || [];
    const isLinked = linked.includes(task.id);
    const newLinked = isLinked ? linked.filter(id => id !== task.id) : [...linked, task.id];
    await base44.entities.Report.update(selectedReport.id, { linked_tasks: newLinked });
    // Bidirectional: update Task with report reference
    if (!isLinked) {
      const taskReports = task.linked_reports || [];
      if (!taskReports.includes(selectedReport.id)) {
        await base44.entities.Task.update(task.id, { linked_reports: [...taskReports, selectedReport.id] });
      }
    }
    toast.success(isLinked ? "Tarea desvinculada" : "Tarea vinculada al informe");
    loadAll();
  };

  // Submit approval request
  const handleSubmitApproval = async () => {
    if (!approverEmails.trim() || !selectedReport) return;
    setSubmittingApproval(true);
    const emails = approverEmails.split(",").map(e => e.trim()).filter(Boolean);
    const req = await base44.entities.ApprovalRequest.create({
      entity_type: "report",
      entity_id: selectedReport.id,
      meeting_id: meetingId,
      client_id: meeting?.client_id || "",
      project_id: meeting?.project_id || "",
      title: `Aprobación de informe — ${meeting?.title || "Reunión"}`,
      submitted_by: me.email,
      approvers: emails,
      decisions: emails.map(e => ({ user_email: e, decision: "pending", comment: "", timestamp: "" })),
      status: "pending",
      content_snapshot: selectedReport.content_markdown?.substring(0, 800) || "",
    });
    await base44.entities.Report.update(selectedReport.id, { status: "pending_approval" });
    for (const email of emails) {
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: `[DATA GOAL] Solicitud de aprobación de informe: ${meeting?.title || "Reunión"}`,
        body: `<p>Hola,</p><p><strong>${me.email}</strong> solicita tu aprobación del informe de la reunión <strong>"${meeting?.title || "reunión"}"</strong>.</p><p>Por favor accede a DATA GOAL para revisarlo y aprobar o rechazar.</p>`,
      });
    }
    toast.success(`Solicitud de aprobación enviada a ${emails.length} persona(s)`);
    setShowApprovalForm(false);
    setApproverEmails("");
    setSubmittingApproval(false);
    loadAll();
  };

  // Make a decision on an approval request
  const handleDecision = async (req, decision) => {
    setDeciding(req.id + decision);
    const updatedDecisions = req.decisions.map(d =>
      d.user_email === me.email ? { ...d, decision, comment: decisionComment, timestamp: new Date().toISOString() } : d
    );
    const allApproved = updatedDecisions.every(d => d.decision === "approved");
    const anyRejected = updatedDecisions.some(d => d.decision === "rejected");
    const newStatus = allApproved ? "approved" : anyRejected ? "rejected" : "pending";
    await base44.entities.ApprovalRequest.update(req.id, { decisions: updatedDecisions, status: newStatus });
    if (newStatus !== "pending") {
      await base44.entities.Report.update(req.entity_id, { status: newStatus });
      if (newStatus === "approved" && meeting) {
        await base44.entities.Meeting.update(meetingId, { status: "approved" });
      }
    }
    await base44.integrations.Core.SendEmail({
      to: req.submitted_by,
      subject: `[DATA GOAL] ${decision === "approved" ? "✅ Informe aprobado" : "❌ Informe rechazado"}: ${meeting?.title || ""}`,
      body: `<p><strong>${me.email}</strong> ha <strong>${decision === "approved" ? "aprobado" : "rechazado"}</strong> el informe.<br>${decisionComment ? `Comentario: ${decisionComment}` : ""}</p>`,
    });
    toast.success(`Decisión registrada: ${decision === "approved" ? "Aprobado" : "Rechazado"}`);
    setDeciding(null);
    setDecisionComment("");
    loadAll();
  };

  const handleDownload = () => {
    if (!selectedReport) return;
    const blob = new Blob([selectedReport.content_markdown || ""], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `informe-${selectedReport.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#33A19A]" /></div>;
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-8 text-[#3E4C59]">
        <FileText className="w-10 h-10 mx-auto mb-2 text-[#B7CAC9]" />
        <p className="text-sm">Aún no hay informe generado</p>
      </div>
    );
  }

  const linkedTaskIds = selectedReport?.linked_tasks || [];
  const linkedTasks = allMeetingTasks.filter(t => linkedTaskIds.includes(t.id));
  const unlinkedTasks = allMeetingTasks.filter(t => !linkedTaskIds.includes(t.id));

  // Active approval for current report
  const activeApproval = approvalRequests.find(r => r.entity_id === selectedReport?.id && r.status === "pending");
  const myDecisionPending = activeApproval?.decisions?.find(d => d.user_email === me?.email && d.decision === "pending");

  return (
    <div className="space-y-4">
      {/* Report header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {reports.length > 1 && (
            <Select value={selectedReport?.id} onValueChange={v => setSelectedReport(reports.find(r => r.id === v))}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {reports.map(r => <SelectItem key={r.id} value={r.id}>v{r.version}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Badge className={`${STATUS_COLORS[selectedReport?.status] || ''} border-0 text-xs`}>
            {STATUS_LABELS[selectedReport?.status] || selectedReport?.status || ""}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => setShowLinkTasks(!showLinkTasks)}>
            <LinkIcon className="w-3.5 h-3.5" />
            Tareas ({linkedTaskIds.length})
          </Button>
          {selectedReport?.status === "generated" && (
            <Button size="sm" className="gap-1.5 text-xs h-8 bg-amber-500 hover:bg-amber-600 text-white" onClick={() => setShowApprovalForm(!showApprovalForm)}>
              <Send className="w-3.5 h-3.5" />
              Solicitar aprobación
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={handleDownload}>
            <Download className="w-3.5 h-3.5" /> .md
          </Button>
        </div>
      </div>

      {/* Task linking panel */}
      {showLinkTasks && (
        <div className="bg-[#F8FAFB] rounded-lg border border-[#B7CAC9]/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[#3E4C59] uppercase tracking-wider flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-[#33A19A]" /> Tareas vinculadas bidireccional
            </p>
            <button onClick={() => setShowLinkTasks(false)}><X className="w-3.5 h-3.5 text-[#B7CAC9]" /></button>
          </div>
          {allMeetingTasks.length === 0 ? (
            <p className="text-xs text-[#B7CAC9]">No hay tareas extraídas de esta reunión.</p>
          ) : (
            <div className="space-y-1.5">
              {allMeetingTasks.map(t => {
                const linked = linkedTaskIds.includes(t.id);
                return (
                  <div key={t.id} className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${linked ? "bg-[#E8F5F4] border-[#33A19A]/30" : "bg-white border-[#B7CAC9]/20"}`}>
                    <button onClick={() => toggleTaskLink(t)} className="flex-shrink-0">
                      {linked
                        ? <CheckCircle2 className="w-4 h-4 text-[#33A19A]" />
                        : <div className="w-4 h-4 rounded-full border-2 border-[#B7CAC9]" />
                      }
                    </button>
                    <span className={`flex-1 truncate ${linked ? "text-[#1B2731] font-medium" : "text-[#3E4C59]"}`}>{t.title}</span>
                    <Badge className={`text-[9px] border-0 flex-shrink-0 ${t.status === "done" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {t.status}
                    </Badge>
                    {t.assignee_name && <span className="text-[#B7CAC9] flex-shrink-0">{t.assignee_name}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Linked tasks summary (inside report) */}
      {linkedTasks.length > 0 && !showLinkTasks && (
        <div className="bg-[#E8F5F4] rounded-lg p-3 border border-[#33A19A]/20">
          <p className="text-xs font-semibold text-[#33A19A] mb-2 flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5" /> {linkedTasks.length} tarea(s) vinculada(s) a este informe
          </p>
          <div className="space-y-1">
            {linkedTasks.map(t => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.status === "done" ? "bg-green-500" : t.status === "in_progress" ? "bg-blue-500" : "bg-amber-400"}`} />
                <span className="text-[#1B2731] flex-1 truncate">{t.title}</span>
                {t.assignee_name && <span className="text-[#3E4C59]">{t.assignee_name}</span>}
                <Badge className="text-[9px] border-0 bg-white text-[#3E4C59]">{t.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval request form */}
      {showApprovalForm && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-700">Solicitar aprobación del informe</p>
          <div>
            <label className="text-xs text-amber-700">Aprobadores (emails separados por coma)</label>
            <Input
              value={approverEmails}
              onChange={e => setApproverEmails(e.target.value)}
              placeholder="aprobador@empresa.com, director@empresa.com"
              className="mt-1 text-xs h-8"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowApprovalForm(false)}>Cancelar</Button>
            <Button size="sm" className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleSubmitApproval} disabled={!approverEmails.trim() || submittingApproval}>
              {submittingApproval ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Enviar
            </Button>
          </div>
        </div>
      )}

      {/* Active approval — my decision pending */}
      {myDecisionPending && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Tu aprobación es requerida
          </p>
          <p className="text-xs text-amber-600">Solicitado por {activeApproval.submitted_by}</p>
          <Textarea value={decisionComment} onChange={e => setDecisionComment(e.target.value)} placeholder="Comentario opcional..." rows={2} className="text-xs" />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs gap-1 flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleDecision(activeApproval, "approved")} disabled={!!deciding}>
              {deciding === activeApproval.id + "approved" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              Aprobar
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 flex-1 border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => handleDecision(activeApproval, "rejected")} disabled={!!deciding}>
              {deciding === activeApproval.id + "rejected" ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              Rechazar
            </Button>
          </div>
        </div>
      )}

      {/* Approval history */}
      {approvalRequests.filter(r => r.entity_id === selectedReport?.id && r.status !== "pending").map(req => (
        <div key={req.id} className={`rounded-lg border p-3 text-xs ${req.status === "approved" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-center gap-1.5 font-semibold mb-1">
            {req.status === "approved" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-red-600" />}
            <span className={req.status === "approved" ? "text-green-700" : "text-red-700"}>
              {req.status === "approved" ? "Informe aprobado" : "Informe rechazado"}
            </span>
          </div>
          {req.decisions?.filter(d => d.decision !== "pending").map((d, i) => (
            <p key={i} className="text-[#3E4C59]">{d.user_email} — {d.comment || "Sin comentario"}</p>
          ))}
        </div>
      ))}

      {/* Report content */}
      <div className="bg-white rounded-lg border border-[#B7CAC9]/20 p-6 max-h-[600px] overflow-y-auto">
        <ReactMarkdown className="prose prose-sm max-w-none prose-headings:font-heading prose-headings:text-[#1B2731] prose-p:text-[#3E4C59] prose-strong:text-[#1B2731]">
          {selectedReport?.content_markdown || ""}
        </ReactMarkdown>
      </div>
    </div>
  );
}