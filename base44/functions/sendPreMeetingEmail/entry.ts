import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { meeting_id } = await req.json();

    if (!meeting_id) {
      return Response.json({ error: 'Missing meeting_id' }, { status: 400 });
    }

    const meetings = await base44.asServiceRole.entities.Meeting.filter({ id: meeting_id });
    if (!meetings || meetings.length === 0) {
      return Response.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const meeting = meetings[0];
    const clients = await base44.asServiceRole.entities.Client.filter({ id: meeting.client_id });
    const client = clients?.[0];

    // Build participant list
    const participantsList = meeting.participants
      ? meeting.participants.map(p => `- ${p.name} (${p.email})`).join('\n')
      : 'No participants specified';

    const meetingDate = new Date(meeting.date).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const emailBody = `Estimados,

Les confirmamos la próxima reunión:

**${meeting.title}**

📅 **Fecha y Hora:** ${meetingDate}
🏢 **Cliente:** ${client?.name || 'N/A'}
📋 **Objetivo:** ${meeting.objective || 'Por definir'}

**Participantes:**
${participantsList}

**Preparación:**
- Por favor, revisar los documentos adjuntos con anticipación
- Preparar sus comentarios y preguntas
- Asegurar una conexión estable para la videollamada

Esperamos su participación.

Saludos cordiales,
Data Goal Team`;

    const emailObject = {
      to: meeting.participants?.map(p => p.email).join(',') || meeting.organizer_email,
      subject: `Confirmación: ${meeting.title} - ${meetingDate}`,
      body: emailBody
    };

    await base44.integrations.Core.SendEmail(emailObject);

    return Response.json({ 
      success: true,
      message: 'Pre-meeting email sent',
      recipients: emailObject.to
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});