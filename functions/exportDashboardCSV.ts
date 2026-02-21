import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Generate detailed CSV export for analytical review
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { client_id, project_id, data_type = 'tasks' } = await req.json();

    console.log(`[exportDashboardCSV] Exporting ${data_type} CSV for client: ${client_id}`);

    let csv = '';

    if (data_type === 'tasks') {
      const tasks = await base44.entities.Task.filter({
        client_id,
        project_id: project_id || undefined
      }, '-updated_date', 5000);

      csv = 'Task ID,Title,Status,Priority,Assignee,Due Date,Created Date,Days Open\n';
      tasks.forEach(task => {
        const daysOpen = task.due_date 
          ? Math.ceil((new Date(task.due_date) - new Date(task.created_date)) / (1000 * 60 * 60 * 24))
          : 0;
        const assignee = task.assignees?.map(a => a.name).join(';') || task.assignee_name || 'Unassigned';
        csv += `"${task.id}","${task.title.replace(/"/g, '""')}","${task.status}","${task.priority}","${assignee}","${task.due_date || 'N/A'}","${task.created_date}",${daysOpen}\n`;
      });
    } 
    else if (data_type === 'time') {
      const timeEntries = await base44.entities.TimeEntry.filter({
        client_id,
        project_id: project_id || undefined
      }, '-created_date', 5000);

      csv = 'Entry ID,User,Project,Hours,Billable,Task,Date,Description\n';
      timeEntries.forEach(entry => {
        csv += `"${entry.id}","${entry.user_name || 'Unknown'}","${entry.project_id || 'N/A'}","${entry.hours}","${entry.billable ? 'Yes' : 'No'}","${entry.task_id || 'N/A'}","${entry.created_date}","${(entry.description || '').replace(/"/g, '""')}"\n`;
      });
    } 
    else if (data_type === 'deliveries') {
      const deliveries = await base44.asServiceRole.entities.DeliveryRun.filter({}, '-created_date', 5000);

      csv = 'Delivery ID,Status,Quality Score,Time (s),Recipients,Created Date,Sent Date\n';
      deliveries.forEach(d => {
        const timeSec = Math.round((d.total_time_ms || 0) / 1000);
        const recipients = (d.recipients || []).join(';');
        csv += `"${d.id}","${d.status}","${(d.quality_score || 0).toFixed(2)}","${timeSec}","${recipients}","${d.created_date}","${d.sent_at || 'N/A'}"\n`;
      });
    }
    else if (data_type === 'meetings') {
      const meetings = await base44.entities.Meeting.filter({
        client_id,
        project_id: project_id || undefined
      }, '-date', 5000);

      csv = 'Meeting ID,Title,Date,Status,Participants,Organizer\n';
      meetings.forEach(m => {
        const participants = m.participants?.map(p => p.name).join(';') || '';
        csv += `"${m.id}","${m.title.replace(/"/g, '""')}","${m.date}","${m.status}","${participants}","${m.organizer_email}"\n`;
      });
    }

    return Response.json({
      success: true,
      csv: csv,
      format: 'csv',
      filename: `${data_type}_export_${client_id}_${new Date().toISOString().split('T')[0]}.csv`
    });

  } catch (error) {
    console.error('[exportDashboardCSV] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});