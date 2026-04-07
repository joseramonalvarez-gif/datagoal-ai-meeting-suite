import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { client_id, client_name } = await req.json();

    if (!client_id || !client_name) {
      return Response.json({ error: 'Missing client_id or client_name' }, { status: 400 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    // Crear carpeta raíz /DataGoal/Clientes/[CLIENT_ID]_[CLIENT_NAME]
    const folderName = `${client_id}_${client_name.replace(/\s+/g, '_')}`;
    const parentFolderId = 'root'; // Raíz de Drive (o usa una carpeta "DataGoal" preexistente)

    const createFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      }),
    });

    if (!createFolderRes.ok) {
      const err = await createFolderRes.json();
      throw new Error(`Google Drive API error: ${err.message}`);
    }

    const folder = await createFolderRes.json();
    const clientFolderId = folder.id;

    // Guardar en BD
    await base44.asServiceRole.entities.GoogleDriveFolder.create({
      entity_type: 'client',
      entity_id: client_id,
      folder_name: folderName,
      drive_folder_id: clientFolderId,
      parent_folder_id: parentFolderId,
      path: `/DataGoal/Clientes/${folderName}`,
      sync_status: 'synced',
    });

    return Response.json({
      success: true,
      folder_id: clientFolderId,
      path: `/DataGoal/Clientes/${folderName}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});