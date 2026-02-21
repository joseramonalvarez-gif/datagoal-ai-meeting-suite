import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { 
      meeting_id, 
      title, 
      markdown_content, 
      client_id, 
      project_id 
    } = await req.json();

    if (!title || !markdown_content) {
      return Response.json({ error: 'Missing title or markdown_content' }, { status: 400 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    // Obtener carpeta de informes del proyecto
    const projectFolder = await base44.asServiceRole.entities.GoogleDriveFolder.filter({
      entity_type: 'project',
      entity_id: project_id,
    });

    let parentFolderId = 'root';
    if (projectFolder && projectFolder.length > 0) {
      parentFolderId = projectFolder[0].drive_folder_id;
    }

    // Crear documento en Google Docs
    const docName = `${new Date().toISOString().split('T')[0]}_${title.replace(/\s+/g, '_')}_v1`;
    
    const createDocRes = await fetch('https://docs.googleapis.com/v1/documents?fields=documentId', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: docName,
      }),
    });

    if (!createDocRes.ok) {
      const err = await createDocRes.json();
      throw new Error(`Google Docs API error: ${err.error?.message}`);
    }

    const docData = await createDocRes.json();
    const documentId = docData.documentId;

    // Insertar contenido en el documento
    const insertRes = await fetch(
      `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                text: markdown_content,
                location: { index: 1 },
              },
            },
          ],
        }),
      }
    );

    if (!insertRes.ok) {
      throw new Error('Failed to insert content into Google Doc');
    }

    // Obtener share link
    const permissions = await fetch(
      `https://www.googleapis.com/drive/v3/files/${documentId}/permissions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      }
    );

    const shareLink = `https://docs.google.com/document/d/${documentId}/edit`;

    // Guardar referencia en BD
    await base44.asServiceRole.entities.Report.create({
      meeting_id: meeting_id,
      client_id: client_id,
      project_id: project_id,
      title: title,
      content_markdown: markdown_content,
      status: 'generated',
      pdf_url: shareLink,
    });

    return Response.json({
      success: true,
      document_id: documentId,
      share_link: shareLink,
      doc_name: docName,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});