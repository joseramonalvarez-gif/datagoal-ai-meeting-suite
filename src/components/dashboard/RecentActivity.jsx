import React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FileText, CheckSquare, Users, Flag, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ICONS = {
  meeting: Users,
  task: CheckSquare,
  document: FileText,
  milestone: Flag,
  time: Clock,
};

export default function RecentActivity({ items = [] }) {
  return (
    <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-5">
      <h3 className="font-heading font-semibold text-[#1B2731] mb-4">Actividad Reciente</h3>
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-[#3E4C59] text-center py-6">Sin actividad reciente</p>
        ) : (
          items.map((item, i) => {
            const Icon = ICONS[item.type] || FileText;
            return (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#FFFAF3] transition-colors">
                <div className="w-8 h-8 rounded-lg bg-[#33A19A]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-[#33A19A]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1B2731] truncate">{item.title}</p>
                  <p className="text-xs text-[#3E4C59] mt-0.5">{item.subtitle}</p>
                </div>
                <span className="text-xs text-[#B7CAC9] flex-shrink-0">
                  {item.date ? format(new Date(item.date), "dd MMM", { locale: es }) : ""}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}