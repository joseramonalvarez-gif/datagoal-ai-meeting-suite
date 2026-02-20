import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Mic, Brain, ListChecks, Mail, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function MeetingActions({ meeting, onUpdate }) {
  const [processing, setProcessing] = useState(null);

  const handleUploadAudio = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mp3,.wav,.m4a,.ogg,.webm,.mp4";
    input.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setProcessing("audio");
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Meeting.update(meeting.id, { audio_url: file_url, source_type: "audio_upload", status: "recorded" });
      toast.success("Audio subido correctamente");
      setProcessing(null);
      onUpdate();
    });
    input.click();
  };

  const handleUploadTranscript = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.vtt,.srt,.doc,.docx,.pdf";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setProcessing("transcript_upload");
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Extract text from the file
      const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            text_content: { type: "string", description: "Full text content of the file" },
            segments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  start_time: { type: "string" },
                  end_time: { type: "string" },
                  speaker_id: { type: "string" },
                  speaker_label: { type: "string" },
                  text_literal: { type: "string" }
                }
              }
            }
          }
        }
      });

      const hasSegments = extracted.output?.segments && extracted.output.segments.length > 0;
      
      await base44.entities.Transcript.create({
        meeting_id: meeting.id,
        client_id: meeting.client_id,
        project_id: meeting.project_id,
        version: 1,
        status: hasSegments ? "completed" : "no_timeline",
        has_timeline: hasSegments,
        has_diarization: hasSegments,
        segments: extracted.output?.segments || [],
        full_text: extracted.output?.text_content || "",
        source: "manual_upload",
      });

      await base44.entities.Meeting.update(meeting.id, { source_type: "transcript_upload", status: "transcribed" });
      toast.success("Transcripción subida correctamente");
      setProcessing(null);
      onUpdate();
    };
    input.click();
  };

  const handleTranscribe = async () => {
    if (!meeting.audio_url) {
      toast.error("No hay audio para transcribir");
      return;
    }
    setProcessing("transcribe");
    
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Transcribe this audio file literally. Identify different speakers and provide timestamps. 
      Format the output as segments with start_time, end_time, speaker_id, speaker_label, and text_literal.
      Be extremely literal - do not summarize or clean up the text.`,
      file_urls: [meeting.audio_url],
      response_json_schema: {
        type: "object",
        properties: {
          segments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                start_time: { type: "string" },
                end_time: { type: "string" },
                speaker_id: { type: "string" },
                speaker_label: { type: "string" },
                text_literal: { type: "string" }
              }
            }
          },
          full_text: { type: "string" }
        }
      }
    });

    const existingTranscripts = await base44.entities.Transcript.filter({ meeting_id: meeting.id });
    const nextVersion = existingTranscripts.length + 1;

    await base44.entities.Transcript.create({
      meeting_id: meeting.id,
      client_id: meeting.client_id,
      project_id: meeting.project_id,
      version: nextVersion,
      status: "completed",
      has_timeline: true,
      has_diarization: true,
      segments: result.segments || [],
      full_text: result.full_text || "",
      source: "audio_transcription",
      ai_metadata: { model: "gemini", generated_at: new Date().toISOString() }
    });

    await base44.entities.Meeting.update(meeting.id, { status: "transcribed" });
    toast.success("Transcripción completada");
    setProcessing(null);
    onUpdate();
  };

  const handleGenerateReport = async () => {
    setProcessing("report");
    const transcripts = await base44.entities.Transcript.filter({ meeting_id: meeting.id }, '-version', 1);
    const transcript = transcripts[0];
    if (!transcript) {
      toast.error("No hay transcripción disponible");
      setProcessing(null);
      return;
    }

    const transcriptText = transcript.full_text || transcript.segments?.map(s => 
      `${s.start_time || ""}-${s.end_time || ""} | ${s.speaker_label || s.speaker_id || ""} | "${s.text_literal || ""}"`
    ).join("\n") || "";

    const PROMPT = `Actúa como un consultor senior de Nevada & Amurai. Tienes ante ti una transcripción completa de una reunión. Analízala y construye un informe profesional, exhaustivo y accionable siguiendo la estructura proporcionada más abajo. El informe debe interpretar, no solo resumir, y facilitar la toma de decisiones del cliente y el seguimiento interno del proyecto.

Estructura del Informe:
1. INFORMACIÓN GENERAL
2. OBJETIVO Y CONTEXTO DE LA SESIÓN
3. TEMAS PRINCIPALES ABORDADOS
4. ANÁLISIS DE LOS ELEMENTOS CLAVE
5. ACUERDOS Y DECISIONES TOMADAS
6. ACCIONES COMPROMETIDAS Y PROPIETARIOS
7. ELEMENTOS ABIERTOS O PENDIENTES
8. PROPUESTA DE PRÓXIMOS PASOS
9. OBSERVACIONES DEL CONSULTOR
10. FRASE DE CIERRE PROFESIONAL

Cada sección debe ser redactada con lenguaje claro, profesional, estratégico, y con foco en acción y decisión. Debe poder utilizarse como entregable al cliente y como documento operativo interno.

Título de la reunión: ${meeting.title}
Fecha: ${meeting.date}
Participantes: ${meeting.participants?.map(p => `${p.name} (${p.email})`).join(", ") || "No especificados"}
Objetivo: ${meeting.objective || "No especificado"}

TRANSCRIPCIÓN:
${transcriptText}

Genera el informe completo en Markdown, en español, con tono profesional de consultoría.`;

    const result = await base44.integrations.Core.InvokeLLM({ prompt: PROMPT });

    const existingReports = await base44.entities.Report.filter({ meeting_id: meeting.id });
    const nextVersion = existingReports.length + 1;

    await base44.entities.Report.create({
      meeting_id: meeting.id,
      client_id: meeting.client_id,
      project_id: meeting.project_id,
      transcript_id: transcript.id,
      version: nextVersion,
      title: `Informe: ${meeting.title}`,
      content_markdown: result,
      status: "generated",
      ai_metadata: { model: "gemini", prompt_version: "master_v1", generated_at: new Date().toISOString() }
    });

    await base44.entities.Meeting.update(meeting.id, { status: "report_generated" });
    toast.success("Informe generado correctamente");
    setProcessing(null);
    onUpdate();
  };

  const handleExtractTasks = async () => {
    setProcessing("tasks");
    const transcripts = await base44.entities.Transcript.filter({ meeting_id: meeting.id }, '-version', 1);
    const transcript = transcripts[0];
    if (!transcript) {
      toast.error("No hay transcripción disponible");
      setProcessing(null);
      return;
    }

    const transcriptText = transcript.full_text || transcript.segments?.map(s =>
      `${s.start_time || ""}-${s.end_time || ""} | ${s.speaker_label || s.speaker_id || ""} | "${s.text_literal || ""}"`
    ).join("\n") || "";

    const participantsList = meeting.participants?.map(p => `${p.name} (${p.email})`).join(", ") || "";
    const speakerMapping = meeting.speaker_mapping?.map(s => `${s.speaker_label} → ${s.user_name} (${s.user_email})`).join(", ") || "";

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Analiza esta transcripción de reunión y extrae TODAS las tareas, acciones comprometidas y próximos pasos mencionados.

Participantes: ${participantsList}
Mapeo de hablantes: ${speakerMapping}

Para cada tarea, identifica:
- title: título claro y conciso
- description: descripción contextual con citas breves si procede
- assignee_name: nombre del responsable (si se puede identificar de los participantes)
- assignee_email: email del responsable (si coincide con un participante)
- due_date: fecha límite en formato YYYY-MM-DD (si se menciona; si es relativa como "esta semana" o "mañana", convierte a fecha considerando que hoy es ${new Date().toISOString().split('T')[0]}, zona horaria Europe/Madrid)
- priority: low/medium/high/urgent
- evidence: array de fragmentos relevantes con start_time, end_time, speaker_label, text_fragment

TRANSCRIPCIÓN:
${transcriptText}`,
      response_json_schema: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                assignee_name: { type: "string" },
                assignee_email: { type: "string" },
                due_date: { type: "string" },
                priority: { type: "string" },
                evidence: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      start_time: { type: "string" },
                      end_time: { type: "string" },
                      speaker_label: { type: "string" },
                      text_fragment: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const createdTasks = [];
    for (const task of (result.tasks || [])) {
      const created = await base44.entities.Task.create({
        client_id: meeting.client_id,
        project_id: meeting.project_id,
        meeting_id: meeting.id,
        transcript_id: transcript.id,
        title: task.title,
        description: task.description || "",
        assignee_email: task.assignee_email || "",
        assignee_name: task.assignee_name || "",
        due_date: task.due_date || "",
        priority: task.priority || "medium",
        status: "todo",
        evidence_segments: (task.evidence || []).map(e => ({
          start_time: e.start_time || "",
          end_time: e.end_time || "",
          speaker_label: e.speaker_label || "",
          text_fragment: e.text_fragment || "",
        })),
      });
      createdTasks.push(created);
    }

    toast.success(`${createdTasks.length} tareas extraídas correctamente`);
    setProcessing(null);
    onUpdate();
  };

  const handleSendEmail = async () => {
    setProcessing("email");
    const reports = await base44.entities.Report.filter({ meeting_id: meeting.id }, '-version', 1);
    const report = reports[0];
    if (!report) {
      toast.error("No hay informe disponible");
      setProcessing(null);
      return;
    }

    const me = await base44.auth.me();

    // Collect all recipients: participants + project leads + client management contacts
    const participantEmails = meeting.participants?.map(p => p.email).filter(Boolean) || [];

    let projectLeadEmails = [];
    let managementEmails = [];
    if (meeting.project_id) {
      const projects = await base44.entities.Project.filter({ id: meeting.project_id });
      if (projects[0]?.leads) projectLeadEmails = projects[0].leads.filter(Boolean);
    }
    if (meeting.client_id) {
      const clients = await base44.entities.Client.filter({ id: meeting.client_id });
      if (clients[0]?.management_contacts) managementEmails = clients[0].management_contacts.filter(Boolean);
    }

    const allRecipients = [...new Set([...participantEmails, ...projectLeadEmails, ...managementEmails])];

    const emailBody = `<h2>Informe de Reunión: ${meeting.title}</h2>
<p>Fecha: ${meeting.date ? new Date(meeting.date).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }) : '—'}</p>
<p>Participantes: ${meeting.participants?.map(p => p.name).join(', ') || '—'}</p>
<hr>
${report.content_markdown?.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/^## (.*)/gm, '<h3>$1</h3>').replace(/^# (.*)/gm, '<h2>$1</h2>') || ""}
<hr>
<p style="color:#3E4C59;font-size:12px"><em>Enviado desde DATA GOAL — datagoal.es</em></p>`;

    for (const email of allRecipients) {
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: `[DATA GOAL] Informe de Reunión: ${meeting.title}`,
        body: emailBody,
      });
    }

    // Audit log
    await base44.entities.Report.update(report.id, {
      email_send_history: [...(report.email_send_history || []), {
        sent_by: me.email,
        sent_at: new Date().toISOString(),
        recipients: allRecipients,
        report_version: report.version,
      }]
    });

    await base44.entities.AuditLog.create({
      client_id: meeting.client_id,
      project_id: meeting.project_id,
      user_email: me.email,
      action: "email_sent",
      entity_type: "Report",
      entity_id: report.id,
      details: `Informe v${report.version} enviado a: ${allRecipients.join(', ')}`,
      timestamp: new Date().toISOString(),
    });

    toast.success(`Informe enviado a ${allRecipients.length} destinatario(s)`);
    setProcessing(null);
    onUpdate();
  };

  const ActionButton = ({ icon: Icon, label, onClick, action, variant = "outline" }) => (
    <Button onClick={onClick} disabled={processing !== null} variant={variant} size="sm" className="gap-2 text-xs">
      {processing === action ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </Button>
  );

  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton icon={Upload} label="Subir audio" onClick={handleUploadAudio} action="audio" />
      <ActionButton icon={FileText} label="Subir transcripción" onClick={handleUploadTranscript} action="transcript_upload" />
      <ActionButton icon={Mic} label="Transcribir" onClick={handleTranscribe} action="transcribe" />
      <ActionButton icon={Brain} label="Generar informe" onClick={handleGenerateReport} action="report" variant="default" />
      <ActionButton icon={ListChecks} label="Extraer tareas" onClick={handleExtractTasks} action="tasks" />
      <ActionButton icon={Mail} label="Enviar informe" onClick={handleSendEmail} action="email" />
    </div>
  );
}