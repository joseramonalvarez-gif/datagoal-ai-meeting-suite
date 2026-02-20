import React from "react";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS = {
  backlog: { label: "Backlog", color: "bg-gray-100 text-gray-700" },
  todo: { label: "Por hacer", color: "bg-blue-50 text-blue-700" },
  in_progress: { label: "En progreso", color: "bg-[#33A19A]/10 text-[#33A19A]" },
  blocked: { label: "Bloqueado", color: "bg-red-50 text-red-700" },
  in_review: { label: "En revisión", color: "bg-amber-50 text-amber-700" },
  done: { label: "Hecho", color: "bg-green-50 text-green-700" },
};

export default function TaskOverview({ tasks = [] }) {
  const counts = {};
  tasks.forEach(t => {
    counts[t.status] = (counts[t.status] || 0) + 1;
  });

  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done");

  return (
    <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-5">
      <h3 className="font-heading font-semibold text-[#1B2731] mb-4">Resumen de Tareas</h3>
      <div className="space-y-2">
        {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => (
          <div key={key} className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2">
              <Badge className={`${color} border-0 text-xs`}>{label}</Badge>
            </div>
            <span className="text-sm font-semibold text-[#1B2731]">{counts[key] || 0}</span>
          </div>
        ))}
      </div>
      {overdue.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg">
          <p className="text-xs font-semibold text-red-700">{overdue.length} tarea(s) vencida(s)</p>
        </div>
      )}
    </div>
  );
}