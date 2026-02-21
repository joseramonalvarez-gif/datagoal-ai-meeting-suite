import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { 
      to_emails, 
      cc_emails = [],
      title, 
      share_link, 
      analysis, 
      sender_name = 'Data Goal' 
    } = await req.json();

    if (!to_emails || to_emails.length === 0 || !title) {
      return Response.json({ error: 'Missing to_emails or title' }, { status: 400 });
    }

    const user = await base44.auth.me();

    // Construir email HTML
    const emailHtml = `
<html>
  <body style="font-family: Arial, sans-serif; color: #333;">
    <h2>${title}</h2>
    
    <p>Estimados,</p>
    
    <p>Se adjunta el informe de la reunión del ${new Date().toLocaleDateString('es-ES')}.</p>
    
    <h3>📊 Resumen Ejecutivo</h3>
    <ul>
      <li><strong>Sentimiento:</strong> ${analysis.sentiment === 'positivo' ? '✅ Positivo' : '⚠️ ' + analysis.sentiment}</li>
      <li><strong>Decisiones:</strong> ${analysis.decisiones?.length || 0}</li>
      <li><strong>Riesgos:</strong> ${analysis.riesgos?.length || 0}</li>
      <li><strong>Acciones Pendientes:</strong> ${analysis.action_items?.length || 0}</li>
    </ul>
    
    <h3>👉 Acceso al Documento</h3>
    <p><a href="${share_link}" style="background-color: #33A19A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Documento</a></p>
    
    <p style="margin-top: 30px; color: #999; font-size: 12px;">
      Generado automáticamente por Data Goal<br>
      ${user?.email || 'Sistema'}
    </p>
  </body>
</html>`;

    // Enviar email vía Gmail connector
    const emailResult = await base44.integrations.Core.SendEmail({
      to: to_emails.join(','),
      subject: `[Data Goal] Informe Reunión - ${title}`,
      body: emailHtml,
      from_name: sender_name,
    });

    return Response.json({
      success: true,
      sent_to: to_emails,
      cc: cc_emails,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});