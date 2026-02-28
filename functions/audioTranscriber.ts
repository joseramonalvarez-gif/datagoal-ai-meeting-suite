import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { meeting_id, audio_file_url, audio_source } = await req.json();

    if (!meeting_id || !audio_file_url) {
      return Response.json({ error: 'Missing meeting_id or audio_file_url' }, { status: 400 });
    }

    // Invoke LLM to transcribe audio with speaker identification
    const transcriptionResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Transcribe this audio file completely and literally in Spanish.
Identify all speakers (label them by name if possible, otherwise Speaker 1, Speaker 2, etc.).
Include timestamps in MM:SS format.
Return structured JSON with every spoken segment.`,
      file_urls: [audio_file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          segments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                speaker_id: { type: 'string' },
                speaker_label: { type: 'string' },
                text_literal: { type: 'string' },
                start_time: { type: 'string' },
                end_time: { type: 'string' }
              }
            }
          },
          full_text: { type: 'string' }
        }
      }
    });

    if (!transcriptionResult || (!transcriptionResult.full_text && !transcriptionResult.segments?.length)) {
      return Response.json({ error: 'No se pudo extraer texto del audio. Verifica que el archivo tenga voz audible.' }, { status: 422 });
    }

    // Get meeting details
    const meetingList = await base44.asServiceRole.entities.Meeting.list();
    const meetingData = meetingList.find(m => m.id === meeting_id);

    if (!meetingData) {
      return Response.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const segments = (transcriptionResult.segments || []).map(s => ({
      speaker_id: s.speaker_id || 'speaker_1',
      speaker_label: s.speaker_label || 'Speaker 1',
      text_literal: s.text_literal || s.text || '',
      start_time: s.start_time || '',
      end_time: s.end_time || '',
    }));

    const fullText = transcriptionResult.full_text ||
      segments.map(s => `${s.speaker_label}: ${s.text_literal}`).join('\n');

    // Create transcript
    const transcript = await base44.asServiceRole.entities.Transcript.create({
      meeting_id: meeting_id,
      client_id: meetingData.client_id,
      project_id: meetingData.project_id,
      full_text: fullText,
      segments: segments,
      source: audio_source || 'audio_transcription',
      status: segments.length > 0 ? 'completed' : 'no_timeline',
      has_timeline: segments.some(s => !!s.start_time),
      has_diarization: new Set(segments.map(s => s.speaker_id)).size > 1,
      ai_metadata: {
        model: 'gpt-4-turbo',
        generated_at: new Date().toISOString(),
        generated_by: user.email
      }
    });

    // Update meeting status
    await base44.asServiceRole.entities.Meeting.update(meeting_id, {
      status: 'transcribed'
    });

    return Response.json({ 
      success: true, 
      transcript_id: transcript.id,
      message: 'Audio transcribed successfully'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});