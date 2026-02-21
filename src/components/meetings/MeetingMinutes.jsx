import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, Plus, Save, Wand2, Loader2, Edit2, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const TEMPLATES = {
  standard: {
    label: "Acta estándar",
    icon: "📋",
    build: (m, participants) => `# Acta de Reunión: ${m.title}

**Fecha:** ${m.date ? format(new Date(m.date), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es }) : "—"}
**Proyecto:** [Nombre del proyecto]
**Moderador/a:** [Nombre]

## Asistentes
${(participants || []).map(p => `- ${p.name} (${p.email}) — ${p.role || "Participante"}`).join("\n") || "- [Listado de asistentes]"}

## Objetivo de la reunión
${m.objective || "[Describir el objetivo principal de la reunión]"}

## Orden del día
1. [Punto 1]
2. [Punto 2]
3. [Punto 3]

## Desarrollo y acuerdos

### [Punto 1]
[Resumen de la discusión y acuerdos alcanzados]

### [Punto 2]
[Resumen de la discusión y acuerdos alcanzados]

## Próximos pasos / Acciones

| Acción | Responsable | Fecha límite |
|--------|-------------|--------------|
| [Acción 1] | [Nombre] | [Fecha] |
| [Acción 2] | [Nombre] | [Fecha] |

## Próxima reunión
- **Fecha propuesta:** [Fecha]
- **Objetivo:** [Objetivo]

---
*Acta generada el ${format(new Date(), "dd/MM/yyyy")} con DATA GOAL*`,
  },
  retrospective: {
    label: "Retrospectiva",
    icon: "🔄",
    build: (m, participants) => `# Retrospectiva: ${m.title}

**Fecha:** ${m.date ? format(new Date(m.date), "dd 'de' MMMM 'de' yyyy", { locale: es }) : "—"}
**Equipo:** ${(participants || []).map(p => p.name).join(", ") || "[Equipo]"}

## ¿Qué fue bien? ✅
- [Logro 1]
- [Logro 2]

## ¿Qué se puede mejorar? 🔧
- [Mejora 1]
- [Mejora 2]

## ¿Qué acciones concretas tomaremos? 🎯

| Acción | Responsable | Sprint/Fecha |
|--------|-------------|--------------|
| [Acción] | [Nombre] | [Fecha] |

## Métricas del período
- Tareas completadas: [N]
- Tareas pendientes: [N]
- Velocidad: [N] puntos

---
*Retrospectiva registrada con DATA GOAL*`,
  },
  kickoff: {
    label: "Kickoff de proyecto",
    icon: "🚀",
    build: (m, participants) => `# Kickoff: ${m.title}

**Fecha:** ${m.date ? format(new Date(m.date), "dd 'de' MMMM 'de' yyyy", { locale: es }) : "—"}

## Participantes
${(participants || []).map(p => `- **${p.name}** — ${p.role || "Equipo"} (${p.email})`).join("\n") || "- [Listado]"}

## Objetivos del proyecto
${m.objective || "[Describir objetivos estratégicos y de negocio]"}

## Alcance
### Incluye:
- [Entregable 1]
- [Entregable 2]

### No incluye:
- [Exclusión 1]

## Hitos principales
| Hito | Fecha estimada |
|------|----------------|
| [Hito 1] | [Fecha] |
| [Hito 2] | [Fecha] |

## Riesgos identificados
| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| [Riesgo] | Alto/Medio/Bajo | [Plan] |

## Acuerdos de comunicación
- Frecuencia de reuniones: [Frecuencia]
- Canal principal: [Canal]
- Responsable de comunicaciones: [Nombre]

---
*Kickoff registrado con DATA GOAL*`,
  },
  followup: {
    label: "Seguimiento de proyecto",
    icon: "📊",
    build: (m, participants) => `# Seguimiento: ${m.title}

**Fecha:** ${m.date ? format(new Date(m.date), "dd 'de' MMMM 'de' yyyy", { locale: es }) : "—"}
**Asistentes:** ${(participants || []).map(p => p.name).join(", ") || "[Asistentes]"}

## Estado general del proyecto
🟢 En tiempo / 🟡 Con alertas / 🔴 Con retrasos

## Avance desde la última reunión
- [Tarea completada 1]
- [Tarea completada 2]

## Puntos de bloqueo
- [Bloqueo 1]: [Descripción y plan de resolución]

## Revisión de hitos
| Hito | Estado | Fecha estimada | Comentarios |
|------|--------|----------------|-------------|
| [Hito 1] | ✅/⏳/❌ | [Fecha] | [Nota] |

## Acciones para el próximo período

| Acción | Responsable | Fecha límite | Prioridad |
|--------|-------------|--------------|-----------|
| [Acción] | [Nombre] | [Fecha] | Alta/Media/Baja |

## Próxima reunión de seguimiento
- **Fecha:** [Fecha]

---
*Seguimiento registrado con DATA GOAL*`,
  },
};

export default function MeetingMinutes({ meeting }) {
  const [open, setOpen] = useState(false);
  const [savedMinutes, setSavedMinutes] = useState(null);
  const [content, setContent] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("standard");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadMinutes(); }, [meeting.id]);

  const loadMinutes = async () => {
    setLoading(true);
    const docs = await base44.entities.Document.filter({
      linked_meeting_id: meeting.id,
      folder: "actas",
      is_latest: true,
    }, '-created_date', 1);
    if (docs[0]) setSavedMinutes(docs[0]);
    setLoading(false);
  };

  const applyTemplate = () => {
    const tpl = TEMPLATES[selectedTemplate];
    setContent(tpl.build(meeting, meeting.participants));
  };

  const generateWithAI = async () => {
    setGenerating(true);
    const transcript = await base44.entities.Transcript.filter({ meeting_id: meeting.id }, '-created_date', 1);
    const transcriptText = transcript[0]?.full_text || "";
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Genera un acta profesional para esta reunión en español. 
Título: ${meeting.title}
Fecha: ${meeting.date ? format(new Date(meeting.date), "dd/MM/yyyy HH:mm") : "—"}
Objetivo: ${meeting.objective || "No especificado"}
Participantes: ${(meeting.participants || []).map(p => `${p.name} (${p.role || "Participante"})`).join(", ") || "No especificados"}
${transcriptText ? `\nTranscripción disponible:\n${transcriptText.substring(0, 4000)}` : ""}

Incluye: resumen ejecutivo, puntos clave discutidos, acuerdos y decisiones tomadas, próximos pasos con responsables. Formato Markdown.`,
    });
    setContent(result);
    setGenerating(false);
    toast.success("Acta generada con IA");
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    const blob = new Blob([content], { type: "text/plain" });
    const file = new File([blob], `acta-${meeting.title?.replace(/\s+/g, "-")}-${Date.now()}.md`, { type: "text/plain" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    if (savedMinutes) {
      await base44.entities.Document.update(savedMinutes.id, { file_url, updated_date: new Date().toISOString() });
    } else {
      await base44.entities.Document.create({
        client_id: meeting.client_id,
        project_id: meeting.project_id,
        linked_meeting_id: meeting.id,
        name: `Acta: ${meeting.title}`,
        description: content.substring(0, 200),
        file_url,
        file_type: "text/markdown",
        folder: "actas",
        status: "draft",
        is_latest: true,
      });
    }
    toast.success("Acta guardada correctamente");
    setSaving(false);
    setOpen(false);
    loadMinutes();
  };

  const downloadMarkdown = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `acta-${meeting.title?.replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline" size="sm"
          className="gap-1.5 text-xs"
          onClick={() => {
            if (savedMinutes) {
              setContent(""); // will load from savedMinutes when opening editor
            } else {
              applyTemplate();
            }
            setOpen(true);
          }}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          {savedMinutes ? "Ver / editar acta" : "Crear acta"}
        </Button>
        {savedMinutes && (
          <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px]">Acta guardada</Badge>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#33A19A]" />
              Acta de reunión — {meeting.title}
            </DialogTitle>
          </DialogHeader>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-[#B7CAC9]/20">
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TEMPLATES).map(([key, t]) => (
                  <SelectItem key={key} value={key}>{t.icon} {t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={applyTemplate}>
              <Plus className="w-3.5 h-3.5" /> Aplicar plantilla
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-purple-600 border-purple-200 hover:bg-purple-50" onClick={generateWithAI} disabled={generating}>
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              Generar con IA
            </Button>
            {content && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 ml-auto" onClick={downloadMarkdown}>
                <Download className="w-3.5 h-3.5" /> .md
              </Button>
            )}
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {generating ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#3E4C59]">
                <Loader2 className="w-8 h-8 animate-spin text-[#33A19A]" />
                <p className="text-sm">Generando acta con IA…</p>
              </div>
            ) : (
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Selecciona una plantilla o genera el acta con IA para comenzar…"
                className="flex-1 w-full p-4 text-sm font-mono border border-[#B7CAC9]/30 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#33A19A]/30 leading-relaxed"
                style={{ minHeight: 360 }}
              />
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#B7CAC9]/20">
            <Button variant="outline" onClick={() => setOpen(false)}>Cerrar</Button>
            <Button onClick={handleSave} disabled={!content.trim() || saving} className="gap-1.5 bg-[#33A19A] hover:bg-[#2A857F]">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar acta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}