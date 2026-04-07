import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, category, asset_type, limit = 10 } = await req.json();

    if (!query || query.trim().length === 0) {
      return Response.json({ error: 'Query requerido' }, { status: 400 });
    }

    // Fetch all knowledge assets
    const filters = { is_public: true };
    if (category) filters.category = category;
    if (asset_type) filters.asset_type = asset_type;

    const assets = await base44.asServiceRole.entities.KnowledgeAsset.filter(filters);

    // Simple text-based search (keyword matching)
    const results = assets
      .map(asset => {
        const queryLower = query.toLowerCase();
        const titleMatch = asset.title.toLowerCase().includes(queryLower) ? 3 : 0;
        const descMatch = asset.description?.toLowerCase().includes(queryLower) ? 2 : 0;
        const contentMatch = asset.content?.toLowerCase().includes(queryLower) ? 1 : 0;
        const tagMatch = asset.tags?.some(t => t.toLowerCase().includes(queryLower)) ? 1.5 : 0;

        const score = titleMatch + descMatch + contentMatch + tagMatch;

        return {
          ...asset,
          match_score: score,
          snippet: extractSnippet(asset.content, query, 150)
        };
      })
      .filter(r => r.match_score > 0)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, limit);

    // Update usage count for viewed assets
    for (const result of results) {
      await base44.asServiceRole.entities.KnowledgeAsset.update(result.id, {
        usage_count: (result.usage_count || 0) + 1,
        last_accessed: new Date().toISOString()
      });
    }

    return Response.json({
      query,
      count: results.length,
      results: results.map(r => ({
        id: r.id,
        title: r.title,
        asset_type: r.asset_type,
        category: r.category,
        snippet: r.snippet,
        match_score: r.match_score,
        file_url: r.file_url,
        tags: r.tags,
        usage_count: r.usage_count,
        created_date: r.created_date
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function extractSnippet(text, query, maxLen) {
  if (!text || !query) return '';
  
  const regex = new RegExp(`(.{0,50}${query}.{0,50})`, 'i');
  const match = text.match(regex);
  
  if (match) {
    return match[1].trim().length > maxLen 
      ? match[1].trim().substring(0, maxLen) + '...'
      : match[1].trim();
  }
  
  return text.substring(0, maxLen) + '...';
}