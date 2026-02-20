import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { notifyTaskAssigned, notifyTaskMention } from "./taskNotifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Clock, User, MessageSquare, Paperclip, LinkIcon, Send } from "lucide-react";

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
  const [comment, setComment] = useState("");

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
    const me = await base44.auth.me();
    const prevAssignee = task.assignee_email;
    await base44.entities.Task.update(task.id, form);
    // Notify if assignee changed
    if (form.assignee_email && form.assignee_email !== prevAssignee) {
      await notifyTaskAssigned({
        task: { ...task, ...form },
        assignedBy: me.email,
      });
    }
    onUpdate();
    onClose();
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    const me = await base44.auth.me();
    // Detect @mentions: emails written as @email or plain email patterns
    const mentionRegex = /@([\w.+-]+@[\w-]+\.[\w.]+)/g;
    const mentions = [...comment.matchAll(mentionRegex)].map(m => m[1]);
    // Also check watchers list for mentions by name
    const allWatchers = task.watchers || [];

    const updatedChecklist = task.checklist || [];
    // Store comment as a checklist item (quick approach without dedicated comment field)
    // We use a separate field comment in evidence_segments style — actually we just append to description for simplicity
    // Better: store as audit log + notification
    for (const email of mentions) {
      await notifyTaskMention({
        task: { ...task },
        mentionedEmail: email,
        commentText: comment,
        mentionedBy: me.email,
      });
    }

    await base44.entities.AuditLog.create({
      user_email: me.email,
      client_id: task.client_id || "",
      project_id: task.project_id || "",
      action: "task_comment",
      entity_type: "Task",
      entity_id: task.id,
      details: `Comentario en "${task.title}": ${comment}`,
      timestamp: new Date().toISOString(),
    });

    setComment("");
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
          {/* Comment / mention */}
          <div>
            <h4 className="text-sm font-semibold text-[#1B2731] mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#33A19A]" /> Comentario / Mención
            </h4>
            <p className="text-xs text-[#3E4C59] mb-2">Usa @email para mencionar a alguien (ej. @usuario@empresa.com)</p>
            <div className="flex gap-2">
              <Textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Escribe un comentario... menciona con @email"
                rows={2}
                className="flex-1 text-sm"
              />
              <Button size="sm" onClick={handleAddComment} disabled={!comment.trim()} className="self-end bg-[#33A19A] hover:bg-[#2A857F] text-white gap-1">
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-[#33A19A] hover:bg-[#2A857F] text-white">Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}