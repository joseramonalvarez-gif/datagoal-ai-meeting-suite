import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { notifyTaskAssigned, notifyTaskMention } from "./taskNotifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Clock, User, MessageSquare, Paperclip, LinkIcon } from "lucide-react";

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
    title: task?.title || "",
    description: task?.description || "",
    status: task?.status || "todo",
    priority: task?.priority || "medium",
    assignee_email: task?.assignee_email || "",
    assignee_name: task?.assignee_name || "",
    due_date: task?.due_date || "",
  });

  React.useEffect(() => {
    if (task) {
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
    await base44.entities.Task.update(task.id, form);
    onUpdate();
    onClose();
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Detalle de Tarea</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium">Título</label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Descripción</label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Estado</label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Prioridad</label>
              <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
                <LinkIcon className="w-4 h-4 text-[#33A19A]" /> Evidencia de la transcripción
              </h4>
              <div className="space-y-2">
                {task.evidence_segments.map((seg, i) => (
                  <div key={i} className="p-3 bg-[#FFFAF3] rounded-lg border border-[#B7CAC9]/20">
                    <div className="flex items-center gap-2 mb-1">
                      {seg.start_time && (
                        <span className="text-xs text-[#33A19A] flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {seg.start_time}–{seg.end_time}
                        </span>
                      )}
                      {seg.speaker_label && (
                        <span className="text-xs text-[#3E4C59] flex items-center gap-1">
                          <User className="w-3 h-3" /> {seg.speaker_label}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#1B2731] italic">"{seg.text_fragment}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-[#33A19A] hover:bg-[#2A857F] text-white">Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}