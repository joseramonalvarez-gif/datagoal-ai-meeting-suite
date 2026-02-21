import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { client_id, start_date, end_date } = await req.json();

    if (!client_id) {
      return Response.json({ error: 'Missing client_id' }, { status: 400 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlebigquery');

    // Get client info
    const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    if (!clients || clients.length === 0) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    const client = clients[0];
    const startDate = start_date || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];

    // Query BigQuery for analytics data
    const query = `
SELECT 
  DATE(created_date) as date,
  COUNT(DISTINCT id) as total_records,
  SUM(CAST(json_data->>'billable_hours' AS FLOAT64)) as billable_hours,
  SUM(CAST(json_data->>'total_hours' AS FLOAT64)) as total_hours,
  COUNT(CASE WHEN json_data->>'status' = 'completed' THEN 1 END) as completed_items,
  COUNT(CASE WHEN json_data->>'status' = 'failed' THEN 1 END) as failed_items
FROM \`project.dataset.app_events\`
WHERE 
  DATE(created_date) BETWEEN '${startDate}' AND '${endDate}'
  AND json_data->>'client_id' = '${client_id}'
GROUP BY date
ORDER BY date DESC
    `;

    const queryRequest = {
      query: query,
      useLegacySql: false
    };

    const response = await fetch('https://bigquery.googleapis.com/bigquery/v2/projects/_/queries', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(queryRequest)
    });

    if (!response.ok) {
      throw new Error(`BigQuery request failed: ${response.statusText}`);
    }

    const bigQueryData = await response.json();
    const rows = bigQueryData.rows || [];

    // Get app data for comparison
    const meetings = await base44.asServiceRole.entities.Meeting.filter({ client_id });
    const projects = await base44.asServiceRole.entities.Project.filter({ client_id });
    const tasks = await base44.asServiceRole.entities.Task.filter({ client_id });
    const deliveries = await base44.asServiceRole.entities.DeliveryRun.filter({ client_id });

    // Calculate metrics
    const completedTasks = tasks?.filter(t => t.status === 'done').length || 0;
    const completedDeliveries = deliveries?.filter(d => d.status === 'delivered').length || 0;
    const avgQuality = deliveries?.reduce((sum, d) => sum + (d.quality_score || 0), 0) / (deliveries?.length || 1);

    const summary = {
      client: client.name,
      period: { start: startDate, end: endDate },
      meetings: meetings?.length || 0,
      projects: projects?.length || 0,
      total_tasks: tasks?.length || 0,
      completed_tasks: completedTasks,
      task_completion_rate: tasks?.length > 0 ? ((completedTasks / tasks.length) * 100).toFixed(1) : 0,
      deliveries: deliveries?.length || 0,
      completed_deliveries: completedDeliveries,
      avg_quality_score: (avgQuality * 100).toFixed(1),
      bigquery_metrics: rows.map(r => ({
        date: r.f[0].v,
        total_records: r.f[1].v,
        billable_hours: parseFloat(r.f[2].v || 0),
        total_hours: parseFloat(r.f[3].v || 0),
        completed: r.f[4].v,
        failed: r.f[5].v
      })),
      total_billable_hours: rows.reduce((sum, r) => sum + parseFloat(r.f[2].v || 0), 0),
      total_hours_tracked: rows.reduce((sum, r) => sum + parseFloat(r.f[3].v || 0), 0)
    };

    return Response.json({ 
      success: true,
      summary,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});