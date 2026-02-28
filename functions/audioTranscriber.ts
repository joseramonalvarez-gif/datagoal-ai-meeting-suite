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

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    // Download the audio file
    const audioRes = await fetch(audio_file_url);
    if (!audioRes.ok) {
      return Response.json({ error: `Could not download audio file: ${audioRes.statusText}` }, { status: 400 });
    }

    // Determine filename/extension from URL for Whisper (strip query strings)
    const urlPath = new URL(audio_file_url).pathname;
    const ext = urlPath.split('.').pop().toLowerCase().replace(/[?#].*/, '') || 'mp3';
    const supportedExts = ['mp3', 'mp4', 'm4a', 'mpeg', 'mpga', 'wav', 'webm', 'ogg', 'flac'];
    if (!supportedExts.includes(ext)) {
      return Response.json({ error: `Unsupported audio format: .${ext}. Supported: ${supportedExts.join(', ')}` }, { status: 400 });
    }

    const audioBlob = await audioRes.blob();
    const audioFile = new File([audioBlob], `audio.${ext}`, { type: audioBlob.type || `audio/${ext}` });

    // Call OpenAI Whisper API
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', 'whisper-1');
    formData.append('language', 'es');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
      body: formData,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.json().catch(() => ({}));
      return Response.json({ error: `Whisper API error: ${err?.error?.message || whisperRes.statusText}` }, { status: 500 });
    }

    const whisperData = await whisperRes.json();
    const fullText = whisperData.text || '';

    // Map Whisper segments to our schema
    const segments = (whisperData.segments || []).map((s, i) => ({
      speaker_id: 'speaker_1',
      speaker_label: 'Speaker 1',
      text_literal: s.text?.trim() || '',
      start_time: formatTime(s.start),
      end_time: formatTime(s.end),
    }));

    if (!fullText) {
      return Response.json({ error: 'No se pudo extraer texto del audio.' }, { status: 422 });
    }

    // Get meeting
    const meetingList = await base44.asServiceRole.entities.Meeting.filter({ id: meeting_id });
    const meetingData = meetingList[0];
    if (!meetingData) {
      return Response.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Create transcript
    const transcript = await base44.asServiceRole.entities.Transcript.create({
      meeting_id: meeting_id,
      client_id: meetingData.client_id,
      project_id: meetingData.project_id,
      full_text: fullText,
      segments: segments,
      source: audio_source || 'audio_transcription',
      status: segments.length > 0 ? 'completed' : 'no_timeline',
      has_timeline: segments.length > 0,
      has_diarization: false,
      ai_metadata: {
        model: 'whisper-1',
        generated_at: new Date().toISOString(),
        generated_by: user.email,
      },
    });

    // Update meeting status
    await base44.asServiceRole.entities.Meeting.update(meeting_id, { status: 'transcribed' });

    return Response.json({
      success: true,
      transcript_id: transcript.id,
      segments_count: segments.length,
      message: 'Audio transcribed successfully with Whisper',
    });
  } catch (error) {
    console.error('audioTranscriber error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function formatTime(seconds) {
  if (seconds == null) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}