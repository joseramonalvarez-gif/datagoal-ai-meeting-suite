import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, FileText, Mic, Brain, ListChecks, Mail, Loader2, Settings2, Video, AlertCircle } from "lucide-react";
import ReportTemplateManager from "./ReportTemplateManager";
import SummaryGenerator from "./SummaryGenerator";
import TranscriptUploadModal from "./TranscriptUploadModal";
import { toast } from "sonner";
import { notifyTaskAssigned } from "../tasks/taskNotifications";

// Supported audio formats & their MIME types
const AUDIO_ACCEPT = ".mp3,.wav,.m4a,.ogg,.webm,.flac,.aac,.opus,.mpeg,.mpga";
const AUDIO_MIME_MAP = {
  mp3: "audio/mpeg", mpga: "audio/mpeg", mpeg: "audio/mpeg",
  wav: "audio/wav", m4a: "audio/mp4",
  ogg: "audio/ogg", webm: "audio/webm", flac: "audio/flac",
  aac: "audio/aac", opus: "audio/opus",
};
const MAX_AUDIO_MB = 200;
const MAX_DOC_MB = 50;

// Supported transcript document formats
const TRANSCRIPT_ACCEPT = ".txt,.vtt,.srt,.docx,.doc,.pdf,.odt,.rtf";

function getExt(filename) {
  return filename.split(".").pop().toLowerCase().replace(/\?.*/, "");
}

function getCorrectMime(filename, originalType) {
  const ext = getExt(filename);
  return AUDIO_MIME_MAP[ext] || originalType || "application/octet-stream";
}

export default function MeetingActions({ meeting, onUpdate }) {
  const [processing, setProcessing] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showGMeet, setShowGMeet] = useState(false);
  const [gmeetText, setGmeetText] = useState("");
  const [gmeetUrl, setGmeetUrl] = useState("");
  const [gmeetProcessing, setGmeetProcessing] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const [showTranscriptUpload, setShowTranscriptUpload] = useState(false);

  useEffect(() => {
    if (["transcribed", "report_generated", "approved", "closed"].includes(meeting?.status)) {
      base44.entities.Transcript.filter({ meeting_id: meeting.id }, '-version', 1).then(ts => {
        if (ts[0]) setTranscript(ts[0]);
      });
    }
  }, [meeting?.id, meeting?.status]);

  const isTranscribed = ["transcribed", "report_generated", "approved", "closed"].includes(meeting?.status);

  // ─── Core transcription logic ───────────────────────────────────────────────
  const doTranscribeFromUrl = async (audioUrl, meetingId, clientId, projectId) => {
    // Route through the audioTranscriber backend function which handles audio correctly
    const res = await base44.functions.invoke('audioTranscriber', {
      meeting_id: meetingId,
      audio_file_url: audioUrl,
      audio_source: 'audio_transcription',
    });
    if (!res.data?.success) {
      throw new Error(res.data?.error || "No se pudo transcribir el audio. Verifica que el archivo tenga voz audible.");
    }
  };

  // ─── Upload Audio ────────────────────────────────────────────────────────────
  const handleUploadAudio = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = AUDIO_ACCEPT;
    
    const handleChange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Size check
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > MAX_AUDIO_MB) {
        toast.error(`El archivo pesa ${sizeMB.toFixed(0)} MB. El límite es ${MAX_AUDIO_MB} MB.`);
        input.removeEventListener("change", handleChange);
        return;
      }

      const ext = getExt(file.name);
      const correctMime = getCorrectMime(file.name, file.type);
      const normalizedName = file.name.replace(/\.[^.]+$/, `.${ext}`);
      const normalizedFile = new File([file], normalizedName, { type: correctMime });

      setProcessing("audio");
      toast.info(`Subiendo audio (${sizeMB.toFixed(1)} MB)...`);

      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: normalizedFile });
        await base44.entities.Meeting.update(meeting.id, {
          audio_url: file_url, source_type: "audio_upload", status: "recorded"
        });
        toast.success("Audio subido. Iniciando transcripción automática...");

        setProcessing("transcribe");
        await doTranscribeFromUrl(file_url, meeting.id, meeting.client_id, meeting.project_id);
        toast.success("✅ Transcripción completada");
        setProcessing(null);
        onUpdate();
      } catch (error) {
        toast.error(error.message || "Error al procesar el audio");
        setProcessing(null);
      } finally {
        input.removeEventListener("change", handleChange);
      }
    };
    
    input.addEventListener("change", handleChange);
    input.click();
  };

  // ─── Upload Transcript Document (docx, pdf, txt, srt, vtt…) ────────────────
  const handleUploadTranscript = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = TRANSCRIPT_ACCEPT;
    
    const handleChange = async (e) => {
      const file = e.target.files[0];
      if (!file) {
        input.removeEventListener("change", handleChange);
        return;
      }

      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > MAX_DOC_MB) {
        toast.error(`El archivo pesa ${sizeMB.toFixed(0)} MB. El límite es ${MAX_DOC_MB} MB.`);
        input.removeEventListener("change", handleChange);
        return;
      }

      const ext = getExt(file.name);
      setProcessing("transcript_upload");
      toast.info("Subiendo documento y extrayendo transcripción...");

      try {
        // Upload the raw file first
        const { file_url } = await base44.integrations.Core.UploadFile({ file });

        // Route DOCX through backend (mammoth), everything else through LLM
        let fullText = "";
        let segments = [];

        if (ext === "docx" || ext === "doc") {
          // Backend handles DOCX with mammoth - avoids SDK unsupported file type error
          const res = await base44.functions.invoke('parseTranscriptFile', {
            file_url,
            file_format: ext === "doc" ? "docx" : ext,
            meeting_id: meeting.id,
          });
          if (!res.data?.success) {
            throw new Error(res.data?.error || "Error al procesar el documento DOCX");
          }
          // parseTranscriptFile already creates the Transcript entity — done
          toast.success("✅ Transcripción extraída e importada correctamente");
          setProcessing(null);
          onUpdate();
          return;
        } else {
          // TXT, MD, SRT, VTT — read as plain text via LLM
          const result = await base44.integrations.Core.InvokeLLM({
            prompt: `Extract the full transcript from this document. 
- Extract ALL text content completely and literally.
- If there are speaker labels/timestamps, preserve them.
- Return full_text as a single string and segments if identifiable.`,
            file_urls: [file_url],
            response_json_schema: {
              type: "object",
              properties: {
                full_text: { type: "string" },
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
          fullText = result?.full_text || result?.segments?.map(s => `${s.speaker_label ? s.speaker_label + ": " : ""}${s.text_literal}`).join("\n") || "";
          segments = result?.segments || [];
        }

        if (!fullText) {
          toast.error("No se pudo extraer texto del documento. Verifica el formato del archivo.");
          setProcessing(null);
          input.removeEventListener("change", handleChange);
          return;
        }

        const existingTranscripts = await base44.entities.Transcript.filter({ meeting_id: meeting.id });
        await base44.entities.Transcript.create({
          meeting_id: meeting.id,
          client_id: meeting.client_id,
          project_id: meeting.project_id,
          version: existingTranscripts.length + 1,
          status: segments.length > 0 ? "completed" : "no_timeline",
          has_timeline: segments.length > 0,
          has_diarization: segments.some(s => s.speaker_label && s.speaker_label !== segments[0]?.speaker_label),
          segments,
          full_text: fullText,
          source: "manual_upload",
          ai_metadata: { model: "llm", generated_at: new Date().toISOString() }
        });

        await base44.entities.Meeting.update(meeting.id, {
          source_type: "transcript_upload", status: "transcribed"
        });
        toast.success("✅ Transcripción extraída e importada correctamente");
        onUpdate();
      } catch (error) {
        toast.error(error.message || "Error al procesar la transcripción");
      } finally {
        setProcessing(null);
        input.removeEventListener("change", handleChange);
      }
    };
    
    input.addEventListener("change", handleChange);
    input.click();
  };

  // ─── Manual re-transcribe from existing audio URL ───────────────────────────
  const handleTranscribe = async () => {
    if (!meeting.audio_url) {
      toast.error("No hay audio subido para transcribir");
      return;
    }
    setProcessing("transcribe");
    toast.info("Transcribiendo audio...");
    try {
      await doTranscribeFromUrl(meeting.audio_url, meeting.id, meeting.client_id, meeting.project_id);
      toast.success("✅ Transcripción completada");
      onUpdate();
    } catch (error) {
      toast.error(error.message || "Error al transcribir el audio");
    } finally {
      setProcessing(null);
    }
  };

  // ─── Google Meet transcript import ─────────────────────────────────────────
  const handleGMeetImport = async () => {
    if (!gmeetText.trim() && !gmeetUrl.trim()) {
      toast.error("Pega el texto de la transcripción o una URL de archivo");
      return;
    }
    setGmeetProcessing(true);
    toast.info("Procesando transcripción de Google Meet...");

    let rawText = gmeetText.trim();

    // If URL provided instead of text, fetch from Google Drive using connector
    if (!rawText && gmeetUrl.trim()) {
      try {
        const res = await base44.functions.invoke('fetchGoogleDriveFile', { url: gmeetUrl });
        rawText = res.data?.content || res.data?.data?.content || "";
        if (!rawText) throw new Error('No content returned');
      } catch (err) {
        toast.error("Error al acceder a Google Drive: " + (err.message || "Verifica que el enlace sea válido y accesible"));
        setGmeetProcessing(false);
        return;
      }
    }

    if (!rawText) {
      toast.error("No se pudo obtener el contenido de la transcripción");
      setGmeetProcessing(false);
      return;
    }

    // Parse the raw Google Meet transcript format into structured segments
    const parsed = await base44.integrations.Core.InvokeLLM({
      prompt: `Parse this Google Meet transcript into structured segments.
Google Meet transcripts typically have the format:
"Speaker Name\nHH:MM:SS\nText spoken"
or "Speaker Name  HH:MM  Text"

Parse ALL entries. For entries without timestamps use empty strings.

Raw transcript:
${rawText}`,
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

    const segments = parsed?.segments || [];
    const fullText = parsed?.full_text || rawText;

    const existingTranscripts = await base44.entities.Transcript.filter({ meeting_id: meeting.id });
    const nextVersion = existingTranscripts.length + 1;

    await base44.entities.Transcript.create({
      meeting_id: meeting.id,
      client_id: meeting.client_id,
      project_id: meeting.project_id,
      version: nextVersion,
      status: segments.length > 0 ? "completed" : "no_timeline",
      has_timeline: segments.some(s => !!s.start_time),
      has_diarization: segments.length > 0,
      segments,
      full_text: fullText,
      source: "meet_import",
      ai_metadata: { model: "gemini", generated_at: new Date().toISOString() }
    });

    await base44.entities.Meeting.update(meeting.id, {
      source_type: "google_meet", status: "transcribed"
    });

    toast.success(`✅ Transcripción de Google Meet importada (${segments.length} segmentos)`);
    setGmeetText("");
    setGmeetUrl("");
    setGmeetProcessing(false);
    setShowGMeet(false);
    onUpdate();
  };

  // ─── Generate Report ─────────────────────────────────────────────────────────
  const handleGenerateReport = async () => {
   setProcessing("report");
   try {
   const [transcripts, existingTasks, templates, gptConfigs] = await Promise.all([
     base44.entities.Transcript.filter({ meeting_id: meeting.id }, '-version', 1),
     base44.entities.Task.filter({ meeting_id: meeting.id }, '-created_date'),
     base44.entities.ReportTemplate.filter({ is_active: true }),
     base44.entities.GPTConfiguration.filter({ is_active: true }),
   ]);
   const transcript = transcripts[0];
   if (!transcript) {
     toast.error("No hay transcripción disponible");
     setProcessing(null);
     return;
   }

   const transcriptText = transcript.full_text ||
     transcript.segments?.map(s => `${s.start_time || ""} | ${s.speaker_label || ""}: ${s.text_literal || ""}`).join("\n") || "";

   const template = templates.find(t => t.is_default) || templates[0];
   const tone = template?.tone || "ejecutivo";
   const sections = template?.sections?.filter(s => s.enabled) || [];

   const sectionList = sections.length
     ? sections.map((s, i) => `${i + 1}. ${s.title}${s.prompt_hint ? ` — ${s.prompt_hint}` : ""}`).join("\n")
     : `1. INFORMACIÓN GENERAL\n2. OBJETIVO Y CONTEXTO\n3. TEMAS TRATADOS\n4. ACUERDOS Y DECISIONES\n5. ACCIONES COMPROMETIDAS\n6. ELEMENTOS ABIERTOS\n7. PRÓXIMOS PASOS\n8. OBSERVACIONES DEL CONSULTOR`;

   const taskSummary = (template?.include_task_summary !== false) && existingTasks.length > 0
     ? `\n\nTAREAS YA CREADAS EN EL SISTEMA:\n${existingTasks.map(t => `- [${t.status}] ${t.title} — ${t.assignee_name || "Sin asignar"} — ${t.due_date || "Sin fecha"}`).join("\n")}`
     : "";

   // Use custom GPT config or fallback to default
   const reportConfig = gptConfigs.find(g => g.output_type === "strategic_analysis") || gptConfigs[0];
   const systemPrompt = reportConfig?.system_prompt || "Eres un consultor senior experto en análisis de reuniones de negocio. Genera informes profesionales, exhaustivos y accionables.";

   const PROMPT = `Actúa como un consultor senior. Genera un informe profesional de reunión con tono ${tone}.
  Secciones requeridas:
  ${sectionList}

  Reunión: ${meeting.title}
  Fecha: ${meeting.date}
  Participantes: ${meeting.participants?.map(p => `${p.name} (${p.email})`).join(", ") || "No especificados"}
  Objetivo: ${meeting.objective || "No especificado"}
  ${taskSummary}

  TRANSCRIPCIÓN:
  ${transcriptText}

  Genera el informe completo en Markdown, en español. Encabezados con ##. Tono ${tone}. Sé exhaustivo y accionable.`;

   const result = await base44.integrations.Core.InvokeLLM({ 
     prompt: PROMPT,
   });

   const existingReports = await base44.entities.Report.filter({ meeting_id: meeting.id });
   await base44.entities.Report.create({
     meeting_id: meeting.id,
     client_id: meeting.client_id,
     project_id: meeting.project_id,
     transcript_id: transcript.id,
     template_id: template?.id || "",
     version: existingReports.length + 1,
     title: `Informe: ${meeting.title}`,
     content_markdown: result,
     status: "generated",
     ai_metadata: { model: reportConfig?.model_name || "gpt-4-turbo", prompt_version: "v3", generated_at: new Date().toISOString(), template_name: template?.name || "default", gpt_config_id: reportConfig?.id }
   });

   await base44.entities.Meeting.update(meeting.id, { status: "report_generated" });
   toast.success("✅ Informe generado correctamente");
   onUpdate();
   } catch (error) {
     toast.error(error.message || "Error al generar el informe");
   } finally {
     setProcessing(null);
   }
  };

  // ─── Extract Tasks ────────────────────────────────────────────────────────────
  const handleExtractTasks = async () => {
    setProcessing("tasks");
    const transcripts = await base44.entities.Transcript.filter({ meeting_id: meeting.id }, '-version', 1);
    const transcript = transcripts[0];
    if (!transcript) {
      toast.error("No hay transcripción disponible");
      setProcessing(null);
      return;
    }

    const transcriptText = transcript.full_text ||
      transcript.segments?.map(s => `${s.start_time || ""} | ${s.speaker_label || ""}: ${s.text_literal || ""}`).join("\n") || "";

    const participantsList = meeting.participants?.map(p => `${p.name} (${p.email})`).join(", ") || "";

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Analiza esta transcripción y extrae TODAS las tareas, acciones y compromisos mencionados.

Participantes: ${participantsList}
Hoy es: ${new Date().toISOString().split('T')[0]} (zona horaria Europe/Madrid)

Para cada tarea devuelve:
- title, description, assignee_name, assignee_email, due_date (YYYY-MM-DD), priority (low/medium/high/urgent)
- evidence: [{start_time, end_time, speaker_label, text_fragment}]

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
                title: { type: "string" }, description: { type: "string" },
                assignee_name: { type: "string" }, assignee_email: { type: "string" },
                due_date: { type: "string" }, priority: { type: "string" },
                evidence: { type: "array", items: { type: "object", properties: {
                  start_time: { type: "string" }, end_time: { type: "string" },
                  speaker_label: { type: "string" }, text_fragment: { type: "string" }
                }}}
              }
            }
          }
        }
      }
    });

    const me = await base44.auth.me();
    const createdTasks = [];
    for (const task of (result.tasks || [])) {
      const created = await base44.entities.Task.create({
        client_id: meeting.client_id, project_id: meeting.project_id,
        meeting_id: meeting.id, transcript_id: transcript.id,
        title: task.title, description: task.description || "",
        assignee_email: task.assignee_email || "", assignee_name: task.assignee_name || "",
        due_date: task.due_date || "", priority: task.priority || "medium", status: "todo",
        evidence_segments: (task.evidence || []).map(e => ({
          start_time: e.start_time || "", end_time: e.end_time || "",
          speaker_label: e.speaker_label || "", text_fragment: e.text_fragment || "",
        })),
      });
      createdTasks.push(created);
      if (task.assignee_email) {
        await notifyTaskAssigned({ task: { ...created, ...task, client_id: meeting.client_id }, assignedBy: me.email });
      }
    }
    toast.success(`✅ ${createdTasks.length} tareas extraídas`);
    setProcessing(null);
    onUpdate();
  };

  // ─── Send Email ───────────────────────────────────────────────────────────────
  const handleSendEmail = async () => {
    setProcessing("email");
    const reports = await base44.entities.Report.filter({ meeting_id: meeting.id }, '-version', 1);
    const report = reports[0];
    if (!report) { toast.error("No hay informe disponible"); setProcessing(null); return; }

    const me = await base44.auth.me();
    const participantEmails = meeting.participants?.map(p => p.email).filter(Boolean) || [];
    let projectLeadEmails = [], managementEmails = [];
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
<p>Participantes: ${meeting.participants?.map(p => p.name).join(', ') || '—'}</p><hr>
${report.content_markdown?.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/^## (.*)/gm, '<h3>$1</h3>').replace(/^# (.*)/gm, '<h2>$1</h2>') || ""}
<hr><p style="color:#3E4C59;font-size:12px"><em>Enviado desde DATA GOAL</em></p>`;

    for (const email of allRecipients) {
      await base44.integrations.Core.SendEmail({ to: email, subject: `[DATA GOAL] Informe: ${meeting.title}`, body: emailBody });
    }

    await base44.entities.Report.update(report.id, {
      email_send_history: [...(report.email_send_history || []), {
        sent_by: me.email, sent_at: new Date().toISOString(), recipients: allRecipients, report_version: report.version,
      }]
    });
    await base44.entities.AuditLog.create({
      client_id: meeting.client_id, project_id: meeting.project_id, user_email: me.email,
      action: "email_sent", entity_type: "Report", entity_id: report.id,
      details: `Informe v${report.version} enviado a: ${allRecipients.join(', ')}`, timestamp: new Date().toISOString(),
    });

    toast.success(`Informe enviado a ${allRecipients.length} destinatario(s)`);
    setProcessing(null);
    onUpdate();
  };

  const ActionButton = ({ icon: Icon, label, onClick, action, variant = "outline", disabled = false, title }) => (
    <Button onClick={onClick} disabled={processing !== null || disabled} variant={variant} size="sm" className="gap-2 text-xs" title={title}>
      {processing === action ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </Button>
  );

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
           <ActionButton icon={Upload} label="Subir audio" onClick={handleUploadAudio} action="audio"
             title={`Formatos: MP3, WAV, M4A, OGG, WEBM, FLAC, AAC, OPUS (máx ${MAX_AUDIO_MB}MB)`} />
           <ActionButton icon={FileText} label="Subir transcripción" onClick={handleUploadTranscript} action="transcript_upload"
             title={`Formatos: MARKDOWN, TXT, DOCX, PDF, SRT, VTT (máx ${MAX_DOC_MB}MB)`} />
          <ActionButton icon={Video} label="Google Meet" onClick={() => setShowGMeet(true)} action="gmeet_open"
            title="Importar transcripción directa de Google Meet" />
          <ActionButton icon={Mic} label="Transcribir" onClick={handleTranscribe} action="transcribe"
            disabled={!meeting?.audio_url} title={!meeting?.audio_url ? "Sube un audio primero" : "Re-transcribir el audio subido"} />
          <ActionButton icon={Brain} label="Generar informe" onClick={handleGenerateReport} action="report"
            variant={isTranscribed ? "default" : "outline"} disabled={!isTranscribed}
            title={!isTranscribed ? "Requiere transcripción completada" : undefined} />
          <ActionButton icon={ListChecks} label="Extraer tareas" onClick={handleExtractTasks} action="tasks"
            disabled={!isTranscribed} title={!isTranscribed ? "Requiere transcripción completada" : undefined} />
          <ActionButton icon={Mail} label="Enviar informe" onClick={handleSendEmail} action="email" />
          {transcript && <SummaryGenerator meeting={meeting} transcript={transcript} />}
          <Button onClick={() => setShowTemplates(true)} variant="ghost" size="sm" className="gap-2 text-xs text-[#3E4C59]">
            <Settings2 className="w-4 h-4" /> Plantillas
          </Button>
        </div>

        {/* Format hints */}
        <div className="flex flex-wrap gap-3 text-[10px] text-[#B7CAC9]">
          <span className="flex items-center gap-1"><Upload className="w-2.5 h-2.5" /> Audio: MP3 WAV M4A FLAC AAC OGG WEBM OPUS · máx {MAX_AUDIO_MB}MB</span>
          <span className="flex items-center gap-1"><FileText className="w-2.5 h-2.5" /> Transcripción: DOCX PDF TXT SRT VTT ODT RTF · máx {MAX_DOC_MB}MB</span>
        </div>
      </div>

      {/* Google Meet import dialog */}
      <Dialog open={showGMeet} onOpenChange={setShowGMeet}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-500" /> Importar transcripción de Google Meet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">¿Cómo obtener la transcripción de Google Meet?</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>En Google Meet, activa "Transcripción" durante la reunión</li>
                <li>Finalizada la reunión, ve a <strong>Google Drive → Meet Recordings</strong></li>
                <li>Abre el archivo <em>.docx</em> de la transcripción y copia todo el texto, <strong>o</strong></li>
                <li>Descarga el .docx y súbelo con "Subir transcripción" directamente</li>
              </ol>
            </div>

            <div>
              <label className="text-sm font-medium text-[#1B2731]">Pegar texto de la transcripción</label>
              <Textarea
                value={gmeetText}
                onChange={e => setGmeetText(e.target.value)}
                placeholder="Pega aquí el contenido completo de la transcripción de Google Meet..."
                rows={8}
                className="mt-1 text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-[#B7CAC9]/30" />
              <span className="text-xs text-[#B7CAC9]">o</span>
              <div className="flex-1 h-px bg-[#B7CAC9]/30" />
            </div>

            <div>
              <label className="text-sm font-medium text-[#1B2731]">URL del archivo (Google Drive / link público)</label>
              <Input
                value={gmeetUrl}
                onChange={e => setGmeetUrl(e.target.value)}
                placeholder="https://docs.google.com/..."
                className="mt-1 text-xs"
              />
              <p className="text-[10px] text-[#B7CAC9] mt-1 flex items-center gap-1">
                <AlertCircle className="w-2.5 h-2.5" /> El link debe ser de acceso público
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGMeet(false)}>Cancelar</Button>
            <Button
              onClick={handleGMeetImport}
              disabled={(!gmeetText.trim() && !gmeetUrl.trim()) || gmeetProcessing}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              {gmeetProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
              Importar transcripción
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReportTemplateManager open={showTemplates} onClose={() => setShowTemplates(false)} />

      <TranscriptUploadModal 
        open={showTranscriptUpload} 
        onOpenChange={setShowTranscriptUpload}
        meeting_id={meeting.id}
        onSuccess={() => {
          setShowTranscriptUpload(false);
          onUpdate();
        }}
      />
    </>
  );
}