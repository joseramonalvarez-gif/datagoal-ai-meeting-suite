import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Para automaciones, creamos cliente sin request
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    // Buscar archivos recientes en carpeta de transcripciones
    const query = `name contains "transcript" and mimeType = "text/plain" and modifiedTime > "${new Date(Date.now() - 30 * 60000).toISOString()}"`;
    
    const filesRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=drive&pageSize=10`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!filesRes.ok) {
      throw new Error('Failed to query Google Drive');
    }

    const filesData = await filesRes.json();
    const files = filesData.files || [];

    const imported = [];

    for (const file of files) {
      try {
        // Descargar contenido
        const contentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!contentRes.ok) continue;

        const content = await contentRes.text();

        // Extraer meeting_id del nombre de archivo o metadata
        const meetingMatch = file.name.match(/meeting[_-]?(\w+)/i);
        const meetingId = meetingMatch?.[1] || file.name.split('_')[0];

        // Buscar meeting
        const meeting = await base44.asServiceRole.entities.Meeting.filter({ id: meetingId });
        if (!meeting || meeting.length === 0) continue;

        const meetingData = meeting[0];

        // Crear Transcript
        const transcript = await base44.asServiceRole.entities.Transcript.create({
          meeting_id: meetingId,
          client_id: meetingData.client_id,
          project_id: meetingData.project_id,
          version: 1,
          status: 'completed',
          full_text: content,
          source: 'google_meet',
        });

        // Log importación
        await base44.asServiceRole.entities.TranscriptImportLog.create({
          source: 'google_meet',
          source_file_url: `https://drive.google.com/file/d/${file.id}`,
          meeting_id: meetingId,
          transcript_id: transcript.id,
          import_status: 'success',
          has_timestamps: false,
        });

        // Auto-trigger análisis IA
        try {
          await base44.asServiceRole.functions.invoke('analyzeMeetingWithGPT', {
            transcript_id: transcript.id,
            full_text: content,
          });
        } catch (err) {
          console.error('Analysis failed:', err.message);
        }

        imported.push({ meeting_id: meetingId, transcript_id: transcript.id });
      } catch (err) {
        console.error(`Failed to import ${file.name}:`, err.message);
      }
    }

    return Response.json({
      success: true,
      imported_count: imported.length,
      imported: imported,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});