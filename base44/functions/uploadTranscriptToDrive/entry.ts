import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transcript_id, meeting_id, project_id, client_id } = await req.json();

    if (!transcript_id || !project_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    // Get transcript data
    const transcripts = await base44.asServiceRole.entities.Transcript.filter({ id: transcript_id });
    if (!transcripts || transcripts.length === 0) {
      return Response.json({ error: 'Transcript not found' }, { status: 404 });
    }

    const transcript = transcripts[0];

    // Get project folder
    const projectFolders = await base44.asServiceRole.entities.GoogleDriveFolder.filter({ 
      entity_type: 'project',
      entity_id: project_id 
    });

    if (!projectFolders || projectFolders.length === 0) {
      return Response.json({ error: 'Project folder not found' }, { status: 404 });
    }

    // Get transcripciones subfolder
    const projectFolder = projectFolders[0];
    const subfolderResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='Transcripciones' and parents='${projectFolder.drive_folder_id}' and mimeType='application/vnd.google-apps.folder'&supportsAllDrives=true`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    const subfolderData = await subfolderResponse.json();
    const transcriptionsFolderId = subfolderData.files[0]?.id;

    if (!transcriptionsFolderId) {
      return Response.json({ error: 'Transcripciones folder not found' }, { status: 404 });
    }

    // Create Google Doc for transcript
    const meeting = await base44.asServiceRole.entities.Meeting.filter({ id: meeting_id });
    const meetingTitle = meeting && meeting.length > 0 ? meeting[0].title : 'Transcription';

    const docMetadata = {
      name: `${meetingTitle} - Transcripción`,
      mimeType: 'application/vnd.google-apps.document',
      parents: [transcriptionsFolderId]
    };

    const createDocResponse = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(docMetadata)
    });

    const docData = await createDocResponse.json();
    const docId = docData.id;

    // Format and insert transcript content
    let content = `# ${meetingTitle}\n\n## Transcripción\n\n`;
    if (transcript.segments && transcript.segments.length > 0) {
      transcript.segments.forEach(segment => {
        content += `**${segment.speaker_label}** (${segment.start_time} - ${segment.end_time}):\n${segment.text}\n\n`;
      });
    } else {
      content += transcript.full_text;
    }

    await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              text: content,
              location: { index: 1 }
            }
          }
        ]
      })
    });

    return Response.json({ 
      success: true, 
      doc_id: docId,
      doc_url: `https://docs.google.com/document/d/${docId}`,
      message: 'Transcript uploaded to Drive'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});