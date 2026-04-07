import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user activity from recent saved queries and interactions
    const recentQueries = await base44.asServiceRole.entities.SavedQuery.filter(
      { author_email: user.email },
      '-updated_date',
      10
    );

    const activityContext = recentQueries
      .map(q => `${q.category}: ${q.name} - ${q.description}`)
      .join('\n');

    const prompt = `Basado en el historial de consultas del usuario, sugiere 5 nuevas consultas SQL útiles para BigQuery que podrían proporcionarle insights adicionales.

Historial de consultas recientes:
${activityContext || 'Sin historial'}

Para cada sugerencia, proporciona:
1. Nombre descriptivo
2. Descripción breve
3. Categoría (meetings, transcriptions, deliveries, tasks, analytics, custom)
4. Consulta SQL completa de BigQuery

Responde en JSON con estructura: [{"name": "...", "description": "...", "category": "...", "query_sql": "..."}]`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                category: { type: "string" },
                query_sql: { type: "string" }
              }
            }
          }
        }
      }
    });

    return Response.json({ 
      success: true,
      suggestions: response.suggestions || []
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});