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
      prompt: `Transcribe the audio file and identify speakers. Format the output as JSON with:
{
  "segments": [
    {
      "speaker_label": "Speaker 1",
      "text": "...",
      "start_time": "00:00:00",
      "end_time": "00:00:10"
    }
  ],
  "full_text": "..."
}`,
      file_urls: [audio_file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          segments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                speaker_label: { type: 'string' },
                text: { type: 'string' },
                start_time: { type: 'string' },
                end_time: { type: 'string' }
              }
            }
          },
          full_text: { type: 'string' }
        }
      }
    });

    // Get meeting details
    const meeting = await base44.asServiceRole.entities.Meeting.filter({ id: meeting_id });
    
    if (!meeting || meeting.length === 0) {
      return Response.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const meetingData = meeting[0];

    // Create transcript
    const transcript = await base44.asServiceRole.entities.Transcript.create({
      meeting_id: meeting_id,
      client_id: meetingData.client_id,
      project_id: meetingData.project_id,
      full_text: transcriptionResult.full_text,
      segments: transcriptionResult.segments,
      source: audio_source || 'audio_transcription',
      status: 'completed',
      has_timeline: true,
      has_diarization: true,
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