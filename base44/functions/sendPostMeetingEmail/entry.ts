import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { meeting_id, include_transcript = true, include_report = false, recipients } = await req.json();

    if (!meeting_id) {
      return Response.json({ error: 'Missing meeting_id' }, { status: 400 });
    }

    const meetings = await base44.asServiceRole.entities.Meeting.filter({ id: meeting_id });
    if (!meetings || meetings.length === 0) {
      return Response.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const meeting = meetings[0];
    const clients = await base44.asServiceRole.entities.Client.filter({ id: meeting.client_id });
    const client = clients?.[0];

    let attachments = [];
    let emailContent = `Estimados,\n\nAdjunto encontrarán el resumen y documentación de la reunión realizada:\n\n**${meeting.title}**\n\n`;

    // Get transcript if exists
    if (include_transcript) {
      const transcripts = await base44.asServiceRole.entities.Transcript.filter({ meeting_id });
      if (transcripts && transcripts.length > 0) {
        const transcript = transcripts[0];
        emailContent += `📄 **Transcripción:** Disponible en el documento adjunto\n`;
        if (transcript.full_text) {
          attachments.push({
            name: `${meeting.title}-Transcripcion.txt`,
            content: transcript.full_text
          });
        }
      }
    }

    // Get report if exists and requested
    if (include_report) {
      const reports = await base44.asServiceRole.entities.Report.filter({ meeting_id });
      if (reports && reports.length > 0) {
        const report = reports[0];
        emailContent += `📊 **Informe:** ${report.title}\n`;
        if (report.content_markdown) {
          attachments.push({
            name: `${report.title}.md`,
            content: report.content_markdown
          });
        }
      }
    }

    // Get tasks created from this meeting
    const tasks = await base44.asServiceRole.entities.Task.filter({ meeting_id });
    if (tasks && tasks.length > 0) {
      emailContent += `\n✅ **Tareas Asignadas (${tasks.length}):**\n`;
      tasks.forEach(task => {
        const assignees = task.assignees?.map(a => a.name).join(', ') || task.assignee_name || 'Sin asignar';
        emailContent += `- **${task.title}** (Asignado a: ${assignees}${task.due_date ? `, Vence: ${task.due_date}` : ''})\n`;
      });
    }

    emailContent += `\n---\n\nEsta es una comunicación automática de Data Goal.`;

    const emailRecipients = recipients || meeting.participants?.map(p => p.email).join(',') || meeting.organizer_email;

    const emailObject = {
      to: emailRecipients,
      subject: `Resumen: ${meeting.title}`,
      body: emailContent
    };

    await base44.integrations.Core.SendEmail(emailObject);

    return Response.json({ 
      success: true,
      message: 'Post-meeting email sent',
      recipients: emailRecipients,
      attachments_count: attachments.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});