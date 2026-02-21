import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { start_date, end_date } = await req.json();

    const startDate = start_date || new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlebigquery');

    // Query BigQuery for aggregate data across all clients
    const query = `
SELECT 
  json_data->>'client_id' as client_id,
  DATE(created_date) as date,
  COUNT(DISTINCT id) as total_records,
  COUNT(DISTINCT json_data->>'user_id') as unique_users,
  SUM(CAST(json_data->>'billable_hours' AS FLOAT64)) as billable_hours,
  SUM(CAST(json_data->>'total_hours' AS FLOAT64)) as total_hours,
  AVG(CAST(json_data->>'quality_score' AS FLOAT64)) as avg_quality
FROM \`project.dataset.app_events\`
WHERE 
  DATE(created_date) BETWEEN '${startDate}' AND '${endDate}'
GROUP BY client_id, date
ORDER BY date DESC, client_id
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

    // Get all clients for mapping
    const allClients = await base44.asServiceRole.entities.Client.list();
    const clientMap = new Map(allClients.map(c => [c.id, c.name]));

    // Aggregate metrics by client
    const clientMetrics = {};
    rows.forEach(r => {
      const clientId = r.f[0].v;
      if (!clientMetrics[clientId]) {
        clientMetrics[clientId] = {
          client_id: clientId,
          client_name: clientMap.get(clientId) || 'Unknown',
          total_records: 0,
          unique_users: new Set(),
          billable_hours: 0,
          total_hours: 0,
          quality_scores: []
        };
      }
      clientMetrics[clientId].total_records += parseInt(r.f[2].v || 0);
      clientMetrics[clientId].unique_users.add(r.f[3].v);
      clientMetrics[clientId].billable_hours += parseFloat(r.f[4].v || 0);
      clientMetrics[clientId].total_hours += parseFloat(r.f[5].v || 0);
      if (r.f[6].v) clientMetrics[clientId].quality_scores.push(parseFloat(r.f[6].v));
    });

    // Calculate final metrics
    const summary = {
      period: { start: startDate, end: endDate },
      total_clients: Object.keys(clientMetrics).length,
      clients: Object.values(clientMetrics).map(m => ({
        ...m,
        unique_users: m.unique_users.size,
        avg_quality_score: m.quality_scores.length > 0 
          ? (m.quality_scores.reduce((a, b) => a + b) / m.quality_scores.length * 100).toFixed(1)
          : 'N/A',
        billable_ratio: m.total_hours > 0 ? ((m.billable_hours / m.total_hours) * 100).toFixed(1) : 0
      })).sort((a, b) => b.billable_hours - a.billable_hours)
    };

    // Save snapshot to database
    await base44.asServiceRole.entities.AnalyticsSnapshot.create({
      snapshot_date: new Date().toISOString().split('T')[0],
      period_type: 'weekly',
      metrics: {
        total_records: rows.length,
        total_billable_hours: Object.values(clientMetrics).reduce((sum, m) => sum + m.billable_hours, 0),
        total_hours: Object.values(clientMetrics).reduce((sum, m) => sum + m.total_hours, 0),
        avg_quality: Object.values(clientMetrics).reduce((sum, m) => {
          const avg = m.quality_scores.length > 0 
            ? m.quality_scores.reduce((a, b) => a + b) / m.quality_scores.length
            : 0;
          return sum + avg;
        }, 0) / Object.keys(clientMetrics).length
      }
    });

    return Response.json({ 
      success: true,
      summary,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});