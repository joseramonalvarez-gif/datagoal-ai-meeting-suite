import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, X, Info } from "lucide-react";
import { toast } from "sonner";

const VARIABLE_HINTS = [
  { key: "meeting_title", desc: "Título de la reunión" },
  { key: "meeting_date", desc: "Fecha de la reunión" },
  { key: "client_name", desc: "Nombre del cliente" },
  { key: "project_name", desc: "Nombre del proyecto" },
  { key: "qa_run_id", desc: "ID del run de QA" },
  { key: "qa_status", desc: "Estado del run (PASSED/FAILED/PARTIAL)" },
  { key: "qa_failed_count", desc: "Número de checks fallidos" },
  { key: "report_title", desc: "Título del informe" },
  { key: "triggered_by", desc: "Usuario que desencadenó el evento" },
];

export default function TemplateEditor({ template, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: template?.name || "",
    description: template?.description || "",
    subject: template?.subject || "",
    body_html: template?.body_html || getDefaultBody(),
    variables: template?.variables || [],
    is_active: template?.is_active !== false,
    ...(template?.id ? { id: template.id } : {}),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.name || !form.subject || !form.body_html) {
      toast.error("Nombre, asunto y cuerpo son obligatorios");
      return;
    }
    // Auto-detect variables from subject + body
    const allText = form.subject + " " + form.body_html;
    const found = [...allText.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
    const uniqueVars = [...new Set(found)];
    onSave({ ...form, variables: uniqueVars });
  };

  const insertVar = (key) => {
    set("body_html", form.body_html + `{{${key}}}`);
  };

  return (
    <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-semibold text-lg text-[#1B2731]">
          {form.id ? "Editar plantilla" : "Nueva plantilla"}
        </h2>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Activa</Label>
          <Switch checked={form.is_active} onCheckedChange={v => set("is_active", v)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Nombre *</Label>
          <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ej. Informe generado" />
        </div>
        <div className="space-y-1.5">
          <Label>Descripción</Label>
          <Input value={form.description} onChange={e => set("description", e.target.value)} placeholder="Descripción breve" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Asunto * <span className="text-[#B7CAC9] text-xs">(usa {"{{variable}}"} para valores dinámicos)</span></Label>
        <Input value={form.subject} onChange={e => set("subject", e.target.value)} placeholder="Ej. [DATA GOAL] Informe listo: {{meeting_title}}" />
      </div>

      {/* Variable hints */}
      <div className="bg-[#E8F5F4] rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-[#33A19A]">
          <Info className="w-3.5 h-3.5" /> Variables disponibles (click para insertar en el cuerpo)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {VARIABLE_HINTS.map(v => (
            <button
              key={v.key}
              onClick={() => insertVar(v.key)}
              title={v.desc}
              className="text-[11px] bg-white border border-[#33A19A]/30 text-[#33A19A] px-2 py-0.5 rounded font-mono hover:bg-[#33A19A] hover:text-white transition-colors"
            >
              {`{{${v.key}}}`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Cuerpo HTML *</Label>
        <textarea
          value={form.body_html}
          onChange={e => set("body_html", e.target.value)}
          rows={12}
          className="w-full text-sm border border-[#B7CAC9]/40 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-[#33A19A]/30 font-mono leading-relaxed"
          placeholder="<h2>Asunto</h2><p>Cuerpo del email con {{variables}}</p>"
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} className="gap-1.5"><X className="w-4 h-4" />Cancelar</Button>
        <Button onClick={handleSave} className="gap-1.5 bg-[#33A19A] hover:bg-[#2A857F]"><Save className="w-4 h-4" />Guardar plantilla</Button>
      </div>
    </div>
  );
}

function getDefaultBody() {
  return `<h2>{{meeting_title}}</h2>
<p>Hola,</p>
<p>Se ha producido un evento en <strong>DATA GOAL</strong> que requiere tu atención.</p>
<p><strong>Cliente:</strong> {{client_name}}<br>
<strong>Proyecto:</strong> {{project_name}}<br>
<strong>Fecha:</strong> {{meeting_date}}</p>
<hr>
<p style="color:#3E4C59;font-size:12px">Este mensaje fue generado automáticamente por DATA GOAL.</p>`;
}