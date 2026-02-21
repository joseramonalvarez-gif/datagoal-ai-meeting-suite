import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query_name, results_data, columns } = await req.json();

    if (!results_data || !columns) {
      return Response.json({ error: 'Missing results_data or columns' }, { status: 400 });
    }

    // Prepare data summary for LLM
    const dataSummary = {
      query: query_name,
      total_rows: results_data.length,
      columns: columns.map(c => c.name),
      sample_data: results_data.slice(0, 10)
    };

    const prompt = `Analiza los siguientes resultados de una consulta BigQuery y proporciona un resumen ejecutivo en lenguaje natural.

Consulta: ${query_name}
Columnas: ${columns.map(c => c.name).join(', ')}
Total de filas: ${results_data.length}

Datos de muestra (primeras 10 filas):
${JSON.stringify(results_data.slice(0, 10), null, 2)}

Por favor:
1. Identifica las tendencias principales
2. Destaca valores anómalos o interesantes
3. Proporciona 2-3 insights clave
4. Sugiere acciones posibles basadas en los datos
5. Mantén el tono profesional y conciso

Estructura la respuesta en párrafos claros.`;

    const summary = await base44.integrations.Core.InvokeLLM({
      prompt
    });

    return Response.json({ 
      success: true,
      summary,
      data_points: {
        total_rows: results_data.length,
        columns_analyzed: columns.length
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});