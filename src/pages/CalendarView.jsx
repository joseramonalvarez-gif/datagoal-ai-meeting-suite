import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, Users, CheckSquare } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { createPageUrl } from "../utils";
import { Link } from "react-router-dom";

export default function CalendarView({ selectedClient }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [meetings, setMeetings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedClient) return;
    loadData();
  }, [selectedClient, currentMonth]);

  const loadData = async () => {
    setLoading(true);
    const [m, t] = await Promise.all([
      base44.entities.Meeting.filter({ client_id: selectedClient.id }),
      base44.entities.Task.filter({ client_id: selectedClient.id }),
    ]);
    setMeetings(m);
    setTasks(t);
    setLoading(false);
  };

  const getDayEvents = (day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dayMeetings = meetings.filter(m => m.date && format(parseISO(m.date), "yyyy-MM-dd") === dayStr);
    const dayTasks = tasks.filter(t => t.due_date && format(parseISO(t.due_date), "yyyy-MM-dd") === dayStr);
    return { meetings: dayMeetings, tasks: dayTasks };
  };

  const renderCalendar = () => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const days = [];
    let day = start;
    while (day <= end) { days.push(day); day = addDays(day, 1); }

    return days.map(d => {
      const { meetings: dm, tasks: dt } = getDayEvents(d);
      const hasEvents = dm.length > 0 || dt.length > 0;
      const isSelected = selectedDay && isSameDay(d, selectedDay);
      const isCurrentMonth = isSameMonth(d, currentMonth);

      return (
        <button
          key={d.toISOString()}
          onClick={() => setSelectedDay(isSameDay(d, selectedDay) ? null : d)}
          className={`min-h-16 p-2 rounded-lg border text-left transition-all
            ${isCurrentMonth ? "bg-white hover:border-[#33A19A]" : "bg-gray-50 opacity-40"}
            ${isToday(d) ? "border-[#33A19A] ring-1 ring-[#33A19A]/20" : "border-[#B7CAC9]/20"}
            ${isSelected ? "border-[#33A19A] bg-[#33A19A]/5" : ""}
          `}
        >
          <span className={`text-sm font-medium block mb-1
            ${isToday(d) ? "text-[#33A19A] font-bold" : isCurrentMonth ? "text-[#1B2731]" : "text-gray-400"}
          `}>
            {format(d, "d")}
          </span>
          <div className="space-y-0.5">
            {dm.slice(0, 2).map(m => (
              <div key={m.id} className="text-[10px] bg-blue-100 text-blue-700 rounded px-1 py-0.5 truncate flex items-center gap-0.5">
                <Users className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">{m.title}</span>
              </div>
            ))}
            {dt.slice(0, 2).map(t => (
              <div key={t.id} className="text-[10px] bg-orange-100 text-orange-700 rounded px-1 py-0.5 truncate flex items-center gap-0.5">
                <CheckSquare className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">{t.title}</span>
              </div>
            ))}
            {(dm.length + dt.length) > 4 && (
              <span className="text-[10px] text-[#3E4C59]">+{dm.length + dt.length - 4} más</span>
            )}
          </div>
        </button>
      );
    });
  };

  const selectedEvents = selectedDay ? getDayEvents(selectedDay) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-[#1B2731]">Calendario</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-heading font-semibold text-[#1B2731] min-w-36 text-center capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: es })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())} className="text-xs ml-2">Hoy</Button>
        </div>
      </div>

      <div className="flex gap-4 flex-col lg:flex-row">
        <div className="flex-1">
          {/* Day labels */}
          <div className="grid grid-cols-7 mb-2">
            {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(d => (
              <div key={d} className="text-center text-xs font-medium text-[#3E4C59] py-2">{d}</div>
            ))}
          </div>
          {/* Calendar grid */}
          {loading ? (
            <div className="flex justify-center py-20"><div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" /></div>
          ) : (
            <div className="grid grid-cols-7 gap-1">{renderCalendar()}</div>
          )}
          {/* Legend */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-[#3E4C59]">
              <div className="w-3 h-3 rounded bg-blue-100" /> Reuniones
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#3E4C59]">
              <div className="w-3 h-3 rounded bg-orange-100" /> Tareas con fecha
            </div>
          </div>
        </div>

        {/* Day detail panel */}
        {selectedDay && selectedEvents && (
          <div className="lg:w-72 bg-white rounded-xl border border-[#B7CAC9]/20 p-4 space-y-4 h-fit">
            <h3 className="font-heading font-semibold text-[#1B2731] capitalize">
              {format(selectedDay, "EEEE d MMMM", { locale: es })}
            </h3>
            {selectedEvents.meetings.length === 0 && selectedEvents.tasks.length === 0 && (
              <p className="text-sm text-[#B7CAC9]">Sin eventos este día</p>
            )}
            {selectedEvents.meetings.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#3E4C59] uppercase tracking-wide mb-2">Reuniones</p>
                <div className="space-y-2">
                  {selectedEvents.meetings.map(m => (
                    <Link key={m.id} to={createPageUrl("Meetings")} className="block p-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
                      <p className="text-sm font-medium text-blue-800 truncate">{m.title}</p>
                      <p className="text-xs text-blue-600 mt-0.5">{m.date ? format(parseISO(m.date), "HH:mm") : "—"}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {selectedEvents.tasks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#3E4C59] uppercase tracking-wide mb-2">Tareas</p>
                <div className="space-y-2">
                  {selectedEvents.tasks.map(t => (
                    <Link key={t.id} to={createPageUrl("Tasks")} className="block p-2 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors">
                      <p className="text-sm font-medium text-orange-800 truncate">{t.title}</p>
                      <Badge className={`text-[10px] mt-0.5 border-0 ${t.priority === "urgent" ? "bg-red-100 text-red-700" : t.priority === "high" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                        {t.priority}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}