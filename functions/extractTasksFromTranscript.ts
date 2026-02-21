import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Extract tasks from meeting transcript using LLM
 * Creates Task entities with evidence segments
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { meeting_id } = await req.json();

    if (!meeting_id) {
      return Response.json({ error: 'meeting_id required' }, { status: 400 });
    }

    console.log(`[extractTasksFromTranscript] Processing meeting ${meeting_id}`);

    const meeting = await base44.entities.Meeting.get(meeting_id);
    if (!meeting) {
      return Response.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const transcripts = await base44.entities.Transcript.filter({
      meeting_id: meeting_id
    }, '-created_date', 1);

    if (!transcripts.length) {
      return Response.json({
        error: 'No transcript found',
        meeting_id,
        tasks_created: 0
      }, { status: 400 });
    }

    const transcript = transcripts[0];
    const fullText = transcript.full_text || '';

    // Get prompt template for task extraction
    const templates = await base44.entities.PromptTemplate.filter({
      prompt_type: 'task_extraction'
    }, '-created_date', 1);

    let extractPrompt = templates.length > 0 ? templates[0].content : 
      `Analiza esta transcripción y extrae todas las tareas, acciones y compromisos mencionados.

Transcripción:
{{transcript}}

Para cada tarea, devuelve JSON con:
{
  "tasks": [
    {
      "title": "título breve",
      "description": "descripción detallada",
      "priority": "high|medium|low",
      "assignee_name": "nombre si se menciona",
      "due_days": número de días desde ahora,
      "evidence_quote": "texto de la transcripción que evidencia esta tarea"
    }
  ]
}`;

    // Replace placeholder
    extractPrompt = extractPrompt.replace('{{transcript}}', fullText.substring(0, 8000));

    // Call LLM
    const llmRes = await base44.integrations.Core.InvokeLLM({
      prompt: extractPrompt,
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
                priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                assignee_name: { type: 'string' },
                due_days: { type: 'number' },
                evidence_quote: { type: 'string' }
              }
            }
          }
        }
      }
    });

    console.log(`[extractTasksFromTranscript] Extracted ${llmRes.tasks?.length || 0} tasks`);

    const createdTasks = [];

    for (const taskData of llmRes.tasks || []) {
      // Find assignee
      let assignee = null;
      if (taskData.assignee_name) {
        const participants = meeting.participants || [];
        assignee = participants.find(p => 
          p.name?.toLowerCase().includes(taskData.assignee_name.toLowerCase())
        );
      }

      // Calculate due date
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (taskData.due_days || 7));

      // Create task
      const task = await base44.entities.Task.create({
        client_id: meeting.client_id,
        project_id: meeting.project_id,
        meeting_id: meeting_id,
        transcript_id: transcript.id,
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority || 'medium',
        status: 'todo',
        assignees: assignee ? [{ email: assignee.email, name: assignee.name }] : [],
        assignee_email: assignee?.email,
        assignee_name: assignee?.name,
        due_date: dueDate.toISOString().split('T')[0],
        evidence_segments: taskData.evidence_quote ? [
          {
            text_fragment: taskData.evidence_quote,
            source_type: 'transcript_extraction'
          }
        ] : []
      });

      createdTasks.push({
        id: task.id,
        title: task.title,
        assignee: assignee?.email || 'Sin asignar',
        priority: task.priority
      });
    }

    // Create notification
    if (createdTasks.length > 0) {
      await base44.entities.Notification.create({
        user_email: user.email,
        title: '✅ Tareas extraídas',
        message: `Se extrajeron ${createdTasks.length} tareas de la reunión ${meeting.title}`,
        type: 'task_extraction',
        is_read: false,
        related_entity_id: meeting_id
      });
    }

    return Response.json({
      success: true,
      meeting_id,
      tasks_created: createdTasks.length,
      tasks: createdTasks
    });

  } catch (error) {
    console.error('[extractTasksFromTranscript] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});