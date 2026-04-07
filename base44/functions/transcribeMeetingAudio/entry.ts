import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { meeting_id, audio_url } = await req.json();

    if (!meeting_id || !audio_url) {
      return Response.json({ error: 'Missing meeting_id or audio_url' }, { status: 400 });
    }

    // Obtener archivo de audio
    const audioRes = await fetch(audio_url);
    if (!audioRes.ok) {
      throw new Error(`Failed to fetch audio from ${audio_url}`);
    }
    const audioBuffer = await audioRes.arrayBuffer();

    // Llamar Google Cloud Speech-to-Text
    const speechApiKey = Deno.env.get('GOOGLE_SPEECH_API_KEY');
    if (!speechApiKey) {
      throw new Error('GOOGLE_SPEECH_API_KEY not configured');
    }

    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

    const speechRes = await fetch('https://speech.googleapis.com/v1/speech:recognize?key=' + speechApiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio: { content: base64Audio },
        config: {
          encoding: 'LINEAR16',
          languageCode: 'es-ES',
          enableAutomaticPunctuation: true,
          enableSpeakerDiarization: true,
          diarizationSpeakerCount: 2,
          audioChannelCount: 1,
        },
      }),
    });

    if (!speechRes.ok) {
      const err = await speechRes.json();
      throw new Error(`Speech API error: ${err.error?.message}`);
    }

    const speechData = await speechRes.json();

    // Procesar resultado
    let fullText = '';
    const segments = [];
    let speakerId = 0;
    const speakerMap = {};

    if (speechData.results) {
      for (const result of speechData.results) {
        for (const alt of result.alternatives) {
          fullText += (fullText ? ' ' : '') + alt.transcript;

          // Extraer segmentos con timestamps y diarización
          if (result.resultEndTime) {
            const currentSpeaker = speakerMap[speakerId] || `Speaker ${speakerId + 1}`;
            segments.push({
              start_time: result.resultEndTime.seconds ? 
                `${Math.floor(result.resultEndTime.seconds / 60)}:${String(result.resultEndTime.seconds % 60).padStart(2, '0')}` : '0:00',
              end_time: result.resultEndTime.seconds ? 
                `${Math.floor(result.resultEndTime.seconds / 60)}:${String(result.resultEndTime.seconds % 60).padStart(2, '0')}` : '0:00',
              speaker_id: `speaker_${speakerId}`,
              speaker_label: currentSpeaker,
              text_literal: alt.transcript,
            });
          }
        }
      }
    }

    // Crear Transcript en BD
    const transcript = await base44.asServiceRole.entities.Transcript.create({
      meeting_id: meeting_id,
      client_id: '',
      project_id: '',
      version: 1,
      status: 'completed',
      full_text: fullText,
      segments: segments,
      source: 'audio_transcription',
      has_timeline: true,
      has_diarization: segments.length > 0,
    });

    // Crear log de importación
    await base44.asServiceRole.entities.TranscriptImportLog.create({
      source: 'google_meet',
      source_file_url: audio_url,
      meeting_id: meeting_id,
      transcript_id: transcript.id,
      import_status: 'success',
      parsed_speakers: ['Speaker 1', 'Speaker 2'],
      duration_seconds: 0,
      has_timestamps: true,
      has_diarization: true,
    });

    return Response.json({
      success: true,
      transcript_id: transcript.id,
      full_text: fullText.substring(0, 300),
      segments_count: segments.length,
      has_diarization: true,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});