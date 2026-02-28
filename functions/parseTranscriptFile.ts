import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import mammoth from 'npm:mammoth@1.8.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { file_base64, file_url, file_format, meeting_id } = body;

    if (!file_format) {
      return Response.json({ error: 'Missing file_format' }, { status: 400 });
    }

    let parsedText = '';

    if (file_format === 'docx') {
      let buffer;
      if (file_base64) {
        // Decode base64 to ArrayBuffer
        const binaryStr = atob(file_base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        buffer = bytes.buffer;
      } else if (file_url) {
        const res = await fetch(file_url);
        if (!res.ok) return Response.json({ error: 'Could not download file' }, { status: 400 });
        buffer = await res.arrayBuffer();
      } else {
        return Response.json({ error: 'Missing file_base64 or file_url' }, { status: 400 });
      }
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      parsedText = result.value || '';
    } else if (file_url) {
      const res = await fetch(file_url);
      if (!res.ok) return Response.json({ error: 'Could not download file' }, { status: 400 });
      parsedText = await res.text();
    } else {
      return Response.json({ error: 'Missing file data' }, { status: 400 });
    }

    if (!parsedText || parsedText.trim().length === 0) {
      return Response.json({ error: 'Could not extract text from file' }, { status: 400 });
    }

    const speakers = extractSpeakers(parsedText);

    // Load meeting context
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

    if (meeting_id && meetingData.id) {
      try {
        await base44.asServiceRole.entities.Meeting.update(meetingData.id, { status: 'transcribed' });
      } catch (_) {}
    }

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