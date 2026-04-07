import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { delivery_run_id, project_id, output_file_url } = await req.json();

    if (!delivery_run_id || !project_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    // Get delivery run
    const deliveries = await base44.asServiceRole.entities.DeliveryRun.filter({ id: delivery_run_id });
    if (!deliveries || deliveries.length === 0) {
      return Response.json({ error: 'Delivery not found' }, { status: 404 });
    }

    const delivery = deliveries[0];

    // Get project folder
    const projectFolders = await base44.asServiceRole.entities.GoogleDriveFolder.filter({ 
      entity_type: 'project',
      entity_id: project_id 
    });

    if (!projectFolders || projectFolders.length === 0) {
      return Response.json({ error: 'Project folder not found' }, { status: 404 });
    }

    // Get Entregables subfolder
    const projectFolder = projectFolders[0];
    const subfolderResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='Entregables' and parents='${projectFolder.drive_folder_id}' and mimeType='application/vnd.google-apps.folder'&supportsAllDrives=true`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    const subfolderData = await subfolderResponse.json();
    const entregablesFolderId = subfolderData.files[0]?.id;

    if (!entregablesFolderId) {
      return Response.json({ error: 'Entregables folder not found' }, { status: 404 });
    }

    // Create Google Doc for delivery if output_file_url not provided
    if (!output_file_url) {
      const docMetadata = {
        name: `Entrega - ${new Date().toLocaleDateString('es-ES')}`,
        mimeType: 'application/vnd.google-apps.document',
        parents: [entregablesFolderId]
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

      const content = delivery.output_content || 'Delivery content';

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
        message: 'Delivery uploaded to Drive'
      });
    } else {
      // Upload existing file
      const fileResponse = await fetch(output_file_url);
      const fileBlob = await fileResponse.arrayBuffer();

      const form = new FormData();
      form.append('metadata', JSON.stringify({
        name: `Entrega - ${new Date().toLocaleDateString('es-ES')}`,
        parents: [entregablesFolderId]
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
        throw new Error(`Failed to upload delivery: ${uploadResponse.statusText}`);
      }

      const uploadData = await uploadResponse.json();

      return Response.json({ 
        success: true, 
        file_id: uploadData.id,
        message: 'Delivery file uploaded to Drive'
      });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});