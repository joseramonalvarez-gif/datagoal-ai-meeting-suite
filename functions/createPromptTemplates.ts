import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Run once to initialize default prompt templates
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin check
    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const prompts = [
      {
        name: 'Informe Kickoff v1',
        prompt_type: 'report_generation',
        content: `Eres un consultor estratégico senior de Data Goal. Tu tarea es generar un informe profesional y ejecutivo basado en una transcripción de reunión de kickoff.

**CONTEXTO:**
- Reunión: {{meeting_title}}
- Objetivo: {{meeting_objective}}
- Participantes: {{participant_names}}
- Cliente: {{client_name}}
- Proyecto: {{project_name}}

**TRANSCRIPCIÓN:**
{{transcript_full_text}}

**INSTRUCCIONES CRÍTICAS:**

1. **Basate ÚNICAMENTE en la transcripción.** Si algo no está mencionado, NO lo incluyas.

2. **Estructura del informe:**
   - Resumen Ejecutivo (3-5 líneas)
   - Contexto y Objetivo del Proyecto
   - Alcance Confirmado
   - Temas Clave Discutidos
   - Decisiones y Compromisos
   - Riesgos Identificados
   - Próximos Pasos

3. **Tono:** Formal, ejecutivo, preciso.

4. **Formato:** Markdown.

5. **Incluye nombres y fechas específicas.**

6. **No inventes información. Si hay ambigüedad, decláralo.**`,
        system_message: 'Eres un consultor estratégico experto en generar informes ejecutivos concisos y basados en datos.',
        model: 'gpt-4-turbo',
        temperature: 0.6,
        max_tokens: 3000,
        version: 1,
        status: 'active',
        is_default: true,
        created_by: user.email
      },
      {
        name: 'Extracción de Tareas v1',
        prompt_type: 'task_extraction',
        content: `Extrae TODAS las tareas, acciones y compromisos mencionados en esta transcripción.

**TRANSCRIPCIÓN:**
{{transcript_text}}

**PARA CADA TAREA, EXTRAE:**
- Título (breve, accionable)
- Descripción (contexto)
- Asignado a (nombre/email si se menciona)
- Fecha vencimiento (YYYY-MM-DD, o estimada +7 días si no está clara)
- Prioridad (low|medium|high)

**INCLUYE:** Acciones explícitas, compromisos, entregas, aclaraciones pendientes.

**EXCLUYE:** Contexto histórico, tareas completadas, especulaciones sin consenso.

**RETORNA SOLO JSON ARRAY:**
[{"title": "...", "description": "...", "assigned_to": "...", "due_date": "2026-03-07", "priority": "high"}]

Si no hay tareas, retorna: []`,
        system_message: 'Extrae tareas de forma meticulosa. Sé exhaustivo pero preciso. Solo JSON array.',
        model: 'gpt-4-turbo',
        temperature: 0.2,
        max_tokens: 2000,
        version: 1,
        status: 'active',
        is_default: true,
        created_by: user.email
      },
      {
        name: 'Email Seguimiento v1',
        prompt_type: 'email_generation',
        content: `Genera un email profesional de seguimiento post-reunión.

**CONTEXTO:**
- Reunión: {{meeting_title}}
- Fecha: {{meeting_date}}
- Participantes: {{participant_names}}
- Consultor: {{consultant_name}}

**INFORME RESUMEN:**
{{report_summary}}

**TAREAS:**
{{tasks_summary}}

**INSTRUCCIONES:**
1. Estructura: Saludo → Resumen (2-3 líneas) → Tareas (bullets) → Próximos pasos → Firma
2. Tono: Profesional, cordial, claro
3. Largo: máximo 250 palabras
4. Incluye: Link al informe, invitación a contactar, fecha próxima reunión si aplica
5. Formato: HTML listo para email

**GENERA SOLO EL EMAIL, SIN EXPLICACIONES:**`,
        system_message: 'Eres un redactor experto en emails profesionales post-reunión. Sé conciso y claro.',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: 1500,
        version: 1,
        status: 'active',
        is_default: true,
        created_by: user.email
      }
    ];

    const created = [];
    for (const prompt of prompts) {
      const existing = await base44.entities.PromptTemplate.filter({ name: prompt.name }, 'version', 1);
      if (existing.length === 0) {
        const newPrompt = await base44.entities.PromptTemplate.create(prompt);
        created.push(newPrompt.id);
      }
    }

    return Response.json({
      success: true,
      message: `${created.length} prompt templates created or already exist`,
      created_ids: created
    });

  } catch (error) {
    console.error('Prompt initialization error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});