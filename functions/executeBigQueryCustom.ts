import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query_template, params = {} } = await req.json();

    if (!query_template) {
      return Response.json({ error: 'Missing query_template' }, { status: 400 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlebigquery');

    // Replace parameters in query
    let finalQuery = query_template;
    Object.entries(params).forEach(([key, value]) => {
      finalQuery = finalQuery.replace(`@${key}`, `'${value}'`);
    });

    const queryRequest = {
      query: finalQuery,
      useLegacySql: false,
      maxResults: 1000
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
    const schema = bigQueryData.schema?.fields || [];
    const rows = (bigQueryData.rows || []).map(r => {
      const row = {};
      r.f.forEach((field, idx) => {
        row[schema[idx]?.name] = field.v;
      });
      return row;
    });

    return Response.json({ 
      success: true,
      data: rows,
      columns: schema.map(f => ({ name: f.name, type: f.type })),
      total_rows: bigQueryData.totalRows,
      execution_time_ms: bigQueryData.totalBytesProcessed
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});