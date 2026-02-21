import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { project_id, project_name, client_id } = await req.json();

    if (!project_id || !project_name || !client_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    // Obtener cliente folder_id desde GoogleDriveFolder
    const clientDriveFolder = await base44.asServiceRole.entities.GoogleDriveFolder.filter({
      entity_type: 'client',
      entity_id: client_id,
    });

    if (!clientDriveFolder || clientDriveFolder.length === 0) {
      return Response.json({ error: 'Client Drive folder not found. Create client first.' }, { status: 404 });
    }

    const parentFolderId = clientDriveFolder[0].drive_folder_id;

    // Crear carpeta proyecto
    const projFolderName = `${project_id}_${project_name.replace(/\s+/g, '_')}`;
    const projFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projFolderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      }),
    });

    const projFolder = await projFolderRes.json();
    const projectFolderId = projFolder.id;

    // Crear subcarpetas estándar
    const subfolders = [
      '01_Transcripciones',
      '02_Audios',
      '03_Informes',
      '04_Entregables',
    ];

    const subfolderIds = {};
    for (const subfolder of subfolders) {
      const subRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: subfolder,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [projectFolderId],
        }),
      });
      const subFolder = await subRes.json();
      subfolderIds[subfolder] = subFolder.id;
    }

    // Guardar en BD
    await base44.asServiceRole.entities.GoogleDriveFolder.create({
      entity_type: 'project',
      entity_id: project_id,
      folder_name: projFolderName,
      drive_folder_id: projectFolderId,
      parent_folder_id: parentFolderId,
      path: `/DataGoal/Clientes/${clientDriveFolder[0].folder_name}/${projFolderName}`,
      sync_status: 'synced',
    });

    return Response.json({
      success: true,
      project_folder_id: projectFolderId,
      subfolders: subfolderIds,
      path: `/DataGoal/Clientes/${clientDriveFolder[0].folder_name}/${projFolderName}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});