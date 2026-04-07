import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { client_id, start_date, end_date } = await req.json();
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlebigquery');

    const query = `
SELECT 
  json_data->>'client_id' as client_id,
  json_data->>'delivery_template_id' as template,
  COUNT(*) as total_deliveries,
  COUNT(CASE WHEN json_data->>'status' = 'delivered' THEN 1 END) as successful,
  COUNT(CASE WHEN json_data->>'status' = 'failed' THEN 1 END) as failed,
  ROUND(AVG(CAST(json_data->>'quality_score' AS FLOAT64)) * 100, 1) as avg_quality,
  ROUND(AVG(CAST(json_data->>'total_time_ms' AS FLOAT64)) / 60000, 1) as avg_time_minutes
FROM \`project.dataset.app_events\`
WHERE 
  json_data->>'entity_type' = 'DeliveryRun'
  ${client_id ? `AND json_data->>'client_id' = '${client_id}'` : ''}
  ${start_date ? `AND DATE(created_date) >= '${start_date}'` : ''}
  ${end_date ? `AND DATE(created_date) <= '${end_date}'` : ''}
GROUP BY client_id, template
ORDER BY total_deliveries DESC
    `;

    const queryRequest = { query, useLegacySql: false, maxResults: 100 };

    const response = await fetch('https://bigquery.googleapis.com/bigquery/v2/projects/_/queries', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(queryRequest)
    });

    const bigQueryData = await response.json();
    const rows = (bigQueryData.rows || []).map(r => ({
      client_id: r.f[0].v,
      template: r.f[1].v,
      total_deliveries: parseInt(r.f[2].v),
      successful: parseInt(r.f[3].v),
      failed: parseInt(r.f[4].v),
      success_rate: ((parseInt(r.f[3].v) / parseInt(r.f[2].v)) * 100).toFixed(1),
      avg_quality: parseFloat(r.f[5].v),
      avg_time_minutes: parseFloat(r.f[6].v)
    }));

    return Response.json({ success: true, metrics: rows });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});