import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Users, CheckSquare, CalendarDays, Milestone } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday, parseISO
} from "date-fns";
import { es } from "date-fns/locale";
import CalendarICSExport from "../components/calendar/CalendarICSExport";
import CalendarEventPanel from "../components/calendar/CalendarEventPanel";
import ImportedEventsModal from "../components/calendar/ImportedEventsModal";

export default function CalendarView({ selectedClient }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [meetings, setMeetings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importedEvents, setImportedEvents] = useState(null); // events from .ics

  useEffect(() => { loadData(); }, [selectedClient, currentMonth]);

  const loadData = async () => {
    setLoading(true);
    const filters = selectedClient ? { client_id: selectedClient.id } : {};
    const [m, t, ms, p] = await Promise.all([
      selectedClient ? base44.entities.Meeting.filter(filters, '-date', 200) : base44.entities.Meeting.list('-date', 200),
      selectedClient ? base44.entities.Task.filter(filters, '-created_date', 300) : base44.entities.Task.list('-created_date', 300),
      selectedClient ? base44.entities.Milestone.filter(filters, 'target_date', 100) : base44.entities.Milestone.list('target_date', 100),
      selectedClient ? base44.entities.Project.filter({ client_id: selectedClient.id }) : base44.entities.Project.list(),
    ]);
    setMeetings(m);
    setTasks(t);
    setMilestones(ms);
    setProjects(p);
    setLoading(false);
  };

  const getDayEvents = (day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dayMeetings = meetings.filter(m => m.date && format(parseISO(m.date), "yyyy-MM-dd") === dayStr);
    const dayTasks = tasks.filter(t => t.due_date && (t.due_date === dayStr || (t.due_date.length > 10 && format(parseISO(t.due_date), "yyyy-MM-dd") === dayStr)));
    const dayMilestones = milestones.filter(ms => ms.target_date === dayStr);
    return { meetings: dayMeetings, tasks: dayTasks, milestones: dayMilestones };
  };

  const renderCalendar = () => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const days = [];
    let day = start;
    while (day <= end) { days.push(day); day = addDays(day, 1); }

    return days.map(d => {
      const { meetings: dm, tasks: dt, milestones: dms } = getDayEvents(d);
      const isSelected = selectedDay && isSameDay(d, selectedDay);
      const isCurrentMonth = isSameMonth(d, currentMonth);
      const total = dm.length + dt.filter(t => t.status !== "done").length + dms.length;

      return (
        <button
          key={d.toISOString()}
          onClick={() => setSelectedDay(isSameDay(d, selectedDay) ? null : d)}
          className={`min-h-[72px] p-2 rounded-lg border text-left transition-all
            ${isCurrentMonth ? "bg-white hover:border-[#33A19A]/50 hover:shadow-sm" : "bg-gray-50/50 opacity-40"}
            ${isToday(d) ? "border-[#33A19A] ring-1 ring-[#33A19A]/20" : "border-[#B7CAC9]/20"}
            ${isSelected ? "border-[#33A19A] bg-[#E8F5F4]" : ""}
          `}
        >
          <span className={`text-sm font-medium block mb-1
            ${isToday(d) ? "w-6 h-6 rounded-full bg-[#33A19A] text-white flex items-center justify-center text-xs font-bold" : isCurrentMonth ? "text-[#1B2731]" : "text-gray-400"}`}
            style={isToday(d) ? {} : {}}
          >
            {isToday(d) ? (
              <span className="w-6 h-6 rounded-full bg-[#33A19A] text-white flex items-center justify-center text-xs font-bold">
                {format(d, "d")}
              </span>
            ) : format(d, "d")}
          </span>
          <div className="space-y-0.5 mt-0.5">
            {dm.slice(0, 1).map(m => (
              <div key={m.id} className="text-[10px] bg-blue-100 text-blue-700 rounded px-1 py-0.5 truncate flex items-center gap-0.5">
                <Users className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">{m.title}</span>
              </div>
            ))}
            {dt.filter(t => t.status !== "done").slice(0, 1).map(t => (
              <div key={t.id} className="text-[10px] bg-orange-100 text-orange-700 rounded px-1 py-0.5 truncate flex items-center gap-0.5">
                <CheckSquare className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">{t.title}</span>
              </div>
            ))}
            {dms.slice(0, 1).map(ms => (
              <div key={ms.id} className="text-[10px] bg-purple-100 text-purple-700 rounded px-1 py-0.5 truncate flex items-center gap-0.5">
                <Milestone className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">{ms.title}</span>
              </div>
            ))}
            {total > 2 && (
              <span className="text-[10px] text-[#B7CAC9] font-medium">+{total - 2} más</span>
            )}
          </div>
        </button>
      );
    });
  };

  const handleICSImport = (events) => {
    setImportedEvents(events);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1B2731]">Calendario unificado</h1>
          <p className="text-sm text-[#3E4C59] mt-0.5">Reuniones, tareas e hitos en una vista</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalendarICSExport meetings={meetings} tasks={tasks} onImport={handleICSImport} />
          <div className="flex items-center gap-1 border-l border-[#B7CAC9]/30 pl-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-heading font-semibold text-[#1B2731] min-w-36 text-center capitalize text-sm">
              {format(currentMonth, "MMMM yyyy", { locale: es })}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()); }} className="text-xs h-8">Hoy</Button>
          </div>
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
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">{renderCalendar()}</div>
          )}
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-[#3E4C59]"><div className="w-3 h-3 rounded bg-blue-100" /> Reuniones</div>
            <div className="flex items-center gap-1.5 text-xs text-[#3E4C59]"><div className="w-3 h-3 rounded bg-orange-100" /> Tareas</div>
            <div className="flex items-center gap-1.5 text-xs text-[#3E4C59]"><div className="w-3 h-3 rounded bg-purple-100" /> Hitos</div>
            <div className="flex items-center gap-1.5 text-xs text-[#33A19A]"><div className="w-3 h-3 rounded-full border-2 border-[#33A19A]" /> Hoy</div>
          </div>
        </div>

        {/* Side panel */}
        <CalendarEventPanel
          selectedDay={selectedDay}
          meetings={meetings}
          tasks={tasks}
          projects={projects}
          selectedClient={selectedClient}
          onRefresh={loadData}
        />
      </div>

      {/* ICS Import modal */}
      {importedEvents && (
        <ImportedEventsModal
          open={!!importedEvents}
          onClose={() => { setImportedEvents(null); loadData(); }}
          events={importedEvents}
          projects={projects}
          selectedClient={selectedClient}
        />
      )}
    </div>
  );
}