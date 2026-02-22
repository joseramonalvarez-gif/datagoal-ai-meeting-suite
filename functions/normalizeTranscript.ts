import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { transcript_id } = await req.json();

    if (!transcript_id) {
      return Response.json({ error: 'transcript_id requerido' }, { status: 400 });
    }

    const transcripts = await base44.entities.Transcript.filter({ id: transcript_id });
    const transcript = transcripts[0];

    if (!transcript) {
      return Response.json({ error: 'Transcript no encontrado' }, { status: 404 });
    }

    const text = transcript.full_text || '';
    if (text.length < 50) {
      return Response.json({
        error: 'Transcript demasiado corto para normalizar',
        skipped: true
      }, { status: 422 });
    }

    // Obtener prompt template activo
    const templates = await base44.entities.PromptTemplate.filter({
      prompt_type: 'task_extraction',
      status: 'active',
      is_default: true
    });
    const template = templates[0];

    // Obtener meeting para contexto
    const meetings = await base44.entities.Meeting.filter({ id: transcript.meeting_id });
    const meeting = meetings[0] || {};

    const clients = meeting.client_id
      ? await base44.entities.Client.filter({ id: meeting.client_id })
      : [];
    const client = clients[0];

    const projects = meeting.project_id
      ? await base44.entities.Project.filter({ id: meeting.project_id })
      : [];
    const project = projects[0];

    const prompt = template
      ? template.content
          .replace('{{client_name}}', client?.name || 'Cliente')
          .replace('{{project_name}}', project?.name || 'Proyecto')
          .replace('{{meeting_date}}', meeting.date ? new Date(meeting.date).toLocaleDateString('es-ES') : 'N/A')
          .replace('{{transcript_text}}', text.substring(0, 8000))
      : `Analiza este transcript y extrae: decisions, risks, actions, key_topics, sentiment, summary_one_line. Formato JSON.\n\n${text.substring(0, 8000)}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          decisions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                owner: { type: 'string' },
                impact: { type: 'string' }
              }
            }
          },
          risks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                severity: { type: 'string' },
                mitigation: { type: 'string' }
              }
            }
          },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                owner: { type: 'string' },
                due_date: { type: 'string' },
                priority: { type: 'string' }
              }
            }
          },
          key_topics: { type: 'array', items: { type: 'string' } },
          sentiment: { type: 'string' },
          summary_one_line: { type: 'string' }
        }
      }
    });

    // Guardar insights normalizados
    await base44.entities.Transcript.update(transcript_id, {
      extracted_insights: result,
      normalized_status: 'completed'
    });

    // Actualizar usage count del template
    if (template) {
      await base44.entities.PromptTemplate.update(template.id, {
        usage_count: (template.usage_count || 0) + 1
      });
    }

    return Response.json({
      success: true,
      transcript_id,
      insights: result
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});