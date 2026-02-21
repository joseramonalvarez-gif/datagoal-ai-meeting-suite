import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const EVENT_OPTIONS = {
  qa_center: [
    { value: "qa_run_failed", label: "Run fallido (todos los checks críticos)", hint: "Se dispara cuando el run termina con status FAILED" },
    { value: "qa_run_completed", label: "Run completado exitosamente", hint: "Se dispara cuando el run termina con status SUCCESS" },
    { value: "qa_run_partial", label: "Run parcial (algunos fallos)", hint: "Se dispara cuando hay fallos no críticos" },
    { value: "qa_check_failed", label: "Check específico fallido", hint: "Se dispara cuando un check concreto falla" },
  ],
  meetings: [
    { value: "meeting_transcribed", label: "Transcripción lista", hint: "Cuando se completa la transcripción de una reunión" },
    { value: "meeting_report_generated", label: "Informe generado", hint: "Cuando se genera el informe de una reunión" },
    { value: "meeting_scheduled", label: "Reunión programada", hint: "Cuando se crea una nueva reunión" },
  ],
};

const RECIPIENT_OPTIONS = [
  { value: "fixed_list", label: "Lista fija de emails" },
  { value: "participants", label: "Participantes de la reunión" },
  { value: "project_leads", label: "Project leads del proyecto" },
  { value: "management", label: "Contactos de dirección (cliente)" },
  { value: "all", label: "Todos (participantes + leads + dirección)" },
];

export default function RuleEditor({ rule, templates, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: rule?.name || "",
    description: rule?.description || "",
    event_source: rule?.event_source || "meetings",
    event_type: rule?.event_type || "",
    conditions: rule?.conditions || { min_failures: 0, check_codes: [] },
    template_id: rule?.template_id || "",
    recipients_type: rule?.recipients_type || "fixed_list",
    recipients_emails: rule?.recipients_emails || [],
    send_email: rule?.send_email !== false,
    send_in_app: rule?.send_in_app !== false,
    is_active: rule?.is_active !== false,
    ...(rule?.id ? { id: rule.id } : {}),
  });
  const [newEmail, setNewEmail] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setCondition = (k, v) => setForm(f => ({ ...f, conditions: { ...f.conditions, [k]: v } }));

  const addEmail = () => {
    if (!newEmail.includes("@")) return;
    set("recipients_emails", [...form.recipients_emails, newEmail.trim()]);
    setNewEmail("");
  };

  const removeEmail = (i) => set("recipients_emails", form.recipients_emails.filter((_, idx) => idx !== i));

  const handleSave = () => {
    if (!form.name || !form.event_source || !form.event_type) {
      toast.error("Nombre, origen y tipo de evento son obligatorios");
      return;
    }
    if (!form.send_email && !form.send_in_app) {
      toast.error("Activa al menos un canal (email o in-app)");
      return;
    }
    onSave(form);
  };

  const currentEvents = EVENT_OPTIONS[form.event_source] || [];

  return (
    <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-semibold text-lg text-[#1B2731]">
          {form.id ? "Editar regla" : "Nueva regla"}
        </h2>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Activa</Label>
          <Switch checked={form.is_active} onCheckedChange={v => set("is_active", v)} />
        </div>
      </div>

      {/* Basic info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Nombre de la regla *</Label>
          <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ej. Alerta run QA fallido" />
        </div>
        <div className="space-y-1.5">
          <Label>Descripción</Label>
          <Input value={form.description} onChange={e => set("description", e.target.value)} placeholder="Descripción opcional" />
        </div>
      </div>

      {/* Event trigger */}
      <div className="bg-[#FFFAF3] rounded-lg border border-[#B7CAC9]/20 p-4 space-y-4">
        <h3 className="font-semibold text-sm text-[#1B2731]">Disparador (evento)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Origen *</Label>
            <Select value={form.event_source} onValueChange={v => { set("event_source", v); set("event_type", ""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="meetings">Reuniones</SelectItem>
                <SelectItem value="qa_center">QA Center</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Evento *</Label>
            <Select value={form.event_type} onValueChange={v => set("event_type", v)}>
              <SelectTrigger><SelectValue placeholder="Selecciona evento..." /></SelectTrigger>
              <SelectContent>
                {currentEvents.map(e => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.event_type && (
              <p className="text-[11px] text-[#3E4C59]">
                {currentEvents.find(e => e.value === form.event_type)?.hint}
              </p>
            )}
          </div>
        </div>

        {/* QA-specific conditions */}
        {form.event_source === "qa_center" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Mín. checks fallidos para disparar</Label>
              <Input
                type="number" min={0}
                value={form.conditions.min_failures || 0}
                onChange={e => setCondition("min_failures", parseInt(e.target.value) || 0)}
                className="h-8 text-sm"
                placeholder="0 = siempre"
              />
              <p className="text-[10px] text-[#B7CAC9]">0 = disparar siempre que ocurra el evento</p>
            </div>
          </div>
        )}
      </div>

      {/* Channels */}
      <div className="bg-[#FFFAF3] rounded-lg border border-[#B7CAC9]/20 p-4 space-y-4">
        <h3 className="font-semibold text-sm text-[#1B2731]">Canales de notificación</h3>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={form.send_email} onCheckedChange={v => set("send_email", v)} />
            <span className="text-sm">Email</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={form.send_in_app} onCheckedChange={v => set("send_in_app", v)} />
            <span className="text-sm">Notificación in-app</span>
          </label>
        </div>

        {form.send_email && (
          <div className="space-y-1.5">
            <Label>Plantilla de email</Label>
            <Select value={form.template_id || "none"} onValueChange={v => set("template_id", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Sin plantilla (usar por defecto)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin plantilla (usar por defecto)</SelectItem>
                {templates.filter(t => t.is_active !== false).map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Recipients */}
      <div className="bg-[#FFFAF3] rounded-lg border border-[#B7CAC9]/20 p-4 space-y-4">
        <h3 className="font-semibold text-sm text-[#1B2731]">Destinatarios</h3>
        <div className="space-y-1.5">
          <Label>Tipo de destinatarios</Label>
          <Select value={form.recipients_type} onValueChange={v => set("recipients_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RECIPIENT_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {form.recipients_type === "fixed_list" && (
          <div className="space-y-2">
            <Label className="text-xs">Emails</Label>
            <div className="flex gap-2">
              <Input
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addEmail()}
                placeholder="email@ejemplo.com"
                className="h-8 text-sm flex-1"
              />
              <Button size="sm" onClick={addEmail} variant="outline" className="h-8 gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" />Añadir
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.recipients_emails.map((e, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs bg-[#E8F5F4] text-[#1B2731] px-2 py-0.5 rounded-full border border-[#33A19A]/20">
                  {e}
                  <button onClick={() => removeEmail(i)} className="text-[#B7CAC9] hover:text-red-500 ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} className="gap-1.5"><X className="w-4 h-4" />Cancelar</Button>
        <Button onClick={handleSave} className="gap-1.5 bg-[#33A19A] hover:bg-[#2A857F]"><Save className="w-4 h-4" />Guardar regla</Button>
      </div>
    </div>
  );
}