import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Zap, Pencil, Trash2, X, Tag } from "lucide-react";
import { toast } from "sonner";

const EMPTY_RULE = {
  name: "", description: "", trigger_type: "keyword_match", keywords: [],
  action_type: "create_task", is_active: true,
  task_template: { title_template: "Follow-up: {{meeting_title}}", description_template: "", priority: "medium", due_days_offset: 7, assignee_strategy: "none" },
};

const ACTION_LABELS = { create_task: "Crear tarea", send_email: "Enviar email", create_followup_meeting: "Reunión de seguimiento" };
const TRIGGER_LABELS = { keyword_match: "Coincidencia de palabras clave", status_change: "Cambio de estado", always: "Siempre" };

export default function WorkflowRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const [form, setForm] = useState(EMPTY_RULE);
  const [kwInput, setKwInput] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const r = await base44.entities.WorkflowRule.list("-created_date");
    setRules(r);
    setLoading(false);
  };

  const openNew = () => { setForm(EMPTY_RULE); setEditRule(null); setKwInput(""); setShowForm(true); };
  const openEdit = (r) => { setForm({ ...r, task_template: r.task_template || EMPTY_RULE.task_template }); setEditRule(r); setKwInput(""); setShowForm(true); };

  const addKeyword = () => {
    const kw = kwInput.trim().toLowerCase();
    if (kw && !form.keywords.includes(kw)) setForm({ ...form, keywords: [...form.keywords, kw] });
    setKwInput("");
  };

  const removeKeyword = (kw) => setForm({ ...form, keywords: form.keywords.filter(k => k !== kw) });

  const handleSave = async () => {
    if (editRule) {
      await base44.entities.WorkflowRule.update(editRule.id, form);
      toast.success("Regla actualizada");
    } else {
      await base44.entities.WorkflowRule.create(form);
      toast.success("Regla creada");
    }
    setShowForm(false);
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.WorkflowRule.delete(id);
    toast.success("Regla eliminada");
    load();
  };

  const toggleActive = async (rule) => {
    await base44.entities.WorkflowRule.update(rule.id, { is_active: !rule.is_active });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1B2731]">Reglas de Automatización</h1>
          <p className="text-sm text-[#3E4C59] mt-1">Define acciones automáticas post-reunión basadas en palabras clave o condiciones</p>
        </div>
        <Button onClick={openNew} className="bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2">
          <Plus className="w-4 h-4" /> Nueva regla
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" /></div>
      ) : rules.length === 0 ? (
        <div className="text-center py-16 text-[#3E4C59]">
          <Zap className="w-12 h-12 mx-auto mb-3 text-[#B7CAC9]" />
          <p className="font-medium">Sin reglas de automatización</p>
          <p className="text-sm mt-1 text-[#B7CAC9]">Crea tu primera regla para automatizar acciones post-reunión</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {rules.map(rule => (
            <div key={rule.id} className="bg-white rounded-xl border border-[#B7CAC9]/20 p-4 flex items-start gap-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${rule.is_active ? "bg-amber-50" : "bg-gray-100"}`}>
                <Zap className={`w-4 h-4 ${rule.is_active ? "text-amber-500" : "text-gray-400"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-heading font-semibold text-[#1B2731]">{rule.name}</h3>
                  <Badge className={`text-[10px] border-0 ${rule.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {rule.is_active ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                {rule.description && <p className="text-sm text-[#3E4C59] mt-0.5">{rule.description}</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge className="bg-blue-50 text-blue-700 border-0 text-[10px]">
                    Trigger: {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
                  </Badge>
                  <Badge className="bg-purple-50 text-purple-700 border-0 text-[10px]">
                    Acción: {ACTION_LABELS[rule.action_type] || rule.action_type}
                  </Badge>
                </div>
                {rule.keywords?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {rule.keywords.map(kw => (
                      <span key={kw} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#E8F5F4] text-[#33A19A] rounded text-[10px]">
                        <Tag className="w-2.5 h-2.5" /> {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch checked={rule.is_active} onCheckedChange={() => toggleActive(rule)} />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => handleDelete(rule.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editRule ? "Editar regla" : "Nueva regla de automatización"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre *</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Trigger</label>
                <Select value={form.trigger_type} onValueChange={v => setForm({ ...form, trigger_type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keyword_match">Palabras clave</SelectItem>
                    <SelectItem value="always">Siempre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Acción</label>
                <Select value={form.action_type} onValueChange={v => setForm({ ...form, action_type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create_task">Crear tarea</SelectItem>
                    <SelectItem value="send_email">Enviar email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.trigger_type === "keyword_match" && (
              <div>
                <label className="text-sm font-medium">Palabras clave</label>
                <div className="flex gap-2 mt-1">
                  <Input value={kwInput} onChange={e => setKwInput(e.target.value)}
                    placeholder="ej: urgente, próxima semana..."
                    className="flex-1 text-sm"
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addKeyword}><Plus className="w-3.5 h-3.5" /></Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {form.keywords.map(kw => (
                    <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#E8F5F4] text-[#33A19A] rounded text-xs">
                      {kw}
                      <button onClick={() => removeKeyword(kw)}><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {form.action_type === "create_task" && (
              <div className="p-3 bg-[#F8FAFB] rounded-lg space-y-3">
                <p className="text-xs font-semibold text-[#3E4C59] uppercase tracking-wide">Plantilla de tarea</p>
                <div>
                  <label className="text-xs text-[#3E4C59]">Título (usa {"{{meeting_title}}"} como variable)</label>
                  <Input value={form.task_template?.title_template || ""} onChange={e => setForm({ ...form, task_template: { ...form.task_template, title_template: e.target.value } })} className="mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-[#3E4C59]">Descripción</label>
                  <Textarea value={form.task_template?.description_template || ""} onChange={e => setForm({ ...form, task_template: { ...form.task_template, description_template: e.target.value } })} className="mt-1 text-xs" rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#3E4C59]">Prioridad</label>
                    <Select value={form.task_template?.priority || "medium"} onValueChange={v => setForm({ ...form, task_template: { ...form.task_template, priority: v } })}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baja</SelectItem>
                        <SelectItem value="medium">Media</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-[#3E4C59]">Días de plazo</label>
                    <Input type="number" min={1} value={form.task_template?.due_days_offset || 7} onChange={e => setForm({ ...form, task_template: { ...form.task_template, due_days_offset: parseInt(e.target.value) } })} className="mt-1 h-8 text-xs" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#3E4C59]">Asignar a</label>
                  <Select value={form.task_template?.assignee_strategy || "none"} onValueChange={v => setForm({ ...form, task_template: { ...form.task_template, assignee_strategy: v } })}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      <SelectItem value="meeting_organizer">Organizador de la reunión</SelectItem>
                      <SelectItem value="first_participant">Primer participante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              <label className="text-sm text-[#3E4C59]">Regla activa</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name} className="bg-[#33A19A] hover:bg-[#2A857F] text-white">
              {editRule ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}