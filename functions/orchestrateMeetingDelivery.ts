import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const STEP_NAMES = {
  LOAD: 'load_data',
  NORMALIZE: 'normalize_transcript',
  GENERATE: 'generate_report',
  UPLOAD_DRIVE: 'upload_to_drive',
  SEND_EMAIL: 'send_email',
  LOG: 'log_completion'
};

function logStep(steps, name, status, output, error) {
  const existing = steps.findIndex(s => s.step_name === name);
  const entry = {
    step_name: name,
    status,
    started_at: new Date().toISOString(),
    output_summary: output || null,
    error: error || null
  };
  if (existing >= 0) {
    steps[existing] = { ...steps[existing], ...entry };
  } else {
    steps.push(entry);
  }
  return steps;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const startTime = Date.now();
  const steps = [];
  let automationRun = null;

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { meeting_id } = body;

    if (!meeting_id) {
      return Response.json({ error: 'meeting_id requerido' }, { status: 400 });
    }

    // Crear AutomationRun al inicio para trazabilidad
    automationRun = await base44.entities.AutomationRun.create({
      meeting_id,
      automation_type: 'post_meeting',
      trigger_event: 'manual_or_auto',
      status: 'running',
      triggered_by: user.email,
      steps: []
    });

    // ── PASO 1: CARGAR DATOS ──
    logStep(steps, STEP_NAMES.LOAD, 'running', null, null);

    const [meetings, transcriptsAll] = await Promise.all([
      base44.entities.Meeting.filter({ id: meeting_id }),
      base44.entities.Transcript.filter({ meeting_id })
    ]);

    const meeting = meetings[0];
    if (!meeting) throw new Error(`Meeting ${meeting_id} no encontrado`);

    const transcript = transcriptsAll[0];
    if (!transcript) throw new Error(`No hay transcript para meeting ${meeting_id}`);

    logStep(steps, STEP_NAMES.LOAD, 'success', `Meeting: ${meeting.title}`, null);
    await base44.entities.AutomationRun.update(automationRun.id, { steps });

    // ── PASO 2: NORMALIZAR TRANSCRIPT (si no está hecho) ──
    logStep(steps, STEP_NAMES.NORMALIZE, 'running', null, null);

    let insights = transcript.extracted_insights;
    if (!insights || !insights.decisions) {
      const normalResult = await base44.functions.invoke('normalizeTranscript', {
        transcript_id: transcript.id
      });
      insights = normalResult?.data?.insights;
    }

    logStep(steps, STEP_NAMES.NORMALIZE, 'success',
      `Extraídos: ${insights?.decisions?.length || 0} decisiones, ${insights?.actions?.length || 0} acciones`,
      null);
    await base44.entities.AutomationRun.update(automationRun.id, { steps });

    // ── PASO 3: GENERAR INFORME ──
    logStep(steps, STEP_NAMES.GENERATE, 'running', null, null);

    const reportResult = await base44.functions.invoke('generateReport', {
      meeting_id,
      transcript_id: transcript.id
    });

    const contentMarkdown = reportResult?.data?.content_markdown;
    if (!contentMarkdown) throw new Error('generateReport no devolvió contenido');

    // Crear DeliveryRun y DeliveryVersion
    const deliveryRun = await base44.entities.DeliveryRun.create({
      delivery_template_id: reportResult?.data?.template_id || null,
      trigger_entity_type: 'Meeting',
      trigger_entity_id: meeting_id,
      status: 'review_pending',
      output_content: contentMarkdown,
      ai_metadata: {
        model_used: 'gpt-4-turbo',
        prompt_version: '1',
        generated_at: new Date().toISOString(),
        generated_by: 'orchestrateMeetingDelivery'
      }
    });

    await base44.entities.DeliveryVersion.create({
      delivery_run_id: deliveryRun.id,
      meeting_id,
      version_number: 1,
      content_markdown: contentMarkdown,
      status: 'draft'
    });

    logStep(steps, STEP_NAMES.GENERATE, 'success',
      `Informe generado (${reportResult?.data?.word_count || '?'} palabras)`, null);
    await base44.entities.AutomationRun.update(automationRun.id, {
      steps,
      delivery_run_id: deliveryRun.id
    });

    // ── PASO 4: SUBIR A GOOGLE DRIVE ──
    logStep(steps, STEP_NAMES.UPLOAD_DRIVE, 'running', null, null);
    let driveUrl = null;

    try {
      const driveResult = await base44.functions.invoke('syncGoogleDrive', {
        delivery_run_id: deliveryRun.id,
        meeting_id,
        content_markdown: contentMarkdown,
        meeting_title: meeting.title,
        client_id: meeting.client_id,
        project_id: meeting.project_id
      });
      driveUrl = driveResult?.data?.web_view_link;
      if (driveUrl) {
        await base44.entities.DeliveryRun.update(deliveryRun.id, {
          output_file_url: driveUrl
        });
      }
      logStep(steps, STEP_NAMES.UPLOAD_DRIVE, 'success', `Drive: ${driveUrl || 'subido'}`, null);
    } catch (driveError) {
      // Drive falla → no bloquear, continuar con email
      logStep(steps, STEP_NAMES.UPLOAD_DRIVE, 'failed', null, driveError.message);
    }
    await base44.entities.AutomationRun.update(automationRun.id, { steps });

    // ── PASO 5: ENVIAR EMAIL AL PM ──
    logStep(steps, STEP_NAMES.SEND_EMAIL, 'running', null, null);

    const [clients, projects] = await Promise.all([
      meeting.client_id ? base44.entities.Client.filter({ id: meeting.client_id }) : Promise.resolve([]),
      meeting.project_id ? base44.entities.Project.filter({ id: meeting.project_id }) : Promise.resolve([])
    ]);
    const client = clients[0];
    const project = projects[0];

    const meetingDate = meeting.date ? new Date(meeting.date).toLocaleDateString('es-ES') : 'N/A';
    const reviewUrl = driveUrl || `[Ver informe en app]`;

    const emailBody = `Hola ${user.full_name},

El informe post-reunión de "${meeting.title}" está listo para tu revisión.

📋 Reunión: ${meeting.title}
📅 Fecha: ${meetingDate}
🏢 Cliente: ${client?.name || 'N/A'}
📁 Proyecto: ${project?.name || 'N/A'}

${driveUrl ? `🔗 Ver en Google Drive: ${driveUrl}` : '📄 El informe ha sido generado y está disponible en el sistema.'}

Por favor revísalo y apruébalo dentro de las próximas 24 horas.

—
Sistema DataGoal (automatizado)`;

    await base44.integrations.Core.SendEmail({
      to: meeting.organizer_email || user.email,
      subject: `[${client?.name || 'DataGoal'}] Informe listo para revisión: ${meeting.title}`,
      body: emailBody
    });

    logStep(steps, STEP_NAMES.SEND_EMAIL, 'success',
      `Email enviado a ${meeting.organizer_email || user.email}`, null);

    // ── PASO 6: FINALIZAR LOG ──
    const duration = Date.now() - startTime;
    await base44.entities.AutomationRun.update(automationRun.id, {
      status: 'success',
      steps,
      duration_ms: duration,
      summary: `Informe generado y enviado para "${meeting.title}". Drive: ${driveUrl ? 'OK' : 'FALLO (no bloqueante)'}`
    });

    // Actualizar Meeting status
    await base44.entities.Meeting.update(meeting_id, { status: 'report_generated' });

    return Response.json({
      success: true,
      automation_run_id: automationRun.id,
      delivery_run_id: deliveryRun.id,
      drive_url: driveUrl,
      duration_ms: duration
    });

  } catch (error) {
    if (automationRun) {
      await base44.entities.AutomationRun.update(automationRun.id, {
        status: 'failed',
        steps,
        duration_ms: Date.now() - startTime,
        error_log: error.message
      });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});