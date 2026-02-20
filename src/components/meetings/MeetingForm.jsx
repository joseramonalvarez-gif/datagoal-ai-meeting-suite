import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function MeetingForm({ open, onClose, onSave, meeting, projects, selectedClient }) {
  const [form, setForm] = useState({
    title: "", date: "", objective: "", project_id: "", source_type: "audio_upload",
    participants: [], notes: ""
  });
  const [newParticipant, setNewParticipant] = useState({ name: "", email: "", role: "" });

  useEffect(() => {
    if (meeting) {
      setForm({
        title: meeting.title || "", date: meeting.date ? meeting.date.substring(0, 16) : "",
        objective: meeting.objective || "", project_id: meeting.project_id || "",
        source_type: meeting.source_type || "audio_upload",
        participants: meeting.participants || [], notes: meeting.notes || ""
      });
    } else {
      setForm({ title: "", date: "", objective: "", project_id: "", source_type: "audio_upload", participants: [], notes: "" });
    }
  }, [meeting, open]);

  const addParticipant = () => {
    if (newParticipant.name && newParticipant.email) {
      setForm({ ...form, participants: [...form.participants, { ...newParticipant }] });
      setNewParticipant({ name: "", email: "", role: "" });
    }
  };

  const removeParticipant = (i) => {
    setForm({ ...form, participants: form.participants.filter((_, idx) => idx !== i) });
  };

  const handleSubmit = () => {
    onSave({
      ...form,
      client_id: selectedClient?.id || "",
      date: form.date ? new Date(form.date).toISOString() : new Date().toISOString(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{meeting ? "Editar Reunión" : "Nueva Reunión"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Título *</label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Proyecto *</label>
            <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar proyecto" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Fecha y hora</label>
            <Input type="datetime-local" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Objetivo</label>
            <Textarea value={form.objective} onChange={e => setForm({ ...form, objective: e.target.value })} className="mt-1" rows={2} />
          </div>

          {/* Participants */}
          <div>
            <label className="text-sm font-medium">Participantes</label>
            <div className="flex flex-wrap gap-2 mt-2 mb-2">
              {form.participants.map((p, i) => (
                <Badge key={i} className="bg-[#33A19A]/10 text-[#33A19A] border-0 gap-1 pr-1">
                  {p.name} ({p.email})
                  <button onClick={() => removeParticipant(i)} className="ml-1 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Nombre" value={newParticipant.name} onChange={e => setNewParticipant({ ...newParticipant, name: e.target.value })} className="flex-1" />
              <Input placeholder="Email" value={newParticipant.email} onChange={e => setNewParticipant({ ...newParticipant, email: e.target.value })} className="flex-1" />
              <Button type="button" size="icon" variant="outline" onClick={addParticipant}><Plus className="w-4 h-4" /></Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Notas internas</label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="mt-1" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.title || !form.project_id} className="bg-[#33A19A] hover:bg-[#2A857F] text-white">
            {meeting ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}