import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import OpenAI from 'npm:openai@4.76.0';

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

// GPT configurations
const GPT_MODELS = {
  pakito_mckensey: {
    name: 'Pakito McKensey',
    description: 'Análisis estratégico de reuniones',
    system_prompt: `Eres "Pakito McKensey", un analista experto en consultoría estratégica. Tu especialidad es analizar reuniones de negocios, informes, trabajos complejos, auditorías y desarrollo de negocios. 
    
Analiza transcripciones de reuniones para extraer riesgos estratégicos, oportunidades de negocio y recomendaciones de alto nivel con precisión y claridad.`,
    output_type: 'strategic_analysis'
  },
  copywriter_data_goal: {
    name: 'COPYWRITER DATA GOAL',
    description: 'Generador de copys de venta y artículos',
    system_prompt: `Eres "COPYWRITER DATA GOAL", un experto en copywriting y marketing de alto rendimiento. Tu especialidad es crear copys de venta persuasivos y artículos de marketing basados en información de reuniones y documentos.
    
Tu objetivo es transformar los insights de negocio en contenido marketing atractivo y conversión-optimizado.`,
    output_type: 'copy_content'
  }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transcript_id, meeting_id, client_id, project_id, full_text, selected_models } = await req.json();

    if (!full_text || !transcript_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const models_to_run = selected_models || Object.keys(GPT_MODELS);

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
        gpt_models_used: models_to_run,
      });
      insightsId = newInsights.id;
    } else {
      insightsId = insights[0].id;
      await base44.asServiceRole.entities.MeetingInsights.update(insightsId, {
        analysis_status: 'analyzing',
        gpt_models_used: models_to_run,
      });
    }

    // Run selected models in parallel
    const analysisPromises = models_to_run.map(modelKey => 
      runModel(modelKey, full_text)
    );

    const results = await Promise.all(analysisPromises);
    
    // Consolidate results
    let consolidatedData = {
      risks: [],
      opportunities: [],
      strategic_recommendations: [],
      copy_content: null,
      key_metrics: null,
      insights_by_model: {}
    };

    results.forEach((result, idx) => {
      const modelKey = models_to_run[idx];
      consolidatedData.insights_by_model[modelKey] = result;

      if (GPT_MODELS[modelKey].output_type === 'strategic_analysis') {
        if (result.risks) {
          consolidatedData.risks.push(...result.risks.map(r => ({ ...r, source_model: modelKey })));
        }
        if (result.opportunities) {
          consolidatedData.opportunities.push(...result.opportunities.map(o => ({ ...o, source_model: modelKey })));
        }
        if (result.strategic_recommendations) {
          consolidatedData.strategic_recommendations.push(...result.strategic_recommendations.map(rec => ({ ...rec, source_model: modelKey })));
        }
        if (result.key_metrics) {
          consolidatedData.key_metrics = result.key_metrics;
        }
      } else if (GPT_MODELS[modelKey].output_type === 'copy_content') {
        consolidatedData.copy_content = { ...result, source_model: modelKey };
      }
    });

    // Update MeetingInsights with analysis results
    await base44.asServiceRole.entities.MeetingInsights.update(insightsId, {
      ...consolidatedData,
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
        details: `Análisis completado con modelos: ${models_to_run.join(', ')}`,
        timestamp: new Date().toISOString(),
      });
    }

    return Response.json({
      success: true,
      insightsId,
      analysis: consolidatedData,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function runModel(modelKey, transcriptText) {
  const modelConfig = GPT_MODELS[modelKey];

  if (modelKey === 'pakito_mckensey') {
    return runStrategicAnalysis(modelConfig, transcriptText);
  } else if (modelKey === 'copywriter_data_goal') {
    return runCopywritingAnalysis(modelConfig, transcriptText);
  }
}

async function runStrategicAnalysis(modelConfig, transcriptText) {
  const analysisPrompt = `
Analiza la siguiente transcripción de reunión empresarial y extrae:

1. **RIESGOS**: Identifica 3-5 riesgos clave mencionados o implícitos. Para cada uno:
   - Título conciso
   - Descripción detallada
   - Severidad (low, medium, high, critical)
   - Estrategia de mitigación

2. **OPORTUNIDADES**: Identifica 3-5 oportunidades estratégicas. Para cada una:
   - Título conciso
   - Descripción detallada
   - Impacto potencial (low, medium, high)
   - Próximos pasos recomendados

3. **RECOMENDACIONES ESTRATÉGICAS**: Proporciona 3-5 recomendaciones accionables:
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

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [
      {
        role: 'system',
        content: modelConfig.system_prompt,
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
        name: 'strategic_analysis',
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

  return JSON.parse(response.choices[0].message.content);
}

async function runCopywritingAnalysis(modelConfig, transcriptText) {
  const copyPrompt = `
Basado en la siguiente transcripción de reunión/documento, genera:

1. **SALES COPY**: Crea un copy persuasivo de venta (200-300 palabras) que destaque los puntos clave, beneficios y propuesta de valor.

2. **ARTÍCULOS**: Genera 2-3 ideas de títulos y descripciones breves para artículos de blog/marketing basados en los temas tratados.

Cada artículo debe tener:
- Título atractivo
- Descripción breve (100-150 palabras)
- Palabras clave principales

TRANSCRIPCIÓN:
${transcriptText}

Responde en JSON válido.
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [
      {
        role: 'system',
        content: modelConfig.system_prompt,
      },
      {
        role: 'user',
        content: copyPrompt,
      },
    ],
    temperature: 0.8,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'copywriting_output',
        schema: {
          type: 'object',
          properties: {
            sales_copy: { type: 'string' },
            articles: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  keywords: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
          required: ['sales_copy', 'articles'],
        },
      },
    },
  });

  return JSON.parse(response.choices[0].message.content);
}