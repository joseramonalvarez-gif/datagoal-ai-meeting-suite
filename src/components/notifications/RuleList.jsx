import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Edit2, Trash2, Bell, Mail, Smartphone } from "lucide-react";

const EVENT_LABELS = {
  qa_run_failed: "QA: Run fallido",
  qa_run_completed: "QA: Run completado",
  qa_run_partial: "QA: Run parcial",
  qa_check_failed: "QA: Check fallido",
  meeting_transcribed: "Reunión: Transcripción lista",
  meeting_report_generated: "Reunión: Informe generado",
  meeting_scheduled: "Reunión: Programada",
};

const SOURCE_COLORS = {
  qa_center: "bg-purple-50 text-purple-700 border-purple-200",
  meetings: "bg-blue-50 text-blue-700 border-blue-200",
};

export default function RuleList({ rules, templates, loading, onEdit, onDelete, onToggle }) {
  if (loading) return <div className="flex justify-center py-10"><div className="animate-spin w-5 h-5 border-2 border-[#33A19A] border-t-transparent rounded-full" /></div>;

  if (rules.length === 0) return (
    <div className="text-center py-14 bg-white rounded-xl border border-[#B7CAC9]/20">
      <Bell className="w-10 h-10 mx-auto text-[#B7CAC9] mb-2" />
      <p className="text-sm text-[#3E4C59]">No hay reglas de notificación. Crea una para comenzar.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {rules.map(r => {
        const tpl = templates.find(t => t.id === r.template_id);
        return (
          <div key={r.id} className={`bg-white rounded-xl border p-4 transition-all ${r.is_active ? 'border-[#B7CAC9]/20' : 'border-dashed border-[#B7CAC9]/40 opacity-60'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-heading font-semibold text-[#1B2731]">{r.name}</span>
                  <Badge className={`text-[11px] border ${SOURCE_COLORS[r.event_source] || 'bg-gray-100 text-gray-600'}`}>
                    {r.event_source === "qa_center" ? "QA Center" : "Reuniones"}
                  </Badge>
                  <Badge className="text-[11px] bg-[#E8F5F4] text-[#33A19A] border-[#33A19A]/20">
                    {EVENT_LABELS[r.event_type] || r.event_type}
                  </Badge>
                </div>

                {r.description && <p className="text-xs text-[#3E4C59] mb-2">{r.description}</p>}

                <div className="flex flex-wrap gap-3 text-xs text-[#3E4C59]">
                  {r.send_email && (
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-[#33A19A]" />
                      Email {tpl ? `→ "${tpl.name}"` : '(sin plantilla)'}
                    </span>
                  )}
                  {r.send_in_app && (
                    <span className="flex items-center gap-1"><Smartphone className="w-3 h-3 text-[#33A19A]" />In-app</span>
                  )}
                  {r.recipients_type && (
                    <span className="text-[#B7CAC9]">
                      Dest.: {r.recipients_type === "fixed_list"
                        ? (r.recipients_emails?.join(", ") || "—")
                        : { participants: "Participantes", project_leads: "Project leads", management: "Dirección", all: "Todos" }[r.recipients_type] || r.recipients_type}
                    </span>
                  )}
                  {r.conditions?.min_failures > 0 && (
                    <span className="text-amber-600">≥{r.conditions.min_failures} fallos</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch checked={!!r.is_active} onCheckedChange={() => onToggle(r)} />
                <Button variant="ghost" size="icon" onClick={() => onEdit(r)} className="h-8 w-8"><Edit2 className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)} className="h-8 w-8 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}