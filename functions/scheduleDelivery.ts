import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Schedule a delivery to run at a specific time
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { meeting_id, template_id, scheduled_time, recipients } = await req.json();

    if (!meeting_id || !template_id || !scheduled_time) {
      return Response.json({ 
        error: 'meeting_id, template_id, and scheduled_time required' 
      }, { status: 400 });
    }

    const scheduledDate = new Date(scheduled_time);
    const now = new Date();

    if (scheduledDate <= now) {
      return Response.json({ 
        error: 'scheduled_time must be in the future' 
      }, { status: 400 });
    }

    console.log(`[scheduleDelivery] Scheduling delivery for ${scheduledDate.toISOString()}`);

    const meeting = await base44.entities.Meeting.get(meeting_id);
    if (!meeting) {
      return Response.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const task = await base44.entities.Task.create({
      client_id: meeting.client_id,
      project_id: meeting.project_id,
      meeting_id: meeting_id,
      title: `📅 Entrega programada: ${meeting.title}`,
      description: `Entrega automática programada para ${scheduledDate.toLocaleString('es-ES')}`,
      status: 'todo',
      priority: 'high',
      due_date: scheduledDate.toISOString().split('T')[0],
      tags: ['scheduled_delivery', template_id]
    });

    await base44.entities.Notification.create({
      user_email: user.email,
      title: '📅 Entrega programada',
      message: `Entrega de ${meeting.title} programada para ${scheduledDate.toLocaleString('es-ES')}`,
      type: 'scheduled_delivery',
      is_read: false,
      related_entity_id: task.id
    });

    console.log(`[scheduleDelivery] Scheduled delivery created with task ${task.id}`);

    return Response.json({
      success: true,
      task_id: task.id,
      scheduled_time: scheduledDate.toISOString(),
      message: 'Entrega programada exitosamente'
    });

  } catch (error) {
    console.error('[scheduleDelivery] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});