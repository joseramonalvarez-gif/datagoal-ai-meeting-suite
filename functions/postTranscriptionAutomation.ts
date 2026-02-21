import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { meeting_id } = await req.json();

    if (!meeting_id) {
      return Response.json({ error: 'meeting_id requerido' }, { status: 400 });
    }

    // Fetch meeting and transcript
    const [meetings, workflowRules] = await Promise.all([
      base44.entities.Meeting.filter({ id: meeting_id }),
      base44.entities.WorkflowRule.filter({ is_active: true })
    ]);

    if (!meetings[0]) {
      return Response.json({ error: 'Meeting no encontrada' }, { status: 404 });
    }

    const meeting = meetings[0];
    const transcript = await base44.entities.Transcript.filter({ meeting_id: meeting_id }, '-version', 1);

    if (!transcript[0]) {
      return Response.json({ error: 'Transcript no encontrada' }, { status: 404 });
    }

    const transcriptText = transcript[0].full_text || '';

    // Initialize automation run record
    const automationRun = await base44.asServiceRole.entities.AutomationRun.create({
      meeting_id,
      automation_type: 'post_transcription',
      trigger_event: 'meeting_transcribed',
      status: 'running',
      actions_executed: []
    });

    const results = {
      tasks_created: [],
      notifications_sent: [],
      follow_ups_created: [],
      actions_executed: [],
      summary: ''
    };

    // Execute workflow rules
    for (const rule of workflowRules) {
      if (rule.trigger_type !== 'keyword_match') continue;

      const keywords = rule.keywords || [];
      const hasMatch = keywords.some(kw => 
        transcriptText.toLowerCase().includes(kw.toLowerCase())
      );

      if (!hasMatch) continue;

      try {
        // Create task from template
        if (rule.action_type === 'create_task' && rule.task_template) {
          const task = await base44.asServiceRole.entities.Task.create({
            client_id: meeting.client_id,
            project_id: meeting.project_id,
            meeting_id: meeting.id,
            transcript_id: transcript[0].id,
            title: rule.task_template.title_template || 'Tarea de reunión',
            description: rule.task_template.description_template || '',
            priority: rule.task_template.priority || 'medium',
            due_date: getDueDate(rule.task_template.due_days_offset),
            tags: ['auto-generated', `rule-${rule.id}`]
          });

          results.tasks_created.push(task.id);
          results.actions_executed.push({
            action_name: `create_task (rule: ${rule.name})`,
            status: 'success',
            result: { task_id: task.id }
          });
        }

        // Create notification
        if (rule.action_type === 'create_task') {
          const notif = await base44.asServiceRole.entities.Notification.create({
            user_email: user.email,
            title: 'Nueva tarea automática',
            message: `Se creó tarea desde reunión: ${meeting.title}`,
            type: 'task_created',
            is_read: false,
            related_entity_type: 'task',
            related_entity_id: results.tasks_created[results.tasks_created.length - 1]
          });

          results.notifications_sent.push(notif.id);
        }
      } catch (err) {
        results.actions_executed.push({
          action_name: `create_task (rule: ${rule.name})`,
          status: 'failed',
          error: err.message
        });
      }
    }

    // Create follow-up meeting suggestion (7 days later)
    try {
      const followUpMeeting = await base44.asServiceRole.entities.Meeting.create({
        client_id: meeting.client_id,
        project_id: meeting.project_id,
        title: `Follow-up: ${meeting.title}`,
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        objective: `Follow-up de la reunión del ${new Date(meeting.date).toLocaleDateString('es-ES')}`,
        status: 'scheduled',
        participants: meeting.participants,
        organizer_email: meeting.organizer_email,
        source_type: 'manual',
        notes: `Generado automáticamente como follow-up de: ${meeting.id}`
      });

      results.follow_ups_created.push(followUpMeeting.id);
      results.actions_executed.push({
        action_name: 'create_follow_up_meeting',
        status: 'success',
        result: { meeting_id: followUpMeeting.id }
      });
    } catch (err) {
      results.actions_executed.push({
        action_name: 'create_follow_up_meeting',
        status: 'failed',
        error: err.message
      });
    }

    // Update automation run
    results.summary = `✅ Automatización post-transcripción:\n- ${results.tasks_created.length} tareas creadas\n- ${results.notifications_sent.length} notificaciones enviadas\n- ${results.follow_ups_created.length} follow-ups creados`;

    await base44.asServiceRole.entities.AutomationRun.update(automationRun.id, {
      status: results.tasks_created.length > 0 || results.follow_ups_created.length > 0 ? 'success' : 'partial',
      actions_executed: results.actions_executed,
      tasks_created: results.tasks_created,
      notifications_sent: results.notifications_sent,
      follow_ups_created: results.follow_ups_created,
      summary: results.summary,
      executed_at: new Date().toISOString()
    });

    return Response.json({
      success: true,
      automation_run_id: automationRun.id,
      ...results
    });
  } catch (error) {
    console.error('Post-transcription automation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function getDueDate(offsetDays = 7) {
  const date = new Date();
  date.setDate(date.getDate() + (offsetDays || 7));
  return date.toISOString().split('T')[0];
}