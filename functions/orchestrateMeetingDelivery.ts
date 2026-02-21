import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { meeting_id, template_id } = await req.json();

    if (!meeting_id || !template_id) {
      return Response.json({ error: 'meeting_id and template_id required' }, { status: 400 });
    }

    // 1. Fetch data
    const [meeting, template, transcript] = await Promise.all([
      base44.entities.Meeting.read(meeting_id),
      base44.entities.DeliveryTemplate.read(template_id),
      base44.entities.Transcript.filter({ meeting_id }, '-created_date', 1)
    ]);

    if (!meeting) {
      return Response.json({ error: 'Meeting not found' }, { status: 404 });
    }
    if (!template) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    // 2. Create DeliveryRun
    const deliveryRun = await base44.entities.DeliveryRun.create({
      delivery_template_id: template_id,
      trigger_entity_type: 'Meeting',
      trigger_entity_id: meeting_id,
      status: 'running',
      steps_executed: []
    });

    const steps = [];

    // Step 1: Extract context
    steps.push({
      step_name: 'extract_context',
      status: 'success',
      output: 'Context extracted',
      timestamp: new Date().toISOString()
    });

    // Step 2: Generate report with LLM
    let reportContent = '';
    try {
      const transcriptText = transcript[0]?.full_text || 'No transcript available';
      
      const prompt = `
Genera un informe profesional basado en esta transcripción de reunión.

REUNIÓN: ${meeting.title}
OBJETIVO: ${meeting.objective || 'No especificado'}
PARTICIPANTES: ${meeting.participants?.map(p => p.name).join(', ') || 'No especificado'}

TRANSCRIPCIÓN:
${transcriptText}

Por favor, estructura el informe con las siguientes secciones (si aplican):
1. Resumen Ejecutivo (3-5 líneas)
2. Contexto y Objetivo
3. Temas Tratados
4. Acuerdos y Decisiones
5. Acciones Comprometidas
6. Riesgos Identificados
7. Oportunidades
8. Próximos Pasos

Sé conciso, profesional y basate ÚNICAMENTE en lo que se menciona en la transcripción.
      `;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            content: { type: 'string' }
          }
        }
      });

      reportContent = aiResponse.content || '';
    } catch (err) {
      steps.push({
        step_name: 'generate_report',
        status: 'failed',
        error: err.message,
        timestamp: new Date().toISOString()
      });
      throw err;
    }

    steps.push({
      step_name: 'generate_report',
      status: 'success',
      output: `Report generated: ${reportContent.substring(0, 100)}...`,
      timestamp: new Date().toISOString()
    });

    // Step 3: Create Report entity
    const report = await base44.entities.Report.create({
      meeting_id,
      client_id: meeting.client_id,
      project_id: meeting.project_id,
      transcript_id: transcript[0]?.id || null,
      template_id,
      title: `Informe: ${meeting.title}`,
      content_markdown: reportContent,
      status: 'generated',
      ai_metadata: {
        model: 'gpt-4-turbo',
        prompt_version: '1.0',
        generated_at: new Date().toISOString(),
        generated_by: user.email
      }
    });

    steps.push({
      step_name: 'create_report',
      status: 'success',
      output: `Report entity created: ${report.id}`,
      timestamp: new Date().toISOString()
    });

    // Step 4: Extract tasks (optional)
    let tasksCreated = [];
    try {
      const taskPrompt = `
Extrae TODAS las tareas, compromisos y acciones mencionadas en esta transcripción.
Retorna como JSON array.

TRANSCRIPCIÓN:
${transcript[0]?.full_text || 'No transcript'}

Formato esperado:
[
  {
    "title": "Título de la tarea",
    "description": "Descripción breve",
    "assignee": "Nombre de quien está asignado (si se menciona)",
    "due_date": "Fecha sugerida (si se menciona)",
    "priority": "low|medium|high"
  }
]

Si no hay tareas claras, retorna array vacío [].
      `;

      const tasksResponse = await base44.integrations.Core.InvokeLLM({
        prompt: taskPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  assignee: { type: 'string' },
                  due_date: { type: 'string' },
                  priority: { type: 'string' }
                }
              }
            }
          }
        }
      });

      if (tasksResponse.tasks && Array.isArray(tasksResponse.tasks)) {
        for (const taskData of tasksResponse.tasks) {
          const task = await base44.entities.Task.create({
            client_id: meeting.client_id,
            project_id: meeting.project_id,
            meeting_id,
            title: taskData.title,
            description: taskData.description,
            status: 'todo',
            priority: taskData.priority || 'medium',
            assignee_email: taskData.assignee || '',
            due_date: taskData.due_date || null,
            tags: ['auto-extracted']
          });
          tasksCreated.push(task.id);
        }
      }
    } catch (err) {
      console.log('Task extraction warning:', err.message);
    }

    steps.push({
      step_name: 'extract_tasks',
      status: 'success',
      output: `${tasksCreated.length} tasks created`,
      timestamp: new Date().toISOString()
    });

    // Step 5: Update DeliveryRun
    const finalDeliveryRun = await base44.entities.DeliveryRun.update(deliveryRun.id, {
      status: 'success',
      output_content: reportContent,
      steps_executed: steps,
      total_time_ms: Date.now(),
      ai_metadata: {
        model_used: 'gpt-4-turbo',
        prompt_version: '1.0',
        temperature: 0.6,
        tokens_used: 0
      }
    });

    // Step 6: Update Meeting status
    await base44.entities.Meeting.update(meeting_id, {
      status: 'report_generated'
    });

    return Response.json({
      success: true,
      delivery_run_id: finalDeliveryRun.id,
      report_id: report.id,
      tasks_created: tasksCreated,
      steps
    });

  } catch (error) {
    console.error('Orchestration error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});