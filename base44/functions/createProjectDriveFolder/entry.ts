import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { project_id, project_name, client_id } = await req.json();

    if (!project_id || !project_name || !client_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    // Get client folder
    const clientFolder = await base44.asServiceRole.entities.GoogleDriveFolder.filter({ 
      entity_type: 'client',
      entity_id: client_id 
    });

    if (!clientFolder || clientFolder.length === 0) {
      return Response.json({ error: 'Client folder not found' }, { status: 404 });
    }

    const parentFolderId = clientFolder[0].drive_folder_id;

    // Create project folder
    const projectFolderMetadata = {
      name: project_name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId]
    };

    const createProjectResponse = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(projectFolderMetadata)
    });

    if (!createProjectResponse.ok) {
      throw new Error(`Failed to create project folder: ${createProjectResponse.statusText}`);
    }

    const projectFolder = await createProjectResponse.json();
    const projectFolderId = projectFolder.id;

    // Create subfolders
    const subfolders = [
      { name: 'Transcripciones', folder_name: 'transcripciones' },
      { name: 'Audios', folder_name: 'audios' },
      { name: 'Informes', folder_name: 'informes' },
      { name: 'Entregables', folder_name: 'entregables' }
    ];

    for (const subfolder of subfolders) {
      const subfolderMetadata = {
        name: subfolder.name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [projectFolderId]
      };

      await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subfolderMetadata)
      });
    }

    // Create GoogleDriveFolder record
    await base44.asServiceRole.entities.GoogleDriveFolder.create({
      entity_type: 'project',
      entity_id: project_id,
      folder_name: project_name,
      drive_folder_id: projectFolderId,
      parent_folder_id: parentFolderId,
      path: `${clientFolder[0].path}/${project_name}`,
      sync_status: 'synced'
    });

    return Response.json({ 
      success: true, 
      folder_id: projectFolderId,
      message: 'Project folder and subfolders created successfully'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});