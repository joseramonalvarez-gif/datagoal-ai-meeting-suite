import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { report_id, approvers_emails } = await req.json();

    if (!report_id || !approvers_emails || approvers_emails.length === 0) {
      return Response.json({ error: 'Missing report_id or approvers_emails' }, { status: 400 });
    }

    const reports = await base44.asServiceRole.entities.Report.filter({ id: report_id });
    if (!reports || reports.length === 0) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }

    const report = reports[0];
    const meeting = await base44.asServiceRole.entities.Meeting.filter({ id: report.meeting_id });
    const client = await base44.asServiceRole.entities.Client.filter({ id: report.client_id });

    const emailBody = `Estimado Revisor,

Se requiere tu aprobación para el siguiente informe:

**${report.title}**

🏢 **Cliente:** ${client?.[0]?.name || 'N/A'}
📅 **Reunión:** ${meeting?.[0]?.title || 'N/A'}
📋 **Versión:** ${report.version}
📊 **Calidad:** ${report.quality_score ? (report.quality_score * 100).toFixed(0) + '%' : 'No calculada'}

Por favor, accede a la plataforma para:
1. Revisar el contenido del informe
2. Agregar comentarios si es necesario
3. Aprobar o rechazar la entrega

Una vez aprobado, será enviado automáticamente al cliente.

Saludos cordiales,
Data Goal Team`;

    const emailObject = {
      to: approvers_emails.join(','),
      subject: `Aprobación Requerida: ${report.title}`,
      body: emailBody
    };

    await base44.integrations.Core.SendEmail(emailObject);

    return Response.json({ 
      success: true,
      message: 'Report approval email sent',
      recipients: approvers_emails
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});