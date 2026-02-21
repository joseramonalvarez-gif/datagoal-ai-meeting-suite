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
  COUNT(*) as total_transcripts,
  COUNT(CASE WHEN json_data->>'status' = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN json_data->>'status' = 'error' THEN 1 END) as failed,
  COUNT(CASE WHEN json_data->>'has_diarization' = 'true' THEN 1 END) as with_diarization,
  COUNT(CASE WHEN json_data->>'has_timeline' = 'true' THEN 1 END) as with_timeline,
  ROUND(AVG(CAST(json_data->>'segment_count' AS FLOAT64)), 2) as avg_segments
FROM \`project.dataset.app_events\`
WHERE 
  json_data->>'entity_type' = 'Transcript'
  ${client_id ? `AND json_data->>'client_id' = '${client_id}'` : ''}
  ${start_date ? `AND DATE(created_date) >= '${start_date}'` : ''}
  ${end_date ? `AND DATE(created_date) <= '${end_date}'` : ''}
GROUP BY client_id
ORDER BY total_transcripts DESC
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
      total_transcripts: parseInt(r.f[1].v),
      completed: parseInt(r.f[2].v),
      failed: parseInt(r.f[3].v),
      with_diarization: parseInt(r.f[4].v),
      with_timeline: parseInt(r.f[5].v),
      avg_segments: parseFloat(r.f[6].v)
    }));

    return Response.json({ success: true, metrics: rows });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});