import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { file_url, file_format, meeting_id } = await req.json();

    if (!file_url || !file_format) {
      return Response.json({ error: 'Missing file_url or file_format' }, { status: 400 });
    }

    let parsedText = '';
    let speakers = [];
    let segments = [];

    if (file_format === 'md' || file_format === 'txt') {
      // Descargar y parsear markdown/txt
      const res = await fetch(file_url);
      parsedText = await res.text();
      speakers = extractSpeakers(parsedText);
    } else if (file_format === 'docx') {
      // Aquí iría librería para parsear .docx (ej: mammoth)
      // Por ahora, placeholder
      return Response.json({ error: '.docx parsing not yet implemented (use mammoth library)' }, { status: 501 });
    }

    // Crear Transcript en BD
    const meeting = meeting_id ? await base44.asServiceRole.entities.Meeting.filter({ id: meeting_id }) : null;
    const meetingData = meeting && meeting.length > 0 ? meeting[0] : {};

    const transcript = await base44.asServiceRole.entities.Transcript.create({
      meeting_id: meeting_id || '',
      client_id: meetingData.client_id || '',
      project_id: meetingData.project_id || '',
      full_text: parsedText,
      source: 'manual_upload',
      status: 'completed',
      segments: segments,
      has_diarization: speakers.length > 1,
    });

    // Crear log de importación
    await base44.asServiceRole.entities.TranscriptImportLog.create({
      source: 'manual_upload',
      source_file_url: file_url,
      meeting_id: meeting_id || '',
      transcript_id: transcript.id,
      import_status: 'success',
      parsed_speakers: speakers,
      file_format: file_format,
      has_timestamps: false,
      has_diarization: speakers.length > 1,
    });

    return Response.json({
      success: true,
      transcript_id: transcript.id,
      speakers,
      text_preview: parsedText.substring(0, 200),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function extractSpeakers(text) {
  // Regex simple: "Speaker Name:" o "Person:"
  const regex = /^([A-Za-z\s]+):\s/gm;
  const speakers = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    speakers.add(match[1].trim());
  }
  return Array.from(speakers);
}