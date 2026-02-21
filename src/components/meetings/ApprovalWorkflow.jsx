import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Clock, Send, Plus, X, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_CONFIG = {
  pending:  { label: "Pendiente",  color: "bg-amber-50 text-amber-700",  icon: Clock },
  approved: { label: "Aprobado",   color: "bg-green-50 text-green-700",  icon: CheckCircle2 },
  rejected: { label: "Rechazado",  color: "bg-red-50 text-red-700",      icon: XCircle },
  cancelled:{ label: "Cancelado",  color: "bg-gray-100 text-gray-500",   icon: X },
};

export default function ApprovalWorkflow({ meeting, onUpdate }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newApprovers, setNewApprovers] = useState("");
  const [newType, setNewType] = useState("minutes");
  const [commenting, setCommenting] = useState({}); // requestId -> comment text
  const [processing, setProcessing] = useState(null);

  useEffect(() => { load(); }, [meeting.id]);

  const load = async () => {
    setLoading(true);
    const [reqs, user] = await Promise.all([
      base44.entities.ApprovalRequest.filter({ meeting_id: meeting.id }, "-created_date"),
      base44.auth.me(),
    ]);
    setRequests(reqs);
    setMe(user);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!newApprovers.trim()) return;
    setProcessing("submit");
    const user = me || await base44.auth.me();
    const approverEmails = newApprovers.split(",").map(e => e.trim()).filter(Boolean);

    // Get content snapshot
    let snapshot = "";
    if (newType === "minutes") {
      const docs = await base44.entities.Document.filter({ linked_meeting_id: meeting.id, folder: "actas" }, "-created_date", 1);
      snapshot = docs[0]?.description || "Ver acta en DATA GOAL";
    } else if (newType === "report") {
      const reports = await base44.entities.Report.filter({ meeting_id: meeting.id }, "-version", 1);
      snapshot = reports[0]?.content_markdown?.substring(0, 500) || "Ver informe en DATA GOAL";
    }

    const req = await base44.entities.ApprovalRequest.create({
      entity_type: newType,
      entity_id: meeting.id,
      meeting_id: meeting.id,
      client_id: meeting.client_id,
      project_id: meeting.project_id,
      title: `Aprobación de ${newType === "minutes" ? "acta" : newType === "report" ? "informe" : "tareas"} — ${meeting.title}`,
      submitted_by: user.email,
      approvers: approverEmails,
      decisions: approverEmails.map(e => ({ user_email: e, decision: "pending", comment: "", timestamp: "" })),
      status: "pending",
      content_snapshot: snapshot,
    });

    // Notify approvers
    for (const email of approverEmails) {
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: `[DATA GOAL] Solicitud de aprobación: ${meeting.title}`,
        body: `<p>Hola,</p><p><strong>${user.email}</strong> solicita tu aprobación del <strong>${newType === "minutes" ? "acta" : "informe"}</strong> de la reunión <strong>"${meeting.title}"</strong>.</p><p>Por favor accede a DATA GOAL para revisar y aprobar/rechazar.</p>`,
      });
    }

    toast.success(`Solicitud enviada a ${approverEmails.length} aprobador(es)`);
    setShowNew(false);
    setNewApprovers("");
    setProcessing(null);
    load();
    onUpdate?.();
  };

  const handleDecision = async (req, decision, comment) => {
    setProcessing(req.id + decision);
    const user = me || await base44.auth.me();
    const updatedDecisions = req.decisions.map(d =>
      d.user_email === user.email
        ? { ...d, decision, comment: comment || "", timestamp: new Date().toISOString() }
        : d
    );

    const allApproved = updatedDecisions.every(d => d.decision === "approved");
    const anyRejected = updatedDecisions.some(d => d.decision === "rejected");
    const newStatus = allApproved ? "approved" : anyRejected ? "rejected" : "pending";

    await base44.entities.ApprovalRequest.update(req.id, { decisions: updatedDecisions, status: newStatus });

    // If final decision reached, update meeting status
    if (newStatus === "approved" && req.entity_type === "minutes") {
      await base44.entities.Meeting.update(meeting.id, { status: "approved" });
    }

    // Notify submitter
    await base44.integrations.Core.SendEmail({
      to: req.submitted_by,
      subject: `[DATA GOAL] ${decision === "approved" ? "✅ Aprobado" : "❌ Rechazado"}: ${req.title}`,
      body: `<p><strong>${user.email}</strong> ha <strong>${decision === "approved" ? "aprobado" : "rechazado"}</strong> la solicitud: ${req.title}${comment ? `<br><br>Comentario: ${comment}` : ""}</p>`,
    });

    toast.success(`Decisión enviada: ${decision === "approved" ? "Aprobado" : "Rechazado"}`);
    setCommenting({});
    setProcessing(null);
    load();
    onUpdate?.();
  };

  const myPending = (req) =>
    me && req.status === "pending" &&
    req.decisions?.find(d => d.user_email === me.email && d.decision === "pending");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-[#3E4C59] uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#33A19A]" /> Flujos de aprobación
        </h4>
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-[#33A19A]" onClick={() => setShowNew(!showNew)}>
          <Plus className="w-3 h-3" /> Nueva solicitud
        </Button>
      </div>

      {showNew && (
        <div className="p-3 bg-[#F8FAFB] rounded-lg border border-[#B7CAC9]/20 space-y-2">
          <div className="flex gap-2">
            {[["minutes", "Acta"], ["report", "Informe"], ["task", "Tareas"]].map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setNewType(val)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${newType === val ? "bg-[#33A19A] text-white" : "bg-white border border-[#B7CAC9]/30 text-[#3E4C59]"}`}
              >
                {lbl}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-[#3E4C59] mb-1 block">Aprobadores (emails separados por coma)</label>
            <Input
              value={newApprovers}
              onChange={e => setNewApprovers(e.target.value)}
              placeholder="aprobador@empresa.com, otro@empresa.com"
              className="text-xs h-8"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button
              size="sm" className="h-7 text-xs gap-1.5 bg-[#33A19A] hover:bg-[#2A857F] text-white"
              onClick={handleSubmit}
              disabled={!newApprovers.trim() || processing === "submit"}
            >
              {processing === "submit" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Enviar
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-[#33A19A]" /></div>
      ) : requests.length === 0 ? (
        <p className="text-xs text-[#B7CAC9] py-2">Sin solicitudes de aprobación.</p>
      ) : (
        <div className="space-y-2">
          {requests.map(req => {
            const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            const canDecide = myPending(req);
            const reqKey = req.id;

            return (
              <div key={req.id} className="border border-[#B7CAC9]/20 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 p-2.5 bg-[#F8FAFB]">
                  <StatusIcon className={`w-3.5 h-3.5 flex-shrink-0 ${cfg.color.split(" ")[1]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#1B2731] truncate">{req.title}</p>
                    <p className="text-[10px] text-[#3E4C59]">
                      Por {req.submitted_by} · {req.created_date ? format(new Date(req.created_date), "dd MMM", { locale: es }) : ""}
                    </p>
                  </div>
                  <Badge className={`text-[10px] border-0 flex-shrink-0 ${cfg.color}`}>{cfg.label}</Badge>
                </div>

                {/* Approver decisions */}
                <div className="px-3 py-2 space-y-1">
                  {req.decisions?.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      {d.decision === "approved" ? <CheckCircle2 className="w-3 h-3 text-green-500" />
                        : d.decision === "rejected" ? <XCircle className="w-3 h-3 text-red-500" />
                        : <Clock className="w-3 h-3 text-amber-400" />}
                      <span className="text-[#3E4C59] flex-1 truncate">{d.user_email}</span>
                      {d.comment && <span className="text-[#B7CAC9] italic truncate max-w-24">"{d.comment}"</span>}
                    </div>
                  ))}
                </div>

                {/* Action area for current user */}
                {canDecide && (
                  <div className="px-3 pb-3 space-y-2 border-t border-[#B7CAC9]/10 pt-2">
                    <Textarea
                      value={commenting[reqKey] || ""}
                      onChange={e => setCommenting({ ...commenting, [reqKey]: e.target.value })}
                      placeholder="Comentario opcional…"
                      rows={2}
                      className="text-xs"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white flex-1"
                        onClick={() => handleDecision(req, "approved", commenting[reqKey])}
                        disabled={!!processing}
                      >
                        {processing === req.id + "approved" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Aprobar
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50 flex-1"
                        onClick={() => handleDecision(req, "rejected", commenting[reqKey])}
                        disabled={!!processing}
                      >
                        {processing === req.id + "rejected" ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                        Rechazar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}