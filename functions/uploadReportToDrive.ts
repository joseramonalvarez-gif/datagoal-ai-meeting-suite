import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { report_id, project_id } = await req.json();

    if (!report_id || !project_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    // Get report
    const reports = await base44.asServiceRole.entities.Report.filter({ id: report_id });
    if (!reports || reports.length === 0) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }

    const report = reports[0];

    // Get project folder
    const projectFolders = await base44.asServiceRole.entities.GoogleDriveFolder.filter({ 
      entity_type: 'project',
      entity_id: project_id 
    });

    if (!projectFolders || projectFolders.length === 0) {
      return Response.json({ error: 'Project folder not found' }, { status: 404 });
    }

    // Get Informes subfolder
    const projectFolder = projectFolders[0];
    const subfolderResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='Informes' and parents='${projectFolder.drive_folder_id}' and mimeType='application/vnd.google-apps.folder'&supportsAllDrives=true`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    const subfolderData = await subfolderResponse.json();
    const informesFolderId = subfolderData.files[0]?.id;

    if (!informesFolderId) {
      return Response.json({ error: 'Informes folder not found' }, { status: 404 });
    }

    // Create Google Doc for report
    const docMetadata = {
      name: report.title || 'Report',
      mimeType: 'application/vnd.google-apps.document',
      parents: [informesFolderId]
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

    // Insert report content
    const content = report.content_markdown || report.content_html || 'No content available';

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
      message: 'Report uploaded to Drive'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});