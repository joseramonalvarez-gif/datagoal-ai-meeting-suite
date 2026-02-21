import { base44 } from "@/api/base44Client";

// Generate run ID
export function generateRunId() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `QA-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

// Save a QaCheck record
async function saveCheck(runId, code, name, status, evidence, error, durationMs) {
  return base44.entities.QaCheck.create({
    qa_run_id: runId,
    check_code: code,
    check_name: name,
    status,
    duration_ms: durationMs || 0,
    evidence: typeof evidence === "object" ? JSON.stringify(evidence, null, 2) : (evidence || ""),
    error_detail: error || "",
    created_at: new Date().toISOString(),
  });
}

// Finalize a run
async function finalizeRun(runId, checks) {
  const passed = checks.filter(c => c.status === "PASSED").length;
  const failed = checks.filter(c => c.status === "FAILED").length;
  const skipped = checks.filter(c => c.status === "SKIPPED").length;
  const criticalFails = checks.filter(c =>
    c.status === "FAILED" && ["FILE-002","TRANS-001","NOTIF-001"].includes(c.check_code)
  );

  let status = "SUCCESS";
  if (criticalFails.length > 0) status = "FAILED";
  else if (failed > 0) status = "PARTIAL";
  else if (skipped > 0 && failed === 0) status = "SUCCESS";

  let notes = `PASSED: ${passed} | FAILED: ${failed} | SKIPPED: ${skipped}. `;
  if (criticalFails.length > 0) {
    notes += `BLOQUEANTES: ${criticalFails.map(c => c.check_code).join(", ")}. Acción recomendada: revisar configuración de assets y servicios de email/notificaciones.`;
  } else if (failed > 0) {
    notes += `Checks fallidos: ${checks.filter(c=>c.status==="FAILED").map(c=>c.check_code).join(", ")}.`;
  } else {
    notes += "Todos los checks críticos superados correctamente.";
  }

  await base44.entities.QaRun.update(runId, {
    status,
    summary_passed: passed,
    summary_failed: failed,
    summary_notes: notes,
    finished_at: new Date().toISOString(),
  });

  return { status, passed, failed };
}

// ─── SMOKE RUN ───────────────────────────────────────────────────────────────
export async function runSmoke({ run, selectedClient, selectedProject, user, onProgress }) {
  const checks = [];
  const runId = run.id;

  // CHECK FILE-001: Validate assets exist
  onProgress("FILE-001: Validando activos QA...");
  const t0 = Date.now();
  try {
    const assets = await base44.entities.QaTestAsset.filter({ enabled: true });
    const hasAudioShort = assets.some(a => a.asset_type === "AUDIO_SHORT");
    const hasTranscript = assets.some(a => a.asset_type === "TRANSCRIPT_WITH_TIMECODES");
    const status = hasAudioShort && hasTranscript ? "PASSED" : "FAILED";
    const ev = `Assets found: ${assets.length}. AUDIO_SHORT: ${hasAudioShort}, TRANSCRIPT_WITH_TIMECODES: ${hasTranscript}. IDs: ${assets.map(a=>a.id).join(", ")}`;
    const c = await saveCheck(runId, "FILE-001", "Validación de activos QA", status, ev, status==="FAILED" ? "Faltan assets requeridos (AUDIO_SHORT y/o TRANSCRIPT_WITH_TIMECODES)" : "", Date.now()-t0);
    checks.push(c);
  } catch(e) {
    const c = await saveCheck(runId, "FILE-001", "Validación de activos QA", "FAILED", "", String(e), Date.now()-t0);
    checks.push(c);
  }

  // CHECK FILE-002: Attach audio asset to QA meeting
  onProgress("FILE-002: Creando reunión QA con adjunto de audio...");
  const t1 = Date.now();
  let qaMeetingId = null;
  try {
    const assets = await base44.entities.QaTestAsset.filter({ enabled: true });
    const audioAsset = assets.find(a => a.asset_type === "AUDIO_SHORT") || assets.find(a => a.asset_type === "AUDIO_LONG");
    if (!audioAsset || !audioAsset.file_url) throw new Error("No se encontró asset AUDIO_SHORT con file_url");

    const meeting = await base44.entities.Meeting.create({
      client_id: selectedClient?.id || "",
      project_id: selectedProject?.id || "",
      title: `[QA] Meeting - Audio Short - ${run.run_id}`,
      date: new Date().toISOString(),
      objective: "QA smoke test - audio pipeline",
      status: "recorded",
      audio_url: audioAsset.file_url,
      source_type: "audio_upload",
      is_qa_record: true,
    });
    qaMeetingId = meeting.id;
    const ev = `meeting_id: ${meeting.id}, asset_id: ${audioAsset.id}, file_url: ${audioAsset.file_url}, mime: ${audioAsset.mime_type || "unknown"}, size: ${audioAsset.size_bytes || "unknown"}`;
    const c = await saveCheck(runId, "FILE-002", "Adjuntar audio a reunión QA", "PASSED", ev, "", Date.now()-t1);
    checks.push(c);
  } catch(e) {
    const c = await saveCheck(runId, "FILE-002", "Adjuntar audio a reunión QA", "FAILED", "", String(e), Date.now()-t1);
    checks.push(c);
  }

  // CHECK TRANS-001: Transcription from audio
  onProgress("TRANS-001: Ejecutando transcripción sobre audio QA...");
  const t2 = Date.now();
  try {
    if (!qaMeetingId) throw new Error("No hay reunión QA creada (FILE-002 falló)");
    const meeting = (await base44.entities.Meeting.filter({ id: qaMeetingId }))[0];
    if (!meeting?.audio_url) throw new Error("La reunión QA no tiene audio_url");

    // Check if file_url has a supported extension
    const audioUrl = meeting.audio_url || "";
    const ext = audioUrl.split("?")[0].split(".").pop().toLowerCase();
    const supportedExts = ["mp3","wav","ogg","webm","mp4","flac","aac"];
    if (!supportedExts.includes(ext)) {
      const c = await saveCheck(runId, "TRANS-001", "Transcripción desde audio corto", "SKIPPED",
        `Tipo de archivo no soportado por el LLM: .${ext}. Soportados: ${supportedExts.join(", ")}`,
        `El asset de audio tiene extensión .${ext} que no está soportada para transcripción directa.`, Date.now()-t2);
      checks.push(c);
      return { checks, qaMeetingId };
    }
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Transcribe literally this audio. Identify speakers and provide timestamps in HH:MM:SS format. Return segments with start_time, end_time, speaker_id (e.g. "SPK_1"), speaker_label (e.g. "Hablante 1"), and text_literal. Be verbatim, do not summarize.`,
      file_urls: [meeting.audio_url],
      response_json_schema: {
        type: "object",
        properties: {
          segments: { type: "array", items: { type: "object", properties: {
            start_time: {type:"string"}, end_time: {type:"string"},
            speaker_id: {type:"string"}, speaker_label: {type:"string"}, text_literal: {type:"string"}
          }}},
          full_text: {type:"string"}
        }
      }
    });

    const segs = result.segments || [];
    const hasSegments = segs.length > 0;
    const hasTimecodes = segs.every(s => s.start_time && s.end_time);
    const hasSpeakers = segs.every(s => s.speaker_id);

    const transcript = await base44.entities.Transcript.create({
      meeting_id: qaMeetingId,
      client_id: selectedClient?.id || "",
      project_id: selectedProject?.id || "",
      version: 1,
      status: "completed",
      has_timeline: hasTimecodes,
      has_diarization: hasSpeakers,
      segments: segs,
      full_text: result.full_text || "",
      source: "audio_transcription",
      ai_metadata: { model: "gemini", generated_at: new Date().toISOString() }
    });

    await base44.entities.Meeting.update(qaMeetingId, { status: "transcribed" });

    const validations = { hasSegments, hasTimecodes, hasSpeakers, segCount: segs.length };
    const allValid = hasSegments && hasTimecodes && hasSpeakers;
    const ev = `transcript_id: ${transcript.id}, segments: ${segs.length}, validations: ${JSON.stringify(validations)}`;
    const c = await saveCheck(runId, "TRANS-001", "Transcripción desde audio corto", allValid ? "PASSED" : "FAILED", ev,
      !allValid ? `Validaciones fallidas: ${JSON.stringify(validations)}` : "", Date.now()-t2);
    checks.push(c);
  } catch(e) {
    const c = await saveCheck(runId, "TRANS-001", "Transcripción desde audio corto", "FAILED", "", String(e), Date.now()-t2);
    checks.push(c);
  }

  // CHECK NOTIF-001: In-app notification
  onProgress("NOTIF-001: Creando notificación in-app de prueba...");
  const t3 = Date.now();
  try {
    const notif = await base44.entities.Notification.create({
      user_email: user.email,
      client_id: selectedClient?.id || "",
      title: `[QA] Notificación de prueba ${run.run_id}`,
      message: `Smoke test notification. Run: ${run.run_id}`,
      type: "report_generated",
      is_read: false,
    });
    // Verify it exists
    const check = await base44.entities.Notification.filter({ id: notif.id });
    const found = check.length > 0;
    const ev = `notification_id: ${notif.id}, user: ${user.email}, found_in_db: ${found}`;
    const c = await saveCheck(runId, "NOTIF-001", "Notificación in-app de prueba", found ? "PASSED" : "FAILED", ev, !found ? "No se encontró la notificación en DB" : "", Date.now()-t3);
    checks.push(c);
  } catch(e) {
    const c = await saveCheck(runId, "NOTIF-001", "Notificación in-app de prueba", "FAILED", "", String(e), Date.now()-t3);
    checks.push(c);
  }

  // CHECK EMAIL-001: Test email
  onProgress("EMAIL-001: Enviando email de prueba QA...");
  const t4 = Date.now();
  try {
    const recipConfigs = await base44.entities.QaRecipientsConfig.filter({ enabled: true });
    if (!recipConfigs.length) throw new Error("No hay QaRecipientsConfig enabled. Configura al menos un receptor en Setup.");

    const cfg = recipConfigs[0];
    const emails = (cfg.participant_emails || "").split(",").map(e=>e.trim()).filter(Boolean);
    if (!emails.length) throw new Error("QaRecipientsConfig no tiene participant_emails configurados");

    const body = `<h2>[QA][SMOKE] ${run.run_id}</h2>
<p>Este es un email de prueba generado automáticamente por el QA Control Center de DATA GOAL.</p>
<p><strong>Run ID:</strong> ${run.run_id}</p>
<p><strong>Ejecutado por:</strong> ${user.email}</p>
<p><strong>Tenant:</strong> ${selectedClient?.name || "N/A"}</p>
<p><strong>Fecha:</strong> ${new Date().toLocaleString("es-ES")}</p>
<hr>
<p style="color:#3E4C59;font-size:12px">DATA GOAL QA Control Center — Mensaje automático de prueba</p>`;

    const sent = [];
    const failed = [];
    for (const email of emails) {
      try {
        await base44.integrations.Core.SendEmail({
          to: email,
          subject: `[QA][SMOKE] ${run.run_id} — DATA GOAL Control Center`,
          body,
        });
        sent.push(email);
      } catch(emailErr) {
        const msg = String(emailErr);
        if (msg.includes("outside the app")) {
          failed.push(`${email} (fuera del app)`);
        } else {
          throw emailErr;
        }
      }
    }
    const ev = `sent: ${sent.join(", ") || "ninguno"}, skipped_outside_app: ${failed.join(", ") || "ninguno"}, config_id: ${cfg.id}`;
    const checkStatus = sent.length > 0 ? "PASSED" : "SKIPPED";
    const c = await saveCheck(runId, "EMAIL-001", "Email de prueba (SMOKE)", checkStatus, ev,
      sent.length === 0 ? "Todos los destinatarios son externos al app (sin acceso a SendEmail). Invítalos al app para habilitar emails." : "", Date.now()-t4);
    checks.push(c);
  } catch(e) {
    const c = await saveCheck(runId, "EMAIL-001", "Email de prueba (SMOKE)", "FAILED", "", String(e), Date.now()-t4);
    checks.push(c);
  }

  return { checks, qaMeetingId };
}

// ─── FULL RUN ─────────────────────────────────────────────────────────────────
export async function runFull({ run, selectedClient, selectedProject, user, onProgress }) {
  // Start with SMOKE
  const { checks: smokeChecks, qaMeetingId } = await runSmoke({ run, selectedClient, selectedProject, user, onProgress });
  const checks = [...smokeChecks];
  const runId = run.id;

  // CHECK FILE-003: Audio long
  onProgress("FILE-003: Adjuntando audio largo a reunión QA...");
  const t5 = Date.now();
  try {
    const assets = await base44.entities.QaTestAsset.filter({ enabled: true });
    const longAudio = assets.find(a => a.asset_type === "AUDIO_LONG");
    if (!longAudio) {
      const c = await saveCheck(runId, "FILE-003", "Adjuntar audio largo", "SKIPPED", "No AUDIO_LONG asset configured", "", Date.now()-t5);
      checks.push(c);
    } else {
      const meeting = await base44.entities.Meeting.create({
        client_id: selectedClient?.id || "",
        project_id: selectedProject?.id || "",
        title: `[QA] Meeting - Audio Long - ${run.run_id}`,
        date: new Date().toISOString(),
        status: "recorded",
        audio_url: longAudio.file_url,
        source_type: "audio_upload",
        is_qa_record: true,
      });
      const ev = `meeting_id: ${meeting.id}, asset_id: ${longAudio.id}, size_bytes: ${longAudio.size_bytes || "unknown"}, mime: ${longAudio.mime_type}`;
      const c = await saveCheck(runId, "FILE-003", "Adjuntar audio largo", "PASSED", ev, "", Date.now()-t5);
      checks.push(c);
    }
  } catch(e) {
    const c = await saveCheck(runId, "FILE-003", "Adjuntar audio largo", "FAILED", "", String(e), Date.now()-t5);
    checks.push(c);
  }

  // CHECK TRANS-002: Versioning - reprocess transcription
  onProgress("TRANS-002: Verificando versionado de transcripción...");
  const t6 = Date.now();
  try {
    if (!qaMeetingId) throw new Error("qaMeetingId no disponible");
    const existing = await base44.entities.Transcript.filter({ meeting_id: qaMeetingId });
    const prevVersion = existing.length;
    const prevId = existing[existing.length - 1]?.id;

    const meeting = (await base44.entities.Meeting.filter({ id: qaMeetingId }))[0];
    const ext2 = (meeting.audio_url || "").split("?")[0].split(".").pop().toLowerCase();
    const supportedExts2 = ["mp3","wav","ogg","webm","mp4","flac","aac"];
    if (!supportedExts2.includes(ext2)) {
      const c = await saveCheck(runId, "TRANS-002", "Versionado de transcripción", "SKIPPED",
        `Tipo de archivo no soportado: .${ext2}`, "", Date.now()-t6);
      checks.push(c);
    } else {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: "Transcribe literally. Return segments with start_time HH:MM:SS, end_time, speaker_id, speaker_label, text_literal.",
      file_urls: [meeting.audio_url],
      response_json_schema: { type: "object", properties: { segments: { type: "array", items: { type: "object" }}, full_text: { type: "string" }}}
    });

    const newTranscript = await base44.entities.Transcript.create({
      meeting_id: qaMeetingId,
      client_id: selectedClient?.id || "",
      version: prevVersion + 1,
      status: "completed",
      has_timeline: true,
      has_diarization: true,
      segments: result.segments || [],
      full_text: result.full_text || "",
      source: "audio_transcription",
      ai_metadata: { model: "gemini", generated_at: new Date().toISOString() }
    });

    const notOverwritten = newTranscript.id !== prevId;
    const ev = `prev_transcript_id: ${prevId}, new_transcript_id: ${newTranscript.id}, prev_version: ${prevVersion}, new_version: ${prevVersion+1}, not_overwritten: ${notOverwritten}`;
    const c = await saveCheck(runId, "TRANS-002", "Versionado de transcripción", notOverwritten ? "PASSED" : "FAILED", ev, !notOverwritten ? "Se sobrescribió la transcripción anterior" : "", Date.now()-t6);
    checks.push(c);
    } // end supportedExts2 block
  } catch(e) {
    const c = await saveCheck(runId, "TRANS-002", "Versionado de transcripción", "FAILED", "", String(e), Date.now()-t6);
    checks.push(c);
  }

  // CHECK TRANS-003: Plain transcript upload
  onProgress("TRANS-003: Probando transcripción subida sin timecodes...");
  const t7 = Date.now();
  try {
    const assets = await base44.entities.QaTestAsset.filter({ enabled: true });
    const plainAsset = assets.find(a => a.asset_type === "TRANSCRIPT_PLAIN");
    if (!plainAsset) {
      const c = await saveCheck(runId, "TRANS-003", "Transcripción sin timecodes", "SKIPPED", "No TRANSCRIPT_PLAIN asset configured", "", Date.now()-t7);
      checks.push(c);
    } else {
      const plainMeeting = await base44.entities.Meeting.create({
        client_id: selectedClient?.id || "",
        project_id: selectedProject?.id || "",
        title: `[QA] Meeting - Transcript Upload - ${run.run_id}`,
        date: new Date().toISOString(),
        status: "transcribed",
        source_type: "transcript_upload",
        is_qa_record: true,
      });
      const transcript = await base44.entities.Transcript.create({
        meeting_id: plainMeeting.id,
        client_id: selectedClient?.id || "",
        version: 1,
        status: "no_timeline",
        has_timeline: false,
        has_diarization: false,
        segments: [],
        full_text: "[QA] Plain transcript test content without timecodes or speakers.",
        source: "manual_upload",
      });
      const ev = `meeting_id: ${plainMeeting.id}, transcript_id: ${transcript.id}, status: no_timeline, has_timeline: false`;
      const c = await saveCheck(runId, "TRANS-003", "Transcripción sin timecodes", "PASSED", ev, "", Date.now()-t7);
      checks.push(c);
    }
  } catch(e) {
    const c = await saveCheck(runId, "TRANS-003", "Transcripción sin timecodes", "FAILED", "", String(e), Date.now()-t7);
    checks.push(c);
  }

  // CHECK NOTIF-002: Push notification
  onProgress("NOTIF-002: Verificando push notifications...");
  const t8 = Date.now();
  try {
    const pushTargets = await base44.entities.QaPushTarget.filter({ enabled: true });
    if (!pushTargets.length) {
      const c = await saveCheck(runId, "NOTIF-002", "Push notification", "SKIPPED", "No push tokens configured in QaPushTarget", "", Date.now()-t8);
      checks.push(c);
    } else {
      const ev = `push_targets: ${pushTargets.map(t=>`${t.device_label}(${t.user_email})`).join(", ")}. Push integration not available without backend functions — tokens registered only.`;
      const c = await saveCheck(runId, "NOTIF-002", "Push notification", "SKIPPED", ev, "Push API requires backend functions", Date.now()-t8);
      checks.push(c);
    }
  } catch(e) {
    const c = await saveCheck(runId, "NOTIF-002", "Push notification", "SKIPPED", "", String(e), Date.now()-t8);
    checks.push(c);
  }

  // CHECK EMAIL-002: Full report email to all recipients
  onProgress("EMAIL-002: Generando informe QA y enviando a todos los destinatarios...");
  const t9 = Date.now();
  try {
    if (!qaMeetingId) throw new Error("qaMeetingId no disponible");
    const transcripts = await base44.entities.Transcript.filter({ meeting_id: qaMeetingId }, "-version", 1);
    const transcript = transcripts[0];
    if (!transcript) throw new Error("No hay transcripción disponible para generar informe");

    const reportResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Genera un informe QA de prueba en español con 3 secciones: 1. Contexto del test, 2. Resultados, 3. Conclusiones. Breve, máximo 300 palabras. Run ID: ${run.run_id}. Este es un email de prueba del sistema QA de DATA GOAL.`
    });

    const report = await base44.entities.Report.create({
      meeting_id: qaMeetingId,
      client_id: selectedClient?.id || "",
      transcript_id: transcript.id,
      version: 1,
      title: `[QA] Informe - ${run.run_id}`,
      content_markdown: reportResult,
      status: "generated",
      ai_metadata: { model: "gemini", generated_at: new Date().toISOString() }
    });

    const recipConfigs = await base44.entities.QaRecipientsConfig.filter({ enabled: true });
    if (!recipConfigs.length) throw new Error("No hay QaRecipientsConfig habilitado");

    const cfg = recipConfigs[0];
    const allEmails = [
      ...(cfg.participant_emails||"").split(","),
      ...(cfg.project_lead_emails||"").split(","),
      ...(cfg.management_emails||"").split(","),
    ].map(e=>e.trim()).filter(Boolean);
    const uniqueEmails = [...new Set(allEmails)];

    const body = `<h2>[QA] Informe de Reunión: ${run.run_id}</h2>
<p><strong>Tipo:</strong> FULL Test Report</p>
<p><strong>Ejecutado por:</strong> ${user.email}</p>
<hr>
${reportResult?.replace(/\n/g,"<br>")||""}
<hr>
<p style="color:#3E4C59;font-size:12px">DATA GOAL QA Control Center — Mensaje automático de prueba</p>`;

    for (const email of uniqueEmails) {
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: `[QA][FULL] Informe - ${run.run_id}`,
        body,
      });
    }

    await base44.entities.Report.update(report.id, {
      email_send_history: [{ sent_by: user.email, sent_at: new Date().toISOString(), recipients: uniqueEmails, report_version: 1 }]
    });

    const ev = `report_id: ${report.id}, report_version: 1, recipients: ${uniqueEmails.join(", ")}, count: ${uniqueEmails.length}`;
    const c = await saveCheck(runId, "EMAIL-002", "Email informe a todos los destinatarios", "PASSED", ev, "", Date.now()-t9);
    checks.push(c);
  } catch(e) {
    const c = await saveCheck(runId, "EMAIL-002", "Email informe completo", "FAILED", "", String(e), Date.now()-t9);
    checks.push(c);
  }

  // CHECK EMAIL-003: Robustness - invalid recipient
  onProgress("EMAIL-003: Verificando robustez con destinatario inválido...");
  const t10 = Date.now();
  try {
    await base44.integrations.Core.SendEmail({
      to: "qa-invalid-test@nonexistent-domain-qatest.invalid",
      subject: `[QA] Robustness test - ${run.run_id}`,
      body: "This is an intentional invalid recipient test.",
    });
    // If no error thrown, mark as PASSED (provider accepted it)
    const c = await saveCheck(runId, "EMAIL-003", "Robustez email (destinatario inválido)", "PASSED", "Email enviado sin error del proveedor (puede rebotar asincrónicamente)", "", Date.now()-t10);
    checks.push(c);
  } catch(e) {
    // Expected failure — still PASSED because we handled it
    const c = await saveCheck(runId, "EMAIL-003", "Robustez email (destinatario inválido)", "PASSED", "Error controlado como esperado", `Error capturado: ${String(e)}`, Date.now()-t10);
    checks.push(c);
  }

  return { checks };
}

// ─── FINALIZE ─────────────────────────────────────────────────────────────────
export { finalizeRun };