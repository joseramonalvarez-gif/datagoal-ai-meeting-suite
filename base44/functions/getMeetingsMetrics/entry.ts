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
  COUNT(*) as total_meetings,
  COUNT(CASE WHEN json_data->>'status' IN ('transcribed', 'report_generated') THEN 1 END) as processed_meetings,
  COUNT(DISTINCT SUBSTR(created_date, 1, 10)) as days_with_meetings,
  COUNT(DISTINCT json_data->>'project_id') as projects_involved
FROM \`project.dataset.app_events\`
WHERE 
  json_data->>'entity_type' = 'Meeting'
  ${client_id ? `AND json_data->>'client_id' = '${client_id}'` : ''}
  ${start_date ? `AND DATE(created_date) >= '${start_date}'` : ''}
  ${end_date ? `AND DATE(created_date) <= '${end_date}'` : ''}
GROUP BY client_id
ORDER BY total_meetings DESC
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
      total_meetings: parseInt(r.f[1].v),
      processed_meetings: parseInt(r.f[2].v),
      days_with_meetings: parseInt(r.f[3].v),
      projects_involved: parseInt(r.f[4].v)
    }));

    return Response.json({ success: true, metrics: rows });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});