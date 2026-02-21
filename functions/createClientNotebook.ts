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

    // Create Google Doc (notebook)
    const docMetadata = {
      name: `${client_name} - Cuaderno de Notas`,
      mimeType: 'application/vnd.google-apps.document',
      parents: [parentFolderId]
    };

    const createDocResponse = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(docMetadata)
    });

    if (!createDocResponse.ok) {
      throw new Error(`Failed to create notebook: ${createDocResponse.statusText}`);
    }

    const docData = await createDocResponse.json();
    const docId = docData.id;

    // Initialize the document with a template
    const docContent = `# ${client_name} - Cuaderno de Notas

## Información del Cliente
- **Nombre:** ${client_name}
- **Fecha de Creación:** ${new Date().toLocaleDateString('es-ES')}

## Notas y Observaciones
[Espacio para agregar notas sobre el cliente]

## Proyectos Activos
[Se agregarán automáticamente]

## Decisiones y Acuerdos
[Registro de decisiones importantes]

## Próximos Pasos
[Acciones pendientes]
`;

    // Update the document content using Google Docs API
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
              text: docContent,
              location: { index: 1 }
            }
          }
        ]
      })
    });

    return Response.json({ 
      success: true, 
      notebook_id: docId,
      notebook_url: `https://docs.google.com/document/d/${docId}`,
      message: 'Client notebook created successfully'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});