import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_CONFIG = {
  success: { icon: CheckCircle2, color: "text-green-600", badge: "bg-green-100 text-green-800", label: "Exitoso" },
  failed: { icon: XCircle, color: "text-red-600", badge: "bg-red-100 text-red-800", label: "Fallido" },
  running: { icon: Loader2, color: "text-blue-600 animate-spin", badge: "bg-blue-100 text-blue-800", label: "En curso" },
  partial: { icon: Clock, color: "text-yellow-600", badge: "bg-yellow-100 text-yellow-800", label: "Parcial" }
};

const TYPE_LABELS = {
  post_meeting: "Post-Reunión",
  normalize_transcript: "Normalización",
  pmo_monitor: "PMO Monitor",
  manual: "Manual"
};

const STEP_LABELS = {
  load_data: "Carga de datos",
  normalize_transcript: "Normalización",
  generate_report: "Generación informe",
  upload_to_drive: "Subida a Drive",
  send_email: "Email",
  log_completion: "Finalización"
};

export default function AutomationCard({ automation }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[automation.status] || STATUS_CONFIG.running;
  const Icon = cfg.icon;
  const steps = automation.steps || [];

  const timeAgo = automation.created_date
    ? formatDistanceToNow(new Date(automation.created_date), { addSuffix: true, locale: es })
    : "–";

  return (
    <Card className="border border-[#B7CAC9]/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Icon className={`w-5 h-5 flex-shrink-0 ${cfg.color}`} />
            <div>
              <p className="text-sm font-semibold text-[#1B2731]">
                {TYPE_LABELS[automation.automation_type] || automation.automation_type}
              </p>
              <p className="text-xs text-[#3E4C59]">{timeAgo}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {automation.duration_ms && (
              <span className="text-xs text-[#3E4C59]">{(automation.duration_ms / 1000).toFixed(1)}s</span>
            )}
            <Badge className={cfg.badge}>{cfg.label}</Badge>
            {steps.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[#3E4C59] hover:text-[#1B2731] transition-colors"
              >
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </CardHeader>

      {(automation.summary || automation.error_log || expanded) && (
        <CardContent className="pt-0 space-y-2">
          {automation.summary && (
            <p className="text-xs text-[#3E4C59]">{automation.summary}</p>
          )}
          {automation.error_log && (
            <div className="bg-red-50 rounded p-2 text-xs text-red-700 font-mono">
              {automation.error_log}
            </div>
          )}
          {expanded && steps.length > 0 && (
            <div className="space-y-1 mt-2">
              {steps.map((step, i) => {
                const sCfg = STATUS_CONFIG[step.status] || STATUS_CONFIG.running;
                const SIcon = sCfg.icon;
                return (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <SIcon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${sCfg.color}`} />
                    <div>
                      <span className="font-medium text-[#1B2731]">
                        {STEP_LABELS[step.step_name] || step.step_name}
                      </span>
                      {step.output_summary && (
                        <span className="text-[#3E4C59] ml-1">— {step.output_summary}</span>
                      )}
                      {step.error && (
                        <span className="text-red-600 ml-1">⚠ {step.error}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}