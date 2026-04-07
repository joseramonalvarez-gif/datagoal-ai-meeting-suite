import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { event, data } = await req.json();
    const task = data;

    if (!task) {
      return Response.json({ error: 'No task data provided' }, { status: 400 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('gmail');

    // Collect recipients
    const recipients = new Set();
    
    // Add assignees
    if (task.assignees && Array.isArray(task.assignees)) {
      task.assignees.forEach(a => {
        if (a.email) recipients.add(a.email);
      });
    }
    
    // Add watchers
    if (task.watchers && Array.isArray(task.watchers)) {
      task.watchers.forEach(w => {
        if (w) recipients.add(w);
      });
    }

    if (recipients.size === 0) {
      return Response.json({ success: true, message: 'No recipients to notify' });
    }

    // Build email content
    const eventLabel = event?.type === 'create' ? 'Nueva tarea creada' : 'Tarea actualizada';
    const statusLabel = task.status || 'sin estado';
    const priorityLabel = task.priority || 'media';
    
    const emailSubject = `[TASK] ${eventLabel}: ${task.title}`;
    const emailBody = buildEmailHtml(task, eventLabel);

    // Send to each recipient via Gmail API
    const sentTo = [];
    for (const recipientEmail of recipients) {
      try {
        const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            raw: encodeMessage(emailSubject, emailBody, recipientEmail),
          }),
        });

        if (response.ok) {
          sentTo.push(recipientEmail);
        } else {
          console.error(`Failed to send to ${recipientEmail}:`, await response.text());
        }
      } catch (error) {
        console.error(`Error sending to ${recipientEmail}:`, error.message);
      }
    }

    // Log audit trail
    if (task.client_id && task.project_id) {
      await base44.asServiceRole.entities.AuditLog.create({
        client_id: task.client_id,
        project_id: task.project_id,
        user_email: user.email,
        action: 'task_notification_sent',
        entity_type: 'Task',
        entity_id: task.id,
        details: `Notificación enviada a: ${sentTo.join(', ')}`,
        timestamp: new Date().toISOString(),
      });
    }

    return Response.json({
      success: true,
      sentTo,
      message: `Email sent to ${sentTo.length} recipient(s)`,
    });
  } catch (error) {
    console.error('Task notification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function encodeMessage(subject, html, to) {
  const message = `From: noreply@datagoal.app\r\nTo: ${to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}`;
  return btoa(message).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function buildEmailHtml(task, eventLabel) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'IBM Plex Sans', sans-serif; background-color: #FFFAF3; color: #1B2731; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: white; border-radius: 8px; border: 1px solid #B7CAC9; }
    .header { border-bottom: 3px solid #33A19A; padding-bottom: 15px; margin-bottom: 20px; }
    .header h1 { margin: 0; color: #33A19A; font-size: 20px; }
    .event-label { background: #E8F5F4; color: #33A19A; padding: 8px 12px; border-radius: 4px; display: inline-block; font-size: 12px; font-weight: 600; margin-bottom: 15px; }
    .field { margin-bottom: 15px; }
    .field-label { font-size: 12px; color: #B7CAC9; text-transform: uppercase; font-weight: 600; }
    .field-value { font-size: 14px; color: #1B2731; margin-top: 4px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-right: 8px; }
    .status-todo { background: #FEF3C7; color: #92400E; }
    .status-in_progress { background: #DBEAFE; color: #1E40AF; }
    .status-done { background: #D1FAE5; color: #065F46; }
    .priority-low { background: #E0E7FF; color: #312E81; }
    .priority-medium { background: #FED7AA; color: #92400E; }
    .priority-high { background: #FBCFE8; color: #9D174D; }
    .priority-urgent { background: #FECACA; color: #7F1D1D; }
    .footer { border-top: 1px solid #B7CAC9; padding-top: 15px; margin-top: 20px; font-size: 12px; color: #B7CAC9; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 ${eventLabel}</h1>
    </div>

    <div class="event-label">${eventLabel}</div>

    <div class="field">
      <div class="field-label">Título</div>
      <div class="field-value" style="font-weight: 600; font-size: 16px;">${task.title || '—'}</div>
    </div>

    ${task.description ? `
    <div class="field">
      <div class="field-label">Descripción</div>
      <div class="field-value">${task.description}</div>
    </div>
    ` : ''}

    <div class="field">
      <div class="field-label">Estado</div>
      <div class="field-value">
        <span class="badge status-${task.status || 'todo'}">${formatStatus(task.status)}</span>
      </div>
    </div>

    <div class="field">
      <div class="field-label">Prioridad</div>
      <div class="field-value">
        <span class="badge priority-${task.priority || 'medium'}">${formatPriority(task.priority)}</span>
      </div>
    </div>

    ${task.due_date ? `
    <div class="field">
      <div class="field-label">Fecha límite</div>
      <div class="field-value">${new Date(task.due_date).toLocaleDateString('es-ES')}</div>
    </div>
    ` : ''}

    ${task.assignees && task.assignees.length > 0 ? `
    <div class="field">
      <div class="field-label">Asignados a</div>
      <div class="field-value">${task.assignees.map(a => a.name || a.email).join(', ')}</div>
    </div>
    ` : ''}

    <div class="footer">
      <p>Notificación automática de DATA GOAL • No responder a este email</p>
    </div>
  </div>
</body>
</html>
  `;
}

function formatStatus(status) {
  const map = {
    'backlog': 'Backlog',
    'todo': 'Por hacer',
    'in_progress': 'En progreso',
    'blocked': 'Bloqueado',
    'in_review': 'En revisión',
    'done': 'Hecho',
  };
  return map[status] || status;
}

function formatPriority(priority) {
  const map = {
    'low': 'Baja',
    'medium': 'Media',
    'high': 'Alta',
    'urgent': 'Urgente',
  };
  return map[priority] || priority;
}