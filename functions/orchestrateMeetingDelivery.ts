import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { meeting_id } = await req.json();

    if (!meeting_id) {
      return Response.json({ error: 'Missing meeting_id' }, { status: 400 });
    }

    const user = await base44.auth.me();

    // Crear AutomationRun inicial
    const automationRun = await base44.asServiceRole.entities.AutomationRun.create({
      automation_type: 'post_meeting_delivery',
      trigger_entity_type: 'Meeting',
      trigger_entity_id: meeting_id,
      client_id: '',
      project_id: '',
      status: 'running',
      started_at: new Date().toISOString(),
      steps: [],
      executed_by: user.email,
    });

    const steps = [];
    const outputs = {};

    try {
      // PASO 1: Obtener Meeting y Transcript
      console.log('Step 1: Fetching meeting and transcript...');
      const meeting = await base44.asServiceRole.entities.Meeting.filter({ id: meeting_id });
      if (!meeting || meeting.length === 0) {
        throw new Error('Meeting not found');
      }

      const meetingData = meeting[0];
      outputs.client_id = meetingData.client_id;
      outputs.project_id = meetingData.project_id;

      steps.push({
        step_name: 'fetch_meeting',
        status: 'success',
        duration_ms: 100,
      });

      // PASO 2: Transcribir Audio (si existe)
      console.log('Step 2: Transcribing audio...');
      let transcript = null;
      let transcriptId = null;

      if (meetingData.audio_url) {
        const transcribeRes = await base44.asServiceRole.functions.invoke('transcribeMeetingAudio', {
          meeting_id: meeting_id,
          audio_url: meetingData.audio_url,
        });

        if (transcribeRes.data?.success) {
          transcriptId = transcribeRes.data.transcript_id;
          outputs.transcript_id = transcriptId;
          outputs.full_text = transcribeRes.data.full_text;
        } else {
          throw new Error('Transcription failed');
        }
      } else {
        // Buscar transcripción existente
        const existing = await base44.asServiceRole.entities.Transcript.filter({ meeting_id: meeting_id });
        if (existing && existing.length > 0) {
          transcript = existing[0];
          transcriptId = transcript.id;
          outputs.transcript_id = transcriptId;
          outputs.full_text = transcript.full_text;
        } else {
          throw new Error('No audio or transcript found for meeting');
        }
      }

      steps.push({
        step_name: 'transcribe_audio',
        status: 'success',
        duration_ms: 120000,
        output_refs: [transcriptId],
      });

      // PASO 3: Analizar con GPT
      console.log('Step 3: Analyzing with GPT...');
      const analysisRes = await base44.asServiceRole.functions.invoke('analyzeMeetingWithGPT', {
        transcript_id: transcriptId,
        full_text: outputs.full_text,
      });

      if (!analysisRes.data?.success) {
        throw new Error('Analysis failed');
      }

      outputs.analysis = analysisRes.data.analysis;

      steps.push({
        step_name: 'analyze_with_gpt',
        status: 'success',
        duration_ms: 45000,
      });

      // PASO 4: Generar Informe desde Template
      console.log('Step 4: Generating report from template...');
      const reportRes = await base44.asServiceRole.functions.invoke('generateReportFromTemplate', {
        meeting_id: meeting_id,
        transcript_id: transcriptId,
        analysis: outputs.analysis,
        template_type: 'executive_summary',
      });

      if (!reportRes.data?.success) {
        throw new Error('Report generation failed');
      }

      outputs.markdown = reportRes.data.markdown;
      outputs.html = reportRes.data.html;

      steps.push({
        step_name: 'generate_report',
        status: 'success',
        duration_ms: 5000,
      });

      // PASO 5: Crear Google Doc
      console.log('Step 5: Creating Google Doc...');
      const docRes = await base44.asServiceRole.functions.invoke('createGoogleDocReport', {
        meeting_id: meeting_id,
        title: reportRes.data.title,
        markdown_content: outputs.markdown,
        client_id: meetingData.client_id,
        project_id: meetingData.project_id,
      });

      if (!docRes.data?.success) {
        throw new Error('Google Doc creation failed');
      }

      outputs.google_doc_id = docRes.data.document_id;
      outputs.google_doc_url = docRes.data.share_link;

      steps.push({
        step_name: 'create_google_doc',
        status: 'success',
        duration_ms: 8000,
        output_refs: [docRes.data.document_id],
      });

      // PASO 6: Enviar Email
      console.log('Step 6: Sending email...');
      const emailEmails = (meetingData.participants || []).map(p => p.email);
      if (emailEmails.length === 0) {
        emailEmails.push(user.email);
      }

      const emailRes = await base44.asServiceRole.functions.invoke('sendReportEmail', {
        to_emails: emailEmails,
        title: reportRes.data.title,
        share_link: outputs.google_doc_url,
        analysis: outputs.analysis,
      });

      if (!emailRes.data?.success) {
        throw new Error('Email sending failed');
      }

      outputs.email_sent_to = emailRes.data.sent_to;

      steps.push({
        step_name: 'send_email',
        status: 'success',
        duration_ms: 3000,
      });

      // PASO 7: Crear Tareas desde Action Items
      console.log('Step 7: Creating tasks from action items...');
      const tasksCreated = [];

      for (const item of outputs.analysis.action_items || []) {
        try {
          const task = await base44.asServiceRole.entities.Task.create({
            client_id: meetingData.client_id,
            project_id: meetingData.project_id,
            meeting_id: meeting_id,
            title: item.título || item.title,
            description: item.descripción || item.description || '',
            status: 'todo',
            priority: 'high',
            due_date: item.due_date || item.fecha_vencimiento,
            assignee_email: item.owner || item.responsable,
            tags: ['from_meeting_automation'],
          });
          tasksCreated.push(task.id);
        } catch (err) {
          console.error('Failed to create task:', err.message);
        }
      }

      outputs.tasks_created = tasksCreated;

      steps.push({
        step_name: 'create_tasks',
        status: 'success',
        duration_ms: 5000,
        output_refs: tasksCreated,
      });

      // Actualizar Meeting status
      await base44.asServiceRole.entities.Meeting.update(meeting_id, {
        status: 'report_generated',
      });

      // Completar AutomationRun
      const endTime = new Date();
      const startTime = new Date(automationRun.created_date);
      const duration = endTime.getTime() - startTime.getTime();

      await base44.asServiceRole.entities.AutomationRun.update(automationRun.id, {
        status: 'success',
        completed_at: endTime.toISOString(),
        duration_ms: duration,
        steps: steps,
        outputs: outputs,
      });

      return Response.json({
        success: true,
        automation_run_id: automationRun.id,
        steps_completed: steps.length,
        duration_ms: duration,
        google_doc_url: outputs.google_doc_url,
        tasks_created: tasksCreated.length,
        summary: `✅ Informe generado en ${Math.round(duration / 1000)}s, enviado a ${emailEmails.length} personas, ${tasksCreated.length} tareas creadas`,
      });
    } catch (error) {
      // Registrar error en AutomationRun
      await base44.asServiceRole.entities.AutomationRun.update(automationRun.id, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        steps: steps,
        error_log: error.message,
        outputs: outputs,
      });

      return Response.json({ 
        error: error.message,
        automation_run_id: automationRun.id,
      }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});