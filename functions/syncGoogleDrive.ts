import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      delivery_run_id,
      meeting_id,
      content_markdown,
      meeting_title,
      client_id,
      project_id
    } = await req.json();

    if (!content_markdown) {
      return Response.json({ error: 'content_markdown requerido' }, { status: 400 });
    }

    // Obtener token de Google Drive
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    // Cargar datos de cliente/proyecto para naming
    const [clients, projects] = await Promise.all([
      client_id ? base44.entities.Client.filter({ id: client_id }) : Promise.resolve([]),
      project_id ? base44.entities.Project.filter({ id: project_id }) : Promise.resolve([])
    ]);
    const client = clients[0];
    const project = projects[0];

    const today = new Date().toISOString().split('T')[0];
    const safeTitle = (meeting_title || 'Reunion')
      .replace(/[^a-zA-Z0-9\s\-_áéíóúÁÉÍÓÚñÑ]/g, '')
      .trim()
      .substring(0, 50);
    const fileName = `${today}_${safeTitle}_v1.txt`;

    // Buscar o crear carpeta raíz de DataGoal
    let folderId = null;
    try {
      // Crear carpeta con nombre único para esta entrega
      const folderName = `DataGoal_${client?.name || 'Cliente'}_Informes`;
      const createFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder'
        })
      });

      if (createFolderRes.ok) {
        const folder = await createFolderRes.json();
        folderId = folder.id;
      }
    } catch (folderError) {
      // Si no se puede crear carpeta, subir a raíz
      folderId = null;
    }

    // Subir archivo como texto plano
    const fileContent = content_markdown;
    const metadata = {
      name: fileName,
      mimeType: 'text/plain',
      ...(folderId ? { parents: [folderId] } : {})
    };

    const boundary = '-------314159265358979323846';
    const multipartBody = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      fileContent,
      `--${boundary}--`
    ].join('\r\n');

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
          'Content-Length': multipartBody.length.toString()
        },
        body: multipartBody
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Drive upload failed: ${uploadRes.status} - ${errText}`);
    }

    const file = await uploadRes.json();

    // Guardar metadata en BD
    if (delivery_run_id) {
      await base44.entities.DeliveryVersion.update(delivery_run_id, {
        drive_file_id: file.id,
        drive_file_url: file.webViewLink
      });
    }

    return Response.json({
      success: true,
      file_id: file.id,
      file_name: file.name,
      web_view_link: file.webViewLink,
      folder_id: folderId
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});