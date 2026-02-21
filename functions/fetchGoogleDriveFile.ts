import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url } = await req.json();
    
    if (!url) {
      return Response.json({ error: 'URL is required' }, { status: 400 });
    }

    // Get Gmail access token to use with Google APIs
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('gmail');
    
    if (!accessToken) {
      return Response.json({ error: 'Gmail connector not authorized. Please authorize Gmail access.' }, { status: 401 });
    }

    // Extract file ID from Google Drive URL
    let fileId = null;
    
    // Handle different URL formats
    if (url.includes('/d/')) {
      // Format: https://drive.google.com/file/d/FILE_ID/view or /open
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) fileId = match[1];
    } else if (url.includes('id=')) {
      // Format: https://drive.google.com/open?id=FILE_ID
      const match = url.match(/id=([a-zA-Z0-9-_]+)/);
      if (match) fileId = match[1];
    }

    if (!fileId) {
      return Response.json({ error: 'Invalid Google Drive URL format' }, { status: 400 });
    }

    // Fetch file content from Google Drive API
    const fileResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    if (!fileResponse.ok) {
      if (fileResponse.status === 404) {
        return Response.json({ error: 'File not found. Check the URL and permissions.' }, { status: 404 });
      }
      if (fileResponse.status === 403) {
        return Response.json({ error: 'Access denied. Make sure the file is shared with you.' }, { status: 403 });
      }
      throw new Error(`Google Drive API error: ${fileResponse.statusText}`);
    }

    // Determine content type
    const contentType = fileResponse.headers.get('content-type') || '';
    let content = '';

    if (contentType.includes('text/plain') || contentType.includes('application/json')) {
      // Plain text or JSON
      content = await fileResponse.text();
    } else if (contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') || 
               contentType.includes('application/msword')) {
      // DOCX or DOC - use LLM to extract text
      const buffer = await fileResponse.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const fileUrl = `data:${contentType};base64,${base64}`;
      
      const extracted = await base44.integrations.Core.InvokeLLM({
        prompt: 'Extract all text content from this document. Return only the plain text content.',
        file_urls: [fileUrl]
      });
      content = extracted || '';
    } else if (contentType.includes('application/pdf')) {
      // PDF - use LLM to extract text
      const buffer = await fileResponse.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const fileUrl = `data:application/pdf;base64,${base64}`;
      
      const extracted = await base44.integrations.Core.InvokeLLM({
        prompt: 'Extract all text content from this PDF. Return only the plain text content.',
        file_urls: [fileUrl]
      });
      content = extracted || '';
    } else {
      // Try to read as text anyway
      content = await fileResponse.text();
    }

    if (!content || content.trim().length === 0) {
      return Response.json({ error: 'Could not extract text from file' }, { status: 400 });
    }

    return Response.json({ 
      success: true, 
      content: content.trim(),
      file_id: fileId 
    });
  } catch (error) {
    console.error('fetchGoogleDriveFile error:', error);
    return Response.json({ error: error.message || 'Error fetching file from Google Drive' }, { status: 500 });
  }
});