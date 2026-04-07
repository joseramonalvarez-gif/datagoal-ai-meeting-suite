import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import OpenAI from 'npm:openai@4.76.0';

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transcript_id, meeting_id, client_id, project_id, full_text } = await req.json();

    if (!full_text || !transcript_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create or update MeetingInsights with "analyzing" status
    let insights = await base44.asServiceRole.entities.MeetingInsights.filter({
      transcript_id,
    });

    let insightsId;
    if (insights.length === 0) {
      const newInsights = await base44.asServiceRole.entities.MeetingInsights.create({
        meeting_id,
        transcript_id,
        client_id,
        project_id,
        analysis_status: 'analyzing',
      });
      insightsId = newInsights.id;
    } else {
      insightsId = insights[0].id;
      await base44.asServiceRole.entities.MeetingInsights.update(insightsId, {
        analysis_status: 'analyzing',
      });
    }

    // Call GPT-4 with structured analysis prompt
    const analysisPrompt = buildAnalysisPrompt(full_text);

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'Eres un analista experto en reuniones de negocios. Analiza transcripciones para extraer riesgos, oportunidades y recomendaciones estratégicas con precisión y claridad.',
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      temperature: 0.7,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'meeting_analysis',
          schema: {
            type: 'object',
            properties: {
              risks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                    mitigation: { type: 'string' },
                  },
                  required: ['title', 'description', 'severity', 'mitigation'],
                },
              },
              opportunities: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    impact: { type: 'string', enum: ['low', 'medium', 'high'] },
                    next_steps: { type: 'string' },
                  },
                  required: ['title', 'description', 'impact', 'next_steps'],
                },
              },
              strategic_recommendations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                    timeline: { type: 'string' },
                  },
                  required: ['title', 'description', 'priority', 'timeline'],
                },
              },
              key_metrics: {
                type: 'object',
                properties: {
                  sentiment: { type: 'string' },
                  decision_count: { type: 'number' },
                  action_items_count: { type: 'number' },
                },
              },
            },
            required: ['risks', 'opportunities', 'strategic_recommendations', 'key_metrics'],
          },
        },
      },
    });

    const analysisData = JSON.parse(response.choices[0].message.content);

    // Update MeetingInsights with analysis results
    await base44.asServiceRole.entities.MeetingInsights.update(insightsId, {
      risks: analysisData.risks,
      opportunities: analysisData.opportunities,
      strategic_recommendations: analysisData.strategic_recommendations,
      key_metrics: analysisData.key_metrics,
      analysis_status: 'completed',
      analysis_date: new Date().toISOString(),
    });

    // Audit log
    if (client_id && project_id) {
      await base44.asServiceRole.entities.AuditLog.create({
        client_id,
        project_id,
        user_email: user.email,
        action: 'meeting_analysis_completed',
        entity_type: 'MeetingInsights',
        entity_id: insightsId,
        details: `Análisis completado: ${analysisData.risks.length} riesgos, ${analysisData.opportunities.length} oportunidades, ${analysisData.strategic_recommendations.length} recomendaciones`,
        timestamp: new Date().toISOString(),
      });
    }

    return Response.json({
      success: true,
      insightsId,
      analysis: analysisData,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function buildAnalysisPrompt(transcriptText) {
  return `
Analiza la siguiente transcripción de reunión empresarial y extrae:

1. **RIESGOS**: Identifica 3-5 riesgos clave mencionados o implícitos en la conversación. Para cada uno, proporciona:
   - Título conciso
   - Descripción detallada
   - Severidad (low, medium, high, critical)
   - Estrategia de mitigación

2. **OPORTUNIDADES**: Identifica 3-5 oportunidades estratégicas o de mejora. Para cada una:
   - Título conciso
   - Descripción detallada
   - Impacto potencial (low, medium, high)
   - Próximos pasos recomendados

3. **RECOMENDACIONES ESTRATÉGICAS**: Proporciona 3-5 recomendaciones accionables. Para cada una:
   - Título conciso
   - Descripción detallada
   - Prioridad (low, medium, high)
   - Timeline sugerida

4. **MÉTRICAS CLAVE**:
   - Sentimiento general de la reunión
   - Número de decisiones tomadas
   - Número de items de acción identificados

TRANSCRIPCIÓN:
${transcriptText}

Responde en JSON válido con la estructura especificada.
  `;
}