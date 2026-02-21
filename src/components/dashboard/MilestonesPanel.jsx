import React from "react";
import { format, parseISO, isPast, isToday, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { Flag, CheckCircle2, Clock, AlertTriangle, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG = {
  pending: { icon: Circle, color: "text-[#B7CAC9]", bg: "bg-gray-50", badge: "bg-gray-100 text-gray-600 border-gray-200", label: "Pendiente" },
  in_progress: { icon: Clock, color: "text-[#33A19A]", bg: "bg-[#E8F5F4]", badge: "bg-[#E8F5F4] text-[#1B7F7A] border-[#33A19A]/20", label: "En curso" },
  completed: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50", badge: "bg-green-50 text-green-700 border-green-200", label: "Completado" },
};

export default function MilestonesPanel({ milestones, projects }) {
  const getProject = (id) => projects.find(p => p.id === id);

  const sorted = [...milestones]
    .filter(m => m.status !== "completed")
    .sort((a, b) => {
      if (!a.target_date) return 1;
      if (!b.target_date) return -1;
      return new Date(a.target_date) - new Date(b.target_date);
    })
    .slice(0, 6);

  const completedCount = milestones.filter(m => m.status === "completed").length;

  if (milestones.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-5">
        <h3 className="font-heading font-semibold text-[#1B2731] mb-3">Hitos Clave</h3>
        <p className="text-sm text-[#3E4C59] text-center py-8">Sin hitos definidos</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-[#1B2731]">Hitos Clave</h3>
        <span className="text-xs text-[#3E4C59]">
          <span className="font-semibold text-green-600">{completedCount}</span>/{milestones.length} completados
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#33A19A] to-green-400 rounded-full transition-all"
          style={{ width: `${milestones.length > 0 ? (completedCount / milestones.length) * 100 : 0}%` }}
        />
      </div>

      <div className="space-y-2">
        {sorted.map(m => {
          const cfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.pending;
          const Icon = cfg.icon;
          const project = getProject(m.project_id);
          const isOverdue = m.target_date && isPast(parseISO(m.target_date)) && m.status !== "completed";
          const daysLeft = m.target_date ? differenceInDays(parseISO(m.target_date), new Date()) : null;

          return (
            <div key={m.id} className={`flex items-start gap-3 p-2.5 rounded-lg ${cfg.bg}`}>
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1B2731] truncate">{m.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {project && (
                    <span className="text-[10px] text-[#3E4C59]">{project.name}</span>
                  )}
                  {m.target_date && (
                    <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? 'text-red-500 font-semibold' : 'text-[#B7CAC9]'}`}>
                      {isOverdue && <AlertTriangle className="w-2.5 h-2.5" />}
                      {format(parseISO(m.target_date), "dd MMM yy", { locale: es })}
                      {daysLeft !== null && !isOverdue && daysLeft <= 14 && (
                        <span className="text-amber-500 ml-1">({daysLeft}d)</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
              <Badge className={`text-[10px] border flex-shrink-0 ${cfg.badge}`}>{cfg.label}</Badge>
            </div>
          );
        })}
      </div>

      {milestones.filter(m => m.status !== "completed").length > 6 && (
        <p className="text-xs text-center text-[#B7CAC9] mt-3">
          +{milestones.filter(m => m.status !== "completed").length - 6} hitos más
        </p>
      )}
    </div>
  );
}