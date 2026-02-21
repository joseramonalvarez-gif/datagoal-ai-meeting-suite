import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Users, CheckSquare, Plus, X, Edit2, ExternalLink, CalendarPlus, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";
import { toast } from "sonner";

const PRIORITY_COLORS = {
  urgent: "bg-red-50 text-red-700",
  high: "bg-amber-50 text-amber-700",
  medium: "bg-blue-50 text-blue-700",
  low: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS = {
  todo: "Por hacer", in_progress: "En progreso", blocked: "Bloqueado",
  done: "Hecho", backlog: "Backlog", in_review: "En revisión"
};

export default function CalendarEventPanel({ selectedDay, meetings, tasks, projects, selectedClient, onRefresh }) {
  const [mode, setMode] = useState(null); // null | "new-meeting" | "new-task" | "edit-task"
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const [meetingForm, setMeetingForm] = useState({ title: "", objective: "", project_id: "" });
  const [taskForm, setTaskForm] = useState({ title: "", description: "", project_id: "", priority: "medium", assignee_name: "", assignee_email: "" });

  if (!selectedDay) return null;

  const dayStr = format(selectedDay, "yyyy-MM-dd");
  const dayMeetings = meetings.filter(m => m.date && format(parseISO(m.date), "yyyy-MM-dd") === dayStr);
  const dayTasks = tasks.filter(t => t.due_date === dayStr || (t.due_date && format(parseISO(t.due_date), "yyyy-MM-dd") === dayStr));

  const resetForms = () => {
    setMode(null);
    setEditTarget(null);
    setMeetingForm({ title: "", objective: "", project_id: "" });
    setTaskForm({ title: "", description: "", project_id: "", priority: "medium", assignee_name: "", assignee_email: "" });
  };

  const handleCreateMeeting = async () => {
    if (!meetingForm.title || !meetingForm.project_id) return;
    setSaving(true);
    await base44.entities.Meeting.create({
      ...meetingForm,
      client_id: selectedClient?.id || "",
      date: new Date(selectedDay).toISOString(),
      status: "scheduled",
    });
    toast.success("Reunión creada");
    setSaving(false);
    resetForms();
    onRefresh?.();
  };

  const handleCreateTask = async () => {
    if (!taskForm.title || !taskForm.project_id) return;
    setSaving(true);
    await base44.entities.Task.create({
      ...taskForm,
      client_id: selectedClient?.id || "",
      due_date: dayStr,
      status: "todo",
    });
    toast.success("Tarea creada");
    setSaving(false);
    resetForms();
    onRefresh?.();
  };

  const handleUpdateTask = async () => {
    if (!editTarget) return;
    setSaving(true);
    await base44.entities.Task.update(editTarget.id, {
      title: taskForm.title,
      description: taskForm.description,
      priority: taskForm.priority,
      assignee_name: taskForm.assignee_name,
      assignee_email: taskForm.assignee_email,
      due_date: dayStr,
    });
    toast.success("Tarea actualizada");
    setSaving(false);
    resetForms();
    onRefresh?.();
  };

  const startEditTask = (task) => {
    setEditTarget(task);
    setTaskForm({
      title: task.title || "",
      description: task.description || "",
      project_id: task.project_id || "",
      priority: task.priority || "medium",
      assignee_name: task.assignee_name || "",
      assignee_email: task.assignee_email || "",
    });
    setMode("edit-task");
  };

  const buildGCalUrl = (meeting) => {
    const start = meeting.date ? new Date(meeting.date) : selectedDay;
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const fmt = d => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const guests = (meeting.participants || []).map(p => p.email).filter(Boolean).join(",");
    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(meeting.title)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent(meeting.objective || "")}&add=${encodeURIComponent(guests)}`;
  };

  return (
    <div className="lg:w-80 bg-white rounded-xl border border-[#B7CAC9]/20 p-4 space-y-4 h-fit">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-[#1B2731] capitalize text-sm">
          {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
        </h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 text-[#33A19A]" onClick={() => { resetForms(); setMode("new-meeting"); }}>
            <Users className="w-3 h-3" /> Reunión
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 text-orange-600" onClick={() => { resetForms(); setMode("new-task"); }}>
            <CheckSquare className="w-3 h-3" /> Tarea
          </Button>
        </div>
      </div>

      {/* New Meeting Form */}
      {mode === "new-meeting" && (
        <div className="p-3 bg-blue-50 rounded-lg space-y-2 border border-blue-200">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-blue-700">Nueva reunión</p>
            <button onClick={resetForms}><X className="w-3.5 h-3.5 text-blue-400" /></button>
          </div>
          <Input placeholder="Título *" value={meetingForm.title} onChange={e => setMeetingForm({ ...meetingForm, title: e.target.value })} className="h-8 text-xs" />
          <Select value={meetingForm.project_id} onValueChange={v => setMeetingForm({ ...meetingForm, project_id: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Proyecto *" /></SelectTrigger>
            <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <Textarea placeholder="Objetivo" value={meetingForm.objective} onChange={e => setMeetingForm({ ...meetingForm, objective: e.target.value })} className="text-xs" rows={2} />
          <Button size="sm" className="w-full h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={handleCreateMeeting} disabled={!meetingForm.title || !meetingForm.project_id || saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Crear reunión"}
          </Button>
        </div>
      )}

      {/* New / Edit Task Form */}
      {(mode === "new-task" || mode === "edit-task") && (
        <div className="p-3 bg-orange-50 rounded-lg space-y-2 border border-orange-200">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-orange-700">{mode === "edit-task" ? "Editar tarea" : "Nueva tarea"}</p>
            <button onClick={resetForms}><X className="w-3.5 h-3.5 text-orange-400" /></button>
          </div>
          <Input placeholder="Título *" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} className="h-8 text-xs" />
          {mode === "new-task" && (
            <Select value={taskForm.project_id} onValueChange={v => setTaskForm({ ...taskForm, project_id: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Proyecto *" /></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Select value={taskForm.priority} onValueChange={v => setTaskForm({ ...taskForm, priority: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baja</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Responsable" value={taskForm.assignee_name} onChange={e => setTaskForm({ ...taskForm, assignee_name: e.target.value })} className="h-8 text-xs" />
          </div>
          <Textarea placeholder="Descripción" value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} className="text-xs" rows={2} />
          <Button size="sm" className="w-full h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
            onClick={mode === "edit-task" ? handleUpdateTask : handleCreateTask}
            disabled={!taskForm.title || (mode === "new-task" && !taskForm.project_id) || saving}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : mode === "edit-task" ? "Guardar cambios" : "Crear tarea"}
          </Button>
        </div>
      )}

      {/* No events */}
      {dayMeetings.length === 0 && dayTasks.length === 0 && mode === null && (
        <p className="text-xs text-[#B7CAC9] text-center py-2">Sin eventos. Usa los botones para añadir.</p>
      )}

      {/* Meetings list */}
      {dayMeetings.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[#3E4C59] uppercase tracking-wider mb-2">Reuniones</p>
          <div className="space-y-2">
            {dayMeetings.map(m => (
              <div key={m.id} className="p-2.5 rounded-lg bg-blue-50 border border-blue-100 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-800 truncate">{m.title}</p>
                    <p className="text-[10px] text-blue-600 mt-0.5">{m.date ? format(parseISO(m.date), "HH:mm") : "—"} · {m.participants?.length || 0} participantes</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <a href={buildGCalUrl(m)} target="_blank" rel="noopener noreferrer" title="Añadir a Google Calendar">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-400 hover:text-blue-700"><CalendarPlus className="w-3 h-3" /></Button>
                    </a>
                    <Link to={createPageUrl("Meetings")}>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-400 hover:text-blue-700"><ExternalLink className="w-3 h-3" /></Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks list */}
      {dayTasks.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[#3E4C59] uppercase tracking-wider mb-2">Tareas</p>
          <div className="space-y-2">
            {dayTasks.map(t => (
              <div key={t.id} className="p-2.5 rounded-lg bg-orange-50 border border-orange-100 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium text-orange-800 truncate ${t.status === "done" ? "line-through opacity-60" : ""}`}>{t.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <Badge className={`text-[9px] py-0 px-1 border-0 ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</Badge>
                      <span className="text-[10px] text-orange-600">{STATUS_LABELS[t.status] || t.status}</span>
                      {t.assignee_name && <span className="text-[10px] text-orange-600">· {t.assignee_name}</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-orange-400 hover:text-orange-700 flex-shrink-0" onClick={() => startEditTask(t)}>
                    <Edit2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}