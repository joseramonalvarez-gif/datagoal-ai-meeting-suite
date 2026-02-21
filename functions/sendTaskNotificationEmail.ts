import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { task_id } = await req.json();

    if (!task_id) {
      return Response.json({ error: 'Missing task_id' }, { status: 400 });
    }

    const tasks = await base44.asServiceRole.entities.Task.filter({ id: task_id });
    if (!tasks || tasks.length === 0) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = tasks[0];
    const projects = await base44.asServiceRole.entities.Project.filter({ id: task.project_id });
    const project = projects?.[0];

    const assignees = task.assignees || (task.assignee_email ? [{ email: task.assignee_email, name: task.assignee_name }] : []);

    if (assignees.length === 0) {
      return Response.json({ error: 'No assignees for this task' }, { status: 400 });
    }

    const priorityEmoji = {
      low: '🟢',
      medium: '🟡',
      high: '🔴',
      urgent: '🔴🔴'
    };

    const emailBody = `Estimado,

Te ha sido asignada una nueva tarea:

**${task.title}**

📋 **Descripción:** ${task.description || 'Sin descripción'}
🏢 **Proyecto:** ${project?.name || 'N/A'}
${priorityEmoji[task.priority] || ''} **Prioridad:** ${task.priority}
${task.due_date ? `📅 **Vencimiento:** ${task.due_date}` : ''}

${task.evidence_segments && task.evidence_segments.length > 0 ? `**Evidencia de Reunión:**\n${task.evidence_segments.map(seg => `- "${seg.text_fragment}"\n  Hablante: ${seg.speaker_label}`).join('\n')}` : ''}

Por favor, accede a la plataforma para ver más detalles y comenzar a trabajar en ella.

Saludos cordiales,
Data Goal Team`;

    const recipientEmails = assignees.map(a => a.email).join(',');

    const emailObject = {
      to: recipientEmails,
      subject: `Nueva Tarea Asignada: ${task.title}`,
      body: emailBody
    };

    await base44.integrations.Core.SendEmail(emailObject);

    return Response.json({ 
      success: true,
      message: 'Task notification email sent',
      recipients: recipientEmails
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});