import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { meeting_id, transcript_id, delivery_template_id } = await req.json();

    if (!meeting_id) {
      return Response.json({ error: 'meeting_id requerido' }, { status: 400 });
    }

    // Cargar datos necesarios en paralelo
    const [meetings, transcripts, templates] = await Promise.all([
      base44.entities.Meeting.filter({ id: meeting_id }),
      transcript_id
        ? base44.entities.Transcript.filter({ id: transcript_id })
        : base44.entities.Transcript.filter({ meeting_id }),
      delivery_template_id
        ? base44.entities.DeliveryTemplate.filter({ id: delivery_template_id })
        : base44.entities.DeliveryTemplate.filter({ is_default: true, delivery_type: 'informe', is_active: true })
    ]);

    const meeting = meetings[0];
    if (!meeting) return Response.json({ error: 'Meeting no encontrado' }, { status: 404 });

    const transcript = transcripts[0];
    if (!transcript) return Response.json({ error: 'Transcript no encontrado' }, { status: 404 });

    const template = templates[0];
    if (!template) return Response.json({ error: 'DeliveryTemplate no encontrado' }, { status: 404 });

    // Cargar client, project y prompt template
    const [clients, projects, promptTemplates] = await Promise.all([
      meeting.client_id ? base44.entities.Client.filter({ id: meeting.client_id }) : [],
      meeting.project_id ? base44.entities.Project.filter({ id: meeting.project_id }) : [],
      base44.entities.PromptTemplate.filter({
        prompt_type: 'report_generation',
        status: 'active',
        is_default: true
      })
    ]);

    const client = clients[0] || {};
    const project = projects[0] || {};
    const promptTemplate = promptTemplates[0];

    // Preparar contexto
    const insights = transcript.extracted_insights || {};
    const participants = (meeting.participants || []).map(p => p.name || p.email).join(', ') || 'No especificados';
    const decisions = JSON.stringify(insights.decisions || []);
    const risks = JSON.stringify(insights.risks || []);
    const actions = JSON.stringify(insights.actions || []);
    const keyTopics = (insights.key_topics || []).join(', ');
    const meetingDate = meeting.date ? new Date(meeting.date).toLocaleDateString('es-ES') : 'No especificada';

    const prompt = promptTemplate
      ? promptTemplate.content
          .replace('{{client_name}}', client.name || 'Cliente')
          .replace('{{project_name}}', project.name || 'Proyecto')
          .replace('{{meeting_date}}', meetingDate)
          .replace('{{meeting_objective}}', meeting.objective || meeting.title || 'No especificado')
          .replace('{{participants}}', participants)
          .replace('{{decisions}}', decisions)
          .replace('{{risks}}', risks)
          .replace('{{actions}}', actions)
          .replace('{{key_topics}}', keyTopics)
          .replace('{{tone}}', template.tone || 'ejecutivo')
      : `Genera un informe ejecutivo post-reunión de "${meeting.title}" para el cliente ${client.name}. 
         Basado en estas decisiones: ${decisions}. 
         Acciones: ${actions}. 
         Formato markdown con: Resumen Ejecutivo, Decisiones, Plan de Acción, Riesgos, Próximos Pasos.`;

    const content = await base44.integrations.Core.InvokeLLM({
      prompt
    });

    if (!content || content.length < 100) {
      return Response.json({ error: 'El LLM no generó contenido suficiente' }, { status: 500 });
    }

    // Actualizar usage count
    if (promptTemplate) {
      await base44.entities.PromptTemplate.update(promptTemplate.id, {
        usage_count: (promptTemplate.usage_count || 0) + 1
      });
    }
    await base44.entities.DeliveryTemplate.update(template.id, {
      usage_count: (template.usage_count || 0) + 1
    });

    return Response.json({
      success: true,
      content_markdown: content,
      meeting_id,
      template_used: template.name,
      word_count: content.split(' ').length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});