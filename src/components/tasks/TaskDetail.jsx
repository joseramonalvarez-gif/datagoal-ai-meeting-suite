import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { notifyTaskAssigned } from "./taskNotifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Clock, User, LinkIcon, ListTree, Link2, Paperclip } from "lucide-react";
import TaskSubtasks from "./TaskSubtasks";
import TaskDependencies from "./TaskDependencies";
import TaskAttachmentsComments from "./TaskAttachmentsComments";

const STATUSES = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Por hacer" },
  { value: "in_progress", label: "En progreso" },
  { value: "blocked", label: "Bloqueado" },
  { value: "in_review", label: "En revisión" },
  { value: "done", label: "Hecho" },
];

const PRIORITIES = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export default function TaskDetail({ task, open, onClose, onUpdate }) {
  const [form, setForm] = useState({
    title: "", description: "", status: "todo", priority: "medium",
    assignee_email: "", assignee_name: "", due_date: "",
  });
  // Track local task state for sub-components that need refreshes
  const [localTask, setLocalTask] = useState(task);

  useEffect(() => {
    if (task) {
      setLocalTask(task);
      setForm({
        title: task.title || "",
        description: task.description || "",
        status: task.status || "todo",
        priority: task.priority || "medium",
        assignee_email: task.assignee_email || "",
        assignee_name: task.assignee_name || "",
        due_date: task.due_date || "",
      });
    }
  }, [task]);

  const handleSave = async () => {
    const me = await base44.auth.me();
    const prevAssignee = task.assignee_email;
    await base44.entities.Task.update(task.id, form);
    if (form.assignee_email && form.assignee_email !== prevAssignee) {
      await notifyTaskAssigned({ task: { ...task, ...form }, assignedBy: me.email });
    }
    onUpdate();
    onClose();
  };

  const refreshLocalTask = async () => {
    const updated = await base44.entities.Task.filter({ id: task.id });
    if (updated[0]) setLocalTask(updated[0]);
    onUpdate();
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-[#1B2731]">Detalle de Tarea</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left column: core fields */}
          <div className="lg:col-span-3 space-y-4">
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Estado</label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Prioridad</label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Responsable</label>
                <Input value={form.assignee_name} onChange={e => setForm({ ...form, assignee_name: e.target.value })} placeholder="Nombre" className="mt-1" />
                <Input value={form.assignee_email} onChange={e => setForm({ ...form, assignee_email: e.target.value })} placeholder="Email" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Fecha límite</label>
                <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="mt-1" />
              </div>
            </div>

            {/* Evidence */}
            {task.evidence_segments?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-[#1B2731] mb-2 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-[#33A19A]" /> Evidencia de transcripción
                </h4>
                <div className="space-y-2">
                  {task.evidence_segments.map((seg, i) => (
                    <div key={i} className="p-3 bg-[#FFFAF3] rounded-lg border border-[#B7CAC9]/20">
                      <div className="flex items-center gap-2 mb-1">
                        {seg.start_time && <span className="text-xs text-[#33A19A] flex items-center gap-1"><Clock className="w-3 h-3" /> {seg.start_time}–{seg.end_time}</span>}
                        {seg.speaker_label && <span className="text-xs text-[#3E4C59] flex items-center gap-1"><User className="w-3 h-3" /> {seg.speaker_label}</span>}
                      </div>
                      <p className="text-sm text-[#1B2731] italic">"{seg.text_fragment}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments & Attachments */}
            <div className="border-t border-[#B7CAC9]/20 pt-4">
              <TaskAttachmentsComments task={task} />
            </div>
          </div>

          {/* Right column: subtasks + dependencies */}
          <div className="lg:col-span-2 space-y-5">
            <div className="p-4 bg-[#F8FAFB] rounded-xl border border-[#B7CAC9]/20 space-y-4">
              {/* Subtasks */}
              <TaskSubtasks
                parentTask={localTask || task}
                onSubtaskClick={(sub) => {
                  // Open a nested detail — for now just indicate it can be clicked
                }}
              />
            </div>

            <div className="p-4 bg-[#F8FAFB] rounded-xl border border-[#B7CAC9]/20">
              {/* Dependencies */}
              <TaskDependencies task={localTask || task} onUpdate={refreshLocalTask} />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-[#33A19A] hover:bg-[#2A857F] text-white">Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}