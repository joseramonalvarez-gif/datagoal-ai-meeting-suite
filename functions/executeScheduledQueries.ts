import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { query_id } = await req.json();

    // Get scheduled query
    const savedQueries = await base44.asServiceRole.entities.SavedQuery.filter({ id: query_id });
    if (!savedQueries || savedQueries.length === 0) {
      return Response.json({ error: 'Query not found' }, { status: 404 });
    }

    const query = savedQueries[0];

    if (!query.is_scheduled) {
      return Response.json({ error: 'Query is not scheduled' }, { status: 400 });
    }

    // Execute the query
    const response = await base44.functions.invoke('executeBigQueryCustom', {
      query_template: query.query_sql
    });

    if (!response.data.success) {
      throw new Error(`Query execution failed: ${response.data.error}`);
    }

    // Update last execution
    await base44.asServiceRole.entities.SavedQuery.update(query_id, {
      last_executed: new Date().toISOString(),
      last_result_count: response.data.data.length
    });

    // Send email notifications if configured
    if (query.shared_with && query.shared_with.length > 0) {
      const emailBody = `
Consulta programada ejecutada: ${query.name}

Descripción: ${query.description}

Resultados:
- Filas obtenidas: ${response.data.data.length}
- Columnas: ${response.data.columns.map(c => c.name).join(', ')}
- Ejecutada: ${new Date().toISOString()}

Para ver los resultados completos, ingresa a la aplicación.
      `;

      for (const email of query.shared_with) {
        await base44.integrations.Core.SendEmail({
          to: email,
          subject: `Consulta Programada: ${query.name}`,
          body: emailBody
        });
      }
    }

    return Response.json({ 
      success: true,
      query_name: query.name,
      rows_returned: response.data.data.length,
      executed_at: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});