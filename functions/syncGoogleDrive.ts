import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, project_id, entity_type, entity_id, file_content, file_name } = await req.json();

    if (!action) {
      return Response.json({ error: 'action required' }, { status: 400 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    // ========== ACTION: Create Folder Structure ==========
    if (action === 'create_folder_structure' && project_id) {
      const project = await base44.entities.Project.read(project_id);
      const client = await base44.entities.Client.read(project.client_id);

      if (!project || !client) {
        return Response.json({ error: 'Project or Client not found' }, { status: 404 });
      }

      const year = new Date().getFullYear();

      // Root folder path: /DataGoal/{Año}/{Cliente}/{Proyecto}
      const folderStructure = [
        { name: 'DataGoal', parentId: null },
        { name: year.toString(), parentId: null }, // Will update after DataGoal created
        { name: client.name, parentId: null }, // Will update after Year created
        { name: project.name, parentId: null }, // Will update after Client created
        { name: 'Reuniones', parentId: null }, // Will update after Project created
        { name: 'Entregas', parentId: null },
        { name: 'Documentos', parentId: null },
        { name: 'Activos', parentId: null }
      ];

      let rootFolderId = null;
      const createdFolders = {};

      // Helper: Create or find folder
      const createFolder = async (name, parentId) => {
        try {
          const response = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=1', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            method: 'POST',
            body: JSON.stringify({
              name,
              mimeType: 'application/vnd.google-apps.folder',
              parents: parentId ? [parentId] : []
            })
          });

          if (!response.ok) {
            throw new Error(`Drive API error: ${response.statusText}`);
          }

          const data = await response.json();
          return data.id;
        } catch (err) {
          console.error(`Error creating folder ${name}:`, err.message);
          throw err;
        }
      };

      // Create DataGoal root
      rootFolderId = await createFolder('DataGoal', null);
      createdFolders['DataGoal'] = rootFolderId;

      // Create Year folder
      const yearFolderId = await createFolder(year.toString(), rootFolderId);
      createdFolders[year.toString()] = yearFolderId;

      // Create Client folder
      const clientFolderId = await createFolder(client.name, yearFolderId);
      createdFolders[client.name] = clientFolderId;

      // Create Project folder
      const projectFolderId = await createFolder(project.name, clientFolderId);
      createdFolders[project.name] = projectFolderId;

      // Create subfolders
      const meetingsFolderId = await createFolder('Reuniones', projectFolderId);
      const entregasFolderId = await createFolder('Entregas', projectFolderId);
      const documentosFolderId = await createFolder('Documentos', projectFolderId);
      const activosFolderId = await createFolder('Activos', projectFolderId);

      createdFolders['Reuniones'] = meetingsFolderId;
      createdFolders['Entregas'] = entregasFolderId;
      createdFolders['Documentos'] = documentosFolderId;
      createdFolders['Activos'] = activosFolderId;

      // Create GoogleDriveFolder records
      await base44.entities.GoogleDriveFolder.create({
        entity_type: 'project',
        entity_id: project_id,
        folder_name: project.name,
        drive_folder_id: projectFolderId,
        parent_folder_id: clientFolderId,
        path: `/DataGoal/${year}/${client.name}/${project.name}`,
        sync_status: 'synced'
      });

      return Response.json({
        success: true,
        root_folder_id: projectFolderId,
        structure: createdFolders,
        path: `/DataGoal/${year}/${client.name}/${project.name}`
      });
    }

    // ========== ACTION: Upload File ==========
    if (action === 'upload_file' && entity_type && entity_id && file_content && file_name) {
      // Get the entity to find parent folder
      let parentFolderId = null;

      if (entity_type === 'Report') {
        const report = await base44.entities.Report.read(entity_id);
        if (report) {
          const project = await base44.entities.Project.read(report.project_id);
          const googleDrive = await base44.entities.GoogleDriveFolder.filter(
            { entity_type: 'project', entity_id: report.project_id },
            '-created_date',
            1
          );

          if (googleDrive[0]) {
            parentFolderId = googleDrive[0].drive_folder_id;
          }
        }
      }

      if (!parentFolderId) {
        return Response.json({ error: 'Cannot find parent folder' }, { status: 400 });
      }

      // Upload file
      const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

      const metadata = {
        name: file_name,
        parents: [parentFolderId]
      };

      const body = new FormData();
      body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      body.append('file', new Blob([file_content], { type: 'application/pdf' }));

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const uploadedFile = await uploadResponse.json();

      // Update entity with Drive URL
      const driveUrl = `https://drive.google.com/file/d/${uploadedFile.id}/view`;

      if (entity_type === 'Report') {
        await base44.entities.Report.update(entity_id, {
          pdf_url: driveUrl
        });
      }

      return Response.json({
        success: true,
        file_id: uploadedFile.id,
        file_url: driveUrl
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Google Drive sync error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});