import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Export Dashboard data to CSV (detailed analytics)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    const { client_id, entity_type, date_from, date_to } = await req.json();

    console.log(`[exportDashboardCSV] Exporting ${entity_type} for client ${client_id}`);

    let csv = '';

    switch (entity_type) {
      case 'tasks':
        csv = await exportTasksCSV(base44, client_id, date_from, date_to);
        break;
      case 'deliveries':
        csv = await exportDeliveriesCSV(base44, client_id, date_from, date_to);
        break;
      case 'meetings':
        csv = await exportMeetingsCSV(base44, client_id, date_from, date_to);
        break;
      case 'time_entries':
        csv = await exportTimeEntriesCSV(base44, client_id, date_from, date_to);
        break;
      default:
        csv = 'Unknown entity type';
    }

    // Log export to audit trail
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'dashboard_exported_csv',
      entity_type: 'Dashboard',
      entity_id: client_id,
      actor_email: user.email,
      actor_name: user.full_name,
      severity: 'info',
      changes: { export_type: entity_type, date_range: { from: date_from, to: date_to } }
    }).catch(() => {});

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=${entity_type}_${new Date().toISOString().split('T')[0]}.csv`
      }
    });

  } catch (error) {
    console.error('[exportDashboardCSV] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function exportTasksCSV(base44, clientId, dateFrom, dateTo) {
  const tasks = await base44.asServiceRole.entities.Task.filter(
    { client_id: clientId },
    '-created_date',
    1000
  );

  let csv = 'ID,Title,Status,Priority,Assignee,Due Date,Project,Created,Completed\n';

  tasks.forEach(task => {
    const row = [
      task.id.substring(0, 8),
      `"${task.title}"`,
      task.status,
      task.priority,
      task.assignees?.[0]?.email || '-',
      task.due_date || '-',
      task.project_id.substring(0, 8),
      task.created_date ? new Date(task.created_date).toLocaleDateString('es-ES') : '-',
      task.status === 'done' ? new Date(task.updated_date).toLocaleDateString('es-ES') : '-'
    ].join(',');
    csv += row + '\n';
  });

  return csv;
}

async function exportDeliveriesCSV(base44, clientId, dateFrom, dateTo) {
  const deliveries = await base44.asServiceRole.entities.DeliveryRun.filter(
    { status: 'delivered' },
    '-sent_at',
    500
  );

  let csv = 'ID,Template,Status,Quality Score,Meeting,Sent By,Sent At,Time (ms)\n';

  deliveries.forEach(delivery => {
    const row = [
      delivery.id.substring(0, 8),
      delivery.delivery_template_id.substring(0, 8),
      delivery.status,
      (delivery.quality_score * 100).toFixed(0),
      delivery.trigger_entity_id.substring(0, 8),
      delivery.sent_by || '-',
      delivery.sent_at ? new Date(delivery.sent_at).toLocaleString('es-ES') : '-',
      delivery.total_time_ms || '-'
    ].join(',');
    csv += row + '\n';
  });

  return csv;
}

async function exportMeetingsCSV(base44, clientId, dateFrom, dateTo) {
  const meetings = await base44.asServiceRole.entities.Meeting.filter(
    { client_id: clientId },
    '-created_date',
    500
  );

  let csv = 'ID,Title,Project,Date,Participants,Status,Objective\n';

  meetings.forEach(meeting => {
    const row = [
      meeting.id.substring(0, 8),
      `"${meeting.title}"`,
      meeting.project_id.substring(0, 8),
      meeting.date ? new Date(meeting.date).toLocaleString('es-ES') : '-',
      meeting.participants?.length || 0,
      meeting.status,
      `"${meeting.objective || ''}"`
    ].join(',');
    csv += row + '\n';
  });

  return csv;
}

async function exportTimeEntriesCSV(base44, clientId, dateFrom, dateTo) {
  const entries = await base44.asServiceRole.entities.TimeEntry.filter(
    { client_id: clientId },
    '-created_date',
    1000
  );

  let csv = 'ID,User,Project,Hours,Rate,Billable,Date,Description\n';

  entries.forEach(entry => {
    const row = [
      entry.id.substring(0, 8),
      entry.user_email || '-',
      entry.project_id.substring(0, 8),
      entry.hours || 0,
      entry.hourly_rate || 0,
      entry.is_billable ? 'Yes' : 'No',
      entry.created_date ? new Date(entry.created_date).toLocaleDateString('es-ES') : '-',
      `"${entry.description || ''}"`
    ].join(',');
    csv += row + '\n';
  });

  return csv;
}