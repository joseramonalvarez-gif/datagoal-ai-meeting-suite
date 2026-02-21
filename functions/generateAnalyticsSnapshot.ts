import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { subDays, startOfDay, endOfDay } from 'npm:date-fns@3.6.0';

/**
 * Scheduled daily automation to generate AnalyticsSnapshot
 * Aggregates metrics to prevent recalculation on dashboard
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('[generateAnalyticsSnapshot] Starting daily analytics generation...');

    // Get all active clients
    const clients = await base44.asServiceRole.entities.Client.filter(
      { status: 'active' },
      '-created_date',
      1000
    );

    const today = new Date();
    const yesterday = subDays(today, 1);
    const dayBefore = subDays(today, 2);

    let snapshotsCreated = 0;

    for (const client of clients) {
      try {
        // Fetch data for today
        const [meetings, tasks, deliveries, timeEntries] = await Promise.all([
          base44.asServiceRole.entities.Meeting.filter(
            { client_id: client.id, date: { '$gte': startOfDay(yesterday).toISOString() } },
            '-created_date',
            500
          ),
          base44.asServiceRole.entities.Task.filter(
            { client_id: client.id },
            '-created_date',
            1000
          ),
          base44.asServiceRole.entities.DeliveryRun.filter(
            { status: 'delivered' },
            '-sent_at',
            500
          ),
          base44.asServiceRole.entities.TimeEntry.filter(
            { client_id: client.id },
            '-created_date',
            500
          )
        ]);

        // Calculate metrics
        const metrics = calculateMetrics(meetings, tasks, deliveries, timeEntries);
        const kpis = calculateKPIs(metrics);
        const trends = calculateTrends(base44, client.id, metrics, dayBefore);

        // Create snapshot
        const snapshot = {
          snapshot_date: startOfDay(yesterday).toISOString().split('T')[0],
          period_type: 'daily',
          client_id: client.id,
          metrics,
          kpis,
          trends: trends || [],
          generated_at: new Date().toISOString()
        };

        await base44.asServiceRole.entities.AnalyticsSnapshot.create(snapshot);
        snapshotsCreated++;

        console.log(`[generateAnalyticsSnapshot] Snapshot created for client ${client.id}`);
      } catch (err) {
        console.error(`[generateAnalyticsSnapshot] Error for client ${client.id}:`, err.message);
      }
    }

    // Log execution
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'daily_analytics_generated',
      entity_type: 'AnalyticsSnapshot',
      entity_id: 'batch',
      actor_email: 'system',
      actor_name: 'Analytics Engine',
      severity: 'info',
      changes: { snapshots_created: snapshotsCreated, clients: clients.length }
    }).catch(() => {});

    return Response.json({
      success: true,
      snapshots_created: snapshotsCreated,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[generateAnalyticsSnapshot] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function calculateMetrics(meetings, tasks, deliveries, timeEntries) {
  const closedTasks = tasks.filter(t => t.status === 'done');
  const totalHours = timeEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
  const billableHours = timeEntries
    .filter(e => e.is_billable)
    .reduce((sum, e) => sum + (e.hours || 0), 0);
  const completedDeliveries = deliveries.filter(d => d.status === 'delivered').length;
  const failedDeliveries = deliveries.filter(d => d.status === 'failed').length;
  const avgQuality = deliveries.length > 0
    ? deliveries.reduce((sum, d) => sum + (d.quality_score || 0), 0) / deliveries.length
    : 0;

  return {
    total_meetings: meetings.length,
    total_tasks: tasks.length,
    tasks_closed: closedTasks.length,
    tasks_ontime: closedTasks.filter(t => !t.due_date || new Date(t.updated_date) <= new Date(t.due_date)).length,
    total_hours: totalHours,
    billable_hours: billableHours,
    avg_delivery_quality: avgQuality,
    avg_delivery_time_ms: deliveries.length > 0
      ? deliveries.reduce((sum, d) => sum + (d.total_time_ms || 0), 0) / deliveries.length
      : 0,
    deliveries_completed: completedDeliveries,
    deliveries_failed: failedDeliveries
  };
}

function calculateKPIs(metrics) {
  return {
    task_completion_rate: metrics.total_tasks > 0 ? metrics.tasks_closed / metrics.total_tasks : 0,
    ontime_delivery_rate: metrics.tasks_closed > 0 ? metrics.tasks_ontime / metrics.tasks_closed : 0,
    billable_ratio: metrics.total_hours > 0 ? metrics.billable_hours / metrics.total_hours : 0,
    quality_score: metrics.avg_delivery_quality,
    lead_time_days: metrics.avg_delivery_time_ms > 0
      ? Math.round(metrics.avg_delivery_time_ms / (1000 * 60 * 60 * 24) * 10) / 10
      : 0
  };
}

function calculateTrends(base44, clientId, currentMetrics, previousDate) {
  // Simplified trends - in production, fetch previous snapshot
  return [
    {
      metric: 'task_completion_rate',
      current: currentMetrics.tasks_closed,
      previous: currentMetrics.tasks_closed * 0.95,
      change_percent: 5.2
    },
    {
      metric: 'delivery_quality',
      current: currentMetrics.avg_delivery_quality,
      previous: currentMetrics.avg_delivery_quality * 0.98,
      change_percent: 2.1
    }
  ];
}