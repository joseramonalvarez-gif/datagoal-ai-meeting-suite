import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { 
      meeting_id, 
      transcript_id, 
      analysis, 
      template_type = 'executive_summary' 
    } = await req.json();

    if (!meeting_id || !analysis) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Obtener datos de la reunión
    const meeting = await base44.asServiceRole.entities.Meeting.filter({ id: meeting_id });
    const meetingData = meeting?.[0] || {};

    // Template markdown (versión simplificada)
    const templates = {
      executive_summary: `# Informe Ejecutivo: {{MEETING_TITLE}}

**Fecha:** {{DATE}}
**Cliente:** {{CLIENT_NAME}}
**Proyecto:** {{PROJECT_NAME}}

## Resumen

${analysis.resumen_ejecutivo || 'Resumen no disponible'}

## Decisiones Tomadas ({{DECISION_COUNT}})

${(analysis.decisiones || [])
  .map(d => `- **${d.descripción}** (Vencimiento: ${d.fecha_vencimiento || 'N/A'}, Responsable: ${d.responsable || 'TBD'})`)
  .join('\n')}

## Riesgos Identificados ({{RISK_COUNT}})

${(analysis.riesgos || [])
  .map(r => `- **${r.título}** (Severidad: ${r.severidad}) - ${r.descripción}\n  *Mitigación:* ${r.mitigación}`)
  .join('\n')}

## Oportunidades ({{OPPORTUNITY_COUNT}})

${(analysis.oportunidades || [])
  .map(o => `- **${o.título}** (Impacto: ${o.impacto}) - ${o.descripción}`)
  .join('\n')}

## Acciones Pendientes ({{ACTION_COUNT}})

${(analysis.action_items || [])
  .map(a => `- [ ] **${a.título}** - Responsable: ${a.owner || 'TBD'} | Vencimiento: ${a.due_date || 'TBD'}`)
  .join('\n')}

## Sentimiento General

${analysis.sentiment === 'positivo' ? '✅ Positivo' : analysis.sentiment === 'negativo' ? '⚠️ Negativo' : '⏸️ Neutral'}

---
*Generado automáticamente por Data Goal*`,

      technical_review: `# Revisión Técnica: {{MEETING_TITLE}}

**Fecha:** {{DATE}}

## Resumen Técnico
${analysis.resumen_ejecutivo || ''}

## Decisiones Técnicas
${(analysis.decisiones || []).map(d => `- ${d.descripción}`).join('\n')}

## Riesgos Técnicos
${(analysis.riesgos || []).map(r => `- **${r.título}** (${r.severidad}): ${r.descripción}`).join('\n')}

## Acciones Requeridas
${(analysis.action_items || []).map(a => `- ${a.título} (Owner: ${a.owner})`).join('\n')}`,
    };

    let markdownContent = templates[template_type] || templates.executive_summary;

    // Reemplazar variables
    markdownContent = markdownContent
      .replace('{{MEETING_TITLE}}', meetingData.title || 'Sin título')
      .replace('{{DATE}}', new Date().toLocaleDateString('es-ES'))
      .replace('{{CLIENT_NAME}}', meetingData.client_id || 'N/A')
      .replace('{{PROJECT_NAME}}', meetingData.project_id || 'N/A')
      .replace('{{DECISION_COUNT}}', analysis.decisiones?.length || 0)
      .replace('{{RISK_COUNT}}', analysis.riesgos?.length || 0)
      .replace('{{OPPORTUNITY_COUNT}}', analysis.oportunidades?.length || 0)
      .replace('{{ACTION_COUNT}}', analysis.action_items?.length || 0);

    // Convertir markdown a HTML básico
    const htmlContent = markdownToHtml(markdownContent);

    return Response.json({
      success: true,
      markdown: markdownContent,
      html: htmlContent,
      title: meetingData.title || 'Informe de Reunión',
      client_id: meetingData.client_id,
      project_id: meetingData.project_id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function markdownToHtml(markdown) {
  let html = markdown
    .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
    .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
    .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^\- (.*?)$/gm, '<li>$1</li>')
    .replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n/g, '<br>');
  return html;
}