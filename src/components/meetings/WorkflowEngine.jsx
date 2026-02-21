import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Loader2, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

export default function WorkflowEngine({ meeting, onUpdate }) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const runWorkflows = async () => {
    setRunning(true);
    setResults(null);

    // Load transcript + minutes + active rules
    const [transcripts, rules, minuteDocs] = await Promise.all([
      base44.entities.Transcript.filter({ meeting_id: meeting.id }, "-version", 1),
      base44.entities.WorkflowRule.filter({ is_active: true }),
      base44.entities.Document.filter({ linked_meeting_id: meeting.id, folder: "actas" }),
    ]);

    const transcript = transcripts[0];
    const textSources = [
      transcript?.full_text || "",
      minuteDocs.map(d => d.description || "").join(" "),
    ].join(" ").toLowerCase();

    if (!textSources.trim()) {
      toast.error("No hay transcripción ni acta para analizar");
      setRunning(false);
      return;
    }

    const me = await base44.auth.me();
    const actionLog = [];

    for (const rule of rules) {
      let triggered = false;

      if (rule.trigger_type === "always") {
        triggered = true;
      } else if (rule.trigger_type === "keyword_match" && rule.keywords?.length) {
        triggered = rule.keywords.some(kw => textSources.includes(kw.toLowerCase()));
      }

      if (!triggered) {
        actionLog.push({ rule: rule.name, triggered: false });
        continue;
      }

      // Execute action
      if (rule.action_type === "create_task") {
        const tpl = rule.task_template || {};
        const dueDate = tpl.due_days_offset
          ? format(addDays(new Date(), tpl.due_days_offset), "yyyy-MM-dd")
          : "";

        let assigneeEmail = "";
        let assigneeName = "";
        if (tpl.assignee_strategy === "meeting_organizer") {
          assigneeEmail = meeting.organizer_email || "";
        } else if (tpl.assignee_strategy === "first_participant" && meeting.participants?.length) {
          assigneeEmail = meeting.participants[0].email || "";
          assigneeName = meeting.participants[0].name || "";
        }

        const titleVars = { "{{meeting_title}}": meeting.title, "{{date}}": meeting.date ? format(new Date(meeting.date), "dd/MM/yyyy") : "" };
        let title = tpl.title_template || `Follow-up: ${meeting.title}`;
        Object.entries(titleVars).forEach(([k, v]) => { title = title.replaceAll(k, v); });

        let description = tpl.description_template || `Tarea generada automáticamente por la regla "${rule.name}" tras la reunión "${meeting.title}".`;
        Object.entries(titleVars).forEach(([k, v]) => { description = description.replaceAll(k, v); });

        await base44.entities.Task.create({
          client_id: meeting.client_id,
          project_id: meeting.project_id,
          meeting_id: meeting.id,
          title,
          description,
          priority: tpl.priority || "medium",
          due_date: dueDate,
          assignee_email: assigneeEmail,
          assignee_name: assigneeName,
          status: "todo",
        });

        actionLog.push({ rule: rule.name, triggered: true, action: "Tarea creada", detail: title });
      } else if (rule.action_type === "send_email") {
        const recipients = meeting.participants?.map(p => p.email).filter(Boolean) || [];
        for (const email of recipients) {
          await base44.integrations.Core.SendEmail({
            to: email,
            subject: `[Seguimiento] ${meeting.title}`,
            body: `<p>Hola,</p><p>Se activó la regla automática "<strong>${rule.name}</strong>" tras la reunión <strong>${meeting.title}</strong>.</p><p>Por favor revisa los acuerdos y próximos pasos en DATA GOAL.</p>`,
          });
        }
        actionLog.push({ rule: rule.name, triggered: true, action: "Email enviado", detail: `${recipients.length} destinatarios` });
      }
    }

    // Audit log
    await base44.entities.AuditLog.create({
      client_id: meeting.client_id,
      project_id: meeting.project_id,
      user_email: me.email,
      action: "workflow_run",
      entity_type: "Meeting",
      entity_id: meeting.id,
      details: `Workflows ejecutados: ${actionLog.filter(r => r.triggered).length} activados`,
      timestamp: new Date().toISOString(),
    });

    setResults(actionLog);
    setRunning(false);
    setExpanded(true);
    const triggered = actionLog.filter(r => r.triggered).length;
    toast.success(`Workflows completados: ${triggered} regla(s) activada(s)`);
    onUpdate?.();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-[#3E4C59] uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-500" /> Automatizaciones post-reunión
        </h4>
        <Button
          variant="outline" size="sm"
          className="gap-1.5 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
          onClick={runWorkflows}
          disabled={running}
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          Ejecutar workflows
        </Button>
      </div>

      {results && (
        <div className="border border-[#B7CAC9]/20 rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-2.5 bg-[#F8FAFB] text-xs font-medium text-[#3E4C59] hover:bg-[#E8F5F4]"
            onClick={() => setExpanded(!expanded)}
          >
            <span>{results.filter(r => r.triggered).length} regla(s) activada(s) de {results.length}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {expanded && (
            <div className="divide-y divide-[#B7CAC9]/10">
              {results.map((r, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2">
                  {r.triggered
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    : <div className="w-3.5 h-3.5 rounded-full border-2 border-[#B7CAC9] mt-0.5 flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#1B2731]">{r.rule}</p>
                    {r.action && <p className="text-[10px] text-[#3E4C59]">{r.action}{r.detail ? `: ${r.detail}` : ""}</p>}
                    {!r.triggered && <p className="text-[10px] text-[#B7CAC9]">No activada</p>}
                  </div>
                  <Badge className={`text-[10px] border-0 flex-shrink-0 ${r.triggered ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {r.triggered ? "Activada" : "Omitida"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}