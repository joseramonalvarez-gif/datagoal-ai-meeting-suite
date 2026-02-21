import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { client_id, client_name } = await req.json();

    if (!client_id || !client_name) {
      return Response.json({ error: 'Missing client_id or client_name' }, { status: 400 });
    }

    // Get access token for Google Drive
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    // Create main client folder
    const folderMetadata = {
      name: `${client_name}`,
      mimeType: 'application/vnd.google-apps.folder'
    };

    const createFolderResponse = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(folderMetadata)
    });

    if (!createFolderResponse.ok) {
      throw new Error(`Failed to create client folder: ${createFolderResponse.statusText}`);
    }

    const clientFolder = await createFolderResponse.json();
    const clientFolderId = clientFolder.id;

    // Create GoogleDriveFolder record
    await base44.asServiceRole.entities.GoogleDriveFolder.create({
      entity_type: 'client',
      entity_id: client_id,
      folder_name: client_name,
      drive_folder_id: clientFolderId,
      path: `/${client_name}`,
      sync_status: 'synced'
    });

    return Response.json({ 
      success: true, 
      folder_id: clientFolderId,
      message: 'Client folder created successfully'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});