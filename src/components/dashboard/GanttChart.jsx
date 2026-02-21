import React, { useMemo } from "react";
import { format, differenceInDays, parseISO, isValid, addDays } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_COLORS = {
  active: { bar: "#33A19A", bg: "#E8F5F4", text: "#1B7F7A" },
  on_hold: { bar: "#F59E0B", bg: "#FEF3C7", text: "#92400E" },
  completed: { bar: "#6366F1", bg: "#EDE9FE", text: "#4338CA" },
  archived: { bar: "#B7CAC9", bg: "#F1F5F9", text: "#64748B" },
};

export default function GanttChart({ projects }) {
  const today = new Date();

  const data = useMemo(() => {
    return projects
      .filter(p => p.start_date)
      .map(p => {
        const start = parseISO(p.start_date);
        const end = p.end_date ? parseISO(p.end_date) : addDays(start, 90);
        return { ...p, start, end };
      })
      .sort((a, b) => a.start - b.start);
  }, [projects]);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-5">
        <h3 className="font-heading font-semibold text-[#1B2731] mb-3">Línea de Tiempo (Gantt)</h3>
        <p className="text-sm text-[#3E4C59] text-center py-10">Sin proyectos con fechas definidas</p>
      </div>
    );
  }

  const minDate = data.reduce((min, p) => p.start < min ? p.start : min, data[0].start);
  const maxDate = data.reduce((max, p) => p.end > max ? p.end : max, data[0].end);
  const totalDays = Math.max(differenceInDays(maxDate, minDate) + 14, 90);

  const getLeft = (date) => (differenceInDays(date, minDate) / totalDays) * 100;
  const getWidth = (start, end) => Math.max((differenceInDays(end, start) / totalDays) * 100, 1.5);
  const todayLeft = getLeft(today);

  // Month markers
  const months = [];
  let cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (cur <= maxDate) {
    months.push({ date: new Date(cur), left: getLeft(cur) });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }

  return (
    <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-5">
      <h3 className="font-heading font-semibold text-[#1B2731] mb-4">Línea de Tiempo (Gantt)</h3>
      <div className="overflow-x-auto">
        <div style={{ minWidth: 600 }}>
          {/* Month headers */}
          <div className="relative h-6 mb-2 ml-40 border-b border-[#B7CAC9]/20">
            {months.map((m, i) => (
              <span
                key={i}
                className="absolute text-[10px] text-[#B7CAC9] font-medium"
                style={{ left: `${m.left}%`, transform: "translateX(-50%)" }}
              >
                {format(m.date, "MMM yy", { locale: es })}
              </span>
            ))}
          </div>

          {/* Rows */}
          <div className="space-y-2">
            {data.map(p => {
              const colors = STATUS_COLORS[p.status] || STATUS_COLORS.active;
              const left = getLeft(p.start);
              const width = getWidth(p.start, p.end);
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="w-40 flex-shrink-0 text-right">
                    <span className="text-xs font-medium text-[#1B2731] truncate block">{p.name?.substring(0, 22) || "—"}</span>
                    <span className="text-[10px] text-[#B7CAC9]">{Math.round(p.progress || 0)}%</span>
                  </div>
                  <div className="flex-1 relative h-7 bg-[#F8FAFB] rounded">
                    {/* Today line */}
                    {todayLeft >= 0 && todayLeft <= 100 && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                        style={{ left: `${todayLeft}%` }}
                      />
                    )}
                    {/* Bar */}
                    <div
                      className="absolute top-1 bottom-1 rounded-md flex items-center overflow-hidden"
                      style={{ left: `${left}%`, width: `${width}%`, backgroundColor: colors.bar }}
                      title={`${p.name}: ${format(p.start, "dd/MM/yy")} → ${format(p.end, "dd/MM/yy")}`}
                    >
                      {/* Progress fill */}
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-black/15 rounded-l-md"
                        style={{ width: `${p.progress || 0}%` }}
                      />
                      <span className="relative text-[9px] font-semibold text-white px-1.5 truncate z-10">
                        {p.name?.substring(0, 18)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 ml-40 flex items-center gap-4 text-[10px] text-[#B7CAC9]">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-[#33A19A] inline-block" /> Activo</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-[#F59E0B] inline-block" /> En pausa</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-[#6366F1] inline-block" /> Completado</span>
            <span className="flex items-center gap-1"><span className="w-px h-3 bg-red-400 inline-block" /> Hoy</span>
          </div>
        </div>
      </div>
    </div>
  );
}