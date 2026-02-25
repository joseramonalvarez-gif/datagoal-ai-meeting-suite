import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import mammoth from 'npm:mammoth@1.8.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { file_url, file_format, meeting_id } = await req.json();

    if (!file_url || !file_format) {
      return Response.json({ error: 'Missing file_url or file_format' }, { status: 400 });
    }

    let parsedText = '';
    let speakers = [];

    const res = await fetch(file_url);
    if (!res.ok) {
      return Response.json({ error: 'Could not download file from URL' }, { status: 400 });
    }

    if (file_format === 'md' || file_format === 'txt') {
      parsedText = await res.text();
    } else if (file_format === 'docx') {
      const buffer = await res.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      parsedText = result.value || '';
    } else {
      // fallback: try plain text
      parsedText = await res.text();
    }

    if (!parsedText || parsedText.trim().length === 0) {
      return Response.json({ error: 'Could not extract text from file' }, { status: 400 });
    }

    speakers = extractSpeakers(parsedText);

    // Load meeting context safely
    let meetingData = {};
    if (meeting_id) {
      try {
        const meetings = await base44.asServiceRole.entities.Meeting.filter({ id: meeting_id });
        meetingData = meetings[0] || {};
      } catch (_) {}
    }

    const transcript = await base44.asServiceRole.entities.Transcript.create({
      meeting_id: meeting_id || '',
      client_id: meetingData.client_id || '',
      project_id: meetingData.project_id || '',
      full_text: parsedText,
      source: 'manual_upload',
      status: 'completed',
      segments: [],
      has_diarization: speakers.length > 1,
    });

    // Update meeting status
    if (meeting_id && meetingData.id) {
      try {
        await base44.asServiceRole.entities.Meeting.update(meetingData.id, { status: 'transcribed' });
      } catch (_) {}
    }

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
      imported_at: new Date().toISOString(),
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
  const regex = /^([A-ZÁÉÍÓÚÜÑa-záéíóúüñ][A-Za-záéíóúüñ\s]{0,30}):\s/gm;
  const speakers = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1].trim();
    if (name.length > 1 && name.length < 40) speakers.add(name);
  }
  return Array.from(speakers);
}