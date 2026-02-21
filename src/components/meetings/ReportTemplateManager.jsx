import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical, X, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MEETING_TYPE_LABELS = {
  general: "General", kickoff: "Kickoff", seguimiento: "Seguimiento",
  retrospectiva: "Retrospectiva", revision_tecnica: "Revisión Técnica", comite_direccion: "Comité de Dirección"
};

const TONE_LABELS = { formal: "Formal", ejecutivo: "Ejecutivo", tecnico: "Técnico", operativo: "Operativo" };

const DEFAULT_SECTIONS = [
  { id: "info", title: "Información General", prompt_hint: "Fecha, participantes, objetivo de la reunión", enabled: true, order: 1 },
  { id: "context", title: "Contexto y Objetivo", prompt_hint: "Por qué se convocó esta reunión y qué se esperaba lograr", enabled: true, order: 2 },
  { id: "topics", title: "Temas Tratados", prompt_hint: "Lista de temas abordados con sus puntos principales", enabled: true, order: 3 },
  { id: "decisions", title: "Decisiones y Acuerdos", prompt_hint: "Decisiones tomadas, acuerdos alcanzados y responsables", enabled: true, order: 4 },
  { id: "actions", title: "Tareas y Acciones", prompt_hint: "Acciones comprometidas con responsable, fecha y prioridad. Incluir vínculo con las tareas creadas en el sistema.", enabled: true, order: 5 },
  { id: "open", title: "Elementos Abiertos", prompt_hint: "Temas pendientes, dudas sin resolver, riesgos identificados", enabled: true, order: 6 },
  { id: "next", title: "Próximos Pasos", prompt_hint: "Siguiente reunión propuesta, hitos próximos, agenda sugerida", enabled: true, order: 7 },
  { id: "notes", title: "Observaciones del Consultor", prompt_hint: "Análisis estratégico, recomendaciones, notas internas", enabled: true, order: 8 },
];

const EMPTY_TEMPLATE = {
  name: "", meeting_type: "general", description: "", tone: "ejecutivo",
  sections: DEFAULT_SECTIONS, include_task_summary: true, include_approval_section: true, is_default: false, is_active: true
};

export default function ReportTemplateManager({ open, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(EMPTY_TEMPLATE);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) load(); }, [open]);

  const load = async () => {
    setLoading(true);
    const t = await base44.entities.ReportTemplate.list("-created_date");
    setTemplates(t);
    setLoading(false);
  };

  const openNew = () => {
    setForm(EMPTY_TEMPLATE);
    setEditId(null);
    setEditMode(true);
  };

  const openEdit = (t) => {
    setForm({ ...t, sections: t.sections?.length ? t.sections : DEFAULT_SECTIONS });
    setEditId(t.id);
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    if (editId) {
      await base44.entities.ReportTemplate.update(editId, form);
      toast.success("Plantilla actualizada");
    } else {
      await base44.entities.ReportTemplate.create(form);
      toast.success("Plantilla creada");
    }
    setSaving(false);
    setEditMode(false);
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.ReportTemplate.delete(id);
    toast.success("Plantilla eliminada");
    load();
  };

  const toggleSection = (idx) => {
    const sections = form.sections.map((s, i) => i === idx ? { ...s, enabled: !s.enabled } : s);
    setForm({ ...form, sections });
  };

  const updateSection = (idx, patch) => {
    const sections = form.sections.map((s, i) => i === idx ? { ...s, ...patch } : s);
    setForm({ ...form, sections });
  };

  const addSection = () => {
    const newSection = { id: `custom_${Date.now()}`, title: "Nueva sección", prompt_hint: "", enabled: true, order: form.sections.length + 1 };
    setForm({ ...form, sections: [...form.sections, newSection] });
  };

  const removeSection = (idx) => {
    setForm({ ...form, sections: form.sections.filter((_, i) => i !== idx) });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#33A19A]" />
            {editMode ? (editId ? "Editar plantilla" : "Nueva plantilla") : "Plantillas de informes"}
          </DialogTitle>
        </DialogHeader>

        {!editMode ? (
          <div className="space-y-3">
            <Button onClick={openNew} size="sm" className="gap-2 bg-[#33A19A] hover:bg-[#2A857F] text-white w-full">
              <Plus className="w-4 h-4" /> Nueva plantilla
            </Button>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#33A19A]" /></div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-center text-[#B7CAC9] py-6">No hay plantillas. Crea la primera para personalizar tus informes.</p>
            ) : (
              templates.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#B7CAC9]/20 bg-white">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-[#1B2731]">{t.name}</p>
                      {t.is_default && <Badge className="text-[10px] bg-[#33A19A]/10 text-[#33A19A] border-0">Por defecto</Badge>}
                      <Badge className="text-[10px] bg-blue-50 text-blue-700 border-0">{MEETING_TYPE_LABELS[t.meeting_type]}</Badge>
                      <Badge className="text-[10px] bg-gray-100 text-gray-600 border-0">{TONE_LABELS[t.tone]}</Badge>
                    </div>
                    <p className="text-xs text-[#3E4C59] mt-0.5">{t.sections?.filter(s => s.enabled).length || 0} secciones activas</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => handleDelete(t.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Nombre *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="ej: Informe Kickoff" />
              </div>
              <div>
                <label className="text-sm font-medium">Tipo de reunión</label>
                <Select value={form.meeting_type} onValueChange={v => setForm({ ...form, meeting_type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MEETING_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Tono del informe</label>
                <Select value={form.tone} onValueChange={v => setForm({ ...form, tone: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TONE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-4 pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={form.is_default} onCheckedChange={v => setForm({ ...form, is_default: v })} />
                  <span className="text-sm text-[#3E4C59]">Por defecto</span>
                </label>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={form.include_task_summary} onCheckedChange={v => setForm({ ...form, include_task_summary: v })} />
                <span className="text-sm text-[#3E4C59]">Incluir resumen de tareas vinculadas</span>
              </label>
            </div>

            {/* Sections */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Secciones del informe</label>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-[#33A19A]" onClick={addSection}>
                  <Plus className="w-3 h-3" /> Añadir sección
                </Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {form.sections.map((s, i) => (
                  <div key={s.id || i} className={`flex items-start gap-2 p-2.5 rounded-lg border transition-colors ${s.enabled ? "bg-white border-[#B7CAC9]/20" : "bg-gray-50 border-gray-200 opacity-60"}`}>
                    <GripVertical className="w-4 h-4 text-[#B7CAC9] mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <Input
                        value={s.title}
                        onChange={e => updateSection(i, { title: e.target.value })}
                        className="h-7 text-xs font-medium"
                        placeholder="Título de sección"
                      />
                      <Input
                        value={s.prompt_hint}
                        onChange={e => updateSection(i, { prompt_hint: e.target.value })}
                        className="h-7 text-xs text-[#3E4C59]"
                        placeholder="Instrucción para la IA (qué incluir)..."
                      />
                    </div>
                    <Switch checked={s.enabled} onCheckedChange={() => toggleSection(i)} />
                    <button onClick={() => removeSection(i)} className="text-red-300 hover:text-red-500 mt-1"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => setEditMode(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.name || saving} className="bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editId ? "Guardar" : "Crear"}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}