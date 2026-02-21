import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Generate daily analytics snapshot for reporting
 * Called via scheduled automation (daily at midnight)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { client_id, project_id } = await req.json();

    console.log(`[generateAnalyticsSnapshot] Generating for client: ${client_id}, project: ${project_id}`);

    // Fetch data for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [meetings, tasks, deliveries, timeEntries] = await Promise.all([
      base44.asServiceRole.entities.Meeting.filter({ 
        client_id, 
        project_id: project_id || undefined 
      }, '-created_date', 1000),
      base44.asServiceRole.entities.Task.filter({ 
        client_id, 
        project_id: project_id || undefined 
      }, '-created_date', 1000),
      base44.asServiceRole.entities.DeliveryRun.filter({ 
        status: 'delivered' 
      }, '-created_date', 1000),
      base44.asServiceRole.entities.TimeEntry.filter({ 
        client_id, 
        project_id: project_id || undefined 
      }, '-created_date', 1000)
    ]);

    // Calculate metrics
    const totalHours = timeEntries.reduce((sum, t) => sum + (t.hours || 0), 0);
    const billableHours = timeEntries.filter(t => t.billable).reduce((sum, t) => sum + (t.hours || 0), 0);
    const closedTasks = tasks.filter(t => t.status === 'done').length;
    const onTimeTasks = tasks.filter(t => t.status === 'done' && (!t.due_date || new Date(t.due_date) >= new Date(t.updated_date))).length;
    const avgDeliveryQuality = deliveries.length > 0 
      ? deliveries.reduce((sum, d) => sum + (d.quality_score || 0), 0) / deliveries.length 
      : 0;
    const avgDeliveryTime = deliveries.length > 0
      ? deliveries.reduce((sum, d) => sum + (d.total_time_ms || 0), 0) / deliveries.length
      : 0;

    const snapshot = {
      snapshot_date: today.toISOString().split('T')[0],
      period_type: 'daily',
      client_id,
      project_id: project_id || null,
      metrics: {
        total_meetings: meetings.length,
        total_tasks: tasks.length,
        tasks_closed: closedTasks,
        tasks_ontime: onTimeTasks,
        total_hours: totalHours,
        billable_hours: billableHours,
        avg_delivery_quality: avgDeliveryQuality,
        avg_delivery_time_ms: avgDeliveryTime,
        deliveries_completed: deliveries.filter(d => d.status === 'delivered').length,
        deliveries_failed: deliveries.filter(d => d.status === 'failed').length
      },
      kpis: {
        task_completion_rate: tasks.length > 0 ? (closedTasks / tasks.length) : 0,
        ontime_delivery_rate: closedTasks > 0 ? (onTimeTasks / closedTasks) : 0,
        billable_ratio: totalHours > 0 ? (billableHours / totalHours) : 0,
        quality_score: avgDeliveryQuality,
        lead_time_days: 0 // Calculate from first meeting to last delivery
      }
    };

    // Store snapshot
    const stored = await base44.asServiceRole.entities.AnalyticsSnapshot.create(snapshot);

    console.log(`[generateAnalyticsSnapshot] Snapshot created: ${stored.id}`);

    return Response.json({
      success: true,
      snapshot: stored
    });

  } catch (error) {
    console.error('[generateAnalyticsSnapshot] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});