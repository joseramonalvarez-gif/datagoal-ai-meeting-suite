import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { meeting_id, project_id, audio_file_url, audio_file_name } = await req.json();

    if (!meeting_id || !project_id || !audio_file_url) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    // Get project folder
    const projectFolders = await base44.asServiceRole.entities.GoogleDriveFolder.filter({ 
      entity_type: 'project',
      entity_id: project_id 
    });

    if (!projectFolders || projectFolders.length === 0) {
      return Response.json({ error: 'Project folder not found' }, { status: 404 });
    }

    // Get Audios subfolder
    const projectFolder = projectFolders[0];
    const subfolderResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='Audios' and parents='${projectFolder.drive_folder_id}' and mimeType='application/vnd.google-apps.folder'&supportsAllDrives=true`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    const subfolderData = await subfolderResponse.json();
    const audiosFolderId = subfolderData.files[0]?.id;

    if (!audiosFolderId) {
      return Response.json({ error: 'Audios folder not found' }, { status: 404 });
    }

    // Download file from audio_file_url and upload to Drive
    const fileResponse = await fetch(audio_file_url);
    const fileBlob = await fileResponse.arrayBuffer();

    const meeting = await base44.asServiceRole.entities.Meeting.filter({ id: meeting_id });
    const meetingTitle = meeting && meeting.length > 0 ? meeting[0].title : 'Audio';
    const fileName = audio_file_name || `${meetingTitle}-${Date.now()}`;

    const form = new FormData();
    form.append('metadata', JSON.stringify({
      name: fileName,
      parents: [audiosFolderId]
    }));
    form.append('file', new Blob([fileBlob]));

    const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: form
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload audio: ${uploadResponse.statusText}`);
    }

    const uploadData = await uploadResponse.json();

    return Response.json({ 
      success: true, 
      file_id: uploadData.id,
      message: 'Audio uploaded to Drive'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});