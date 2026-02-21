import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { query, searchType = 'combined', dateFrom, dateTo, participants = [], limit = 50 } = body;

    if (!query || query.trim().length === 0) {
      return Response.json({ results: [] });
    }

    // Get all meetings, transcripts, and reports
    const [meetings, transcripts, reports] = await Promise.all([
      base44.entities.Meeting.list('-created_date', 200),
      base44.entities.Transcript.list('-created_date', 200),
      base44.entities.Report.list('-created_date', 200),
    ]);

    // Filter by date range if provided
    const filterByDate = (item) => {
      if (!dateFrom && !dateTo) return true;
      const itemDate = new Date(item.date || item.created_date);
      if (dateFrom && itemDate < new Date(dateFrom)) return false;
      if (dateTo && itemDate > new Date(dateTo)) return false;
      return true;
    };

    // Filter by participants if provided
    const filterByParticipants = (meeting) => {
      if (participants.length === 0) return true;
      const meetingParticipantEmails = (meeting.participants || []).map(p => p.email?.toLowerCase());
      return participants.some(p => meetingParticipantEmails.includes(p.toLowerCase()));
    };

    let results = [];

    // Keyword search in transcripts and reports
    if (searchType === 'keyword' || searchType === 'combined') {
      const keywordLower = query.toLowerCase();

      // Search in transcripts
      const transcriptMatches = transcripts
        .filter(filterByDate)
        .map(t => {
          const meeting = meetings.find(m => m.id === t.meeting_id);
          if (!meeting || !filterByParticipants(meeting)) return null;

          const fullText = t.full_text || '';
          const matches = [];
          
          if (fullText.toLowerCase().includes(keywordLower)) {
            const lines = fullText.split('\n');
            matches.push(...lines.filter(l => l.toLowerCase().includes(keywordLower)).slice(0, 3));
          }

          if (matches.length === 0) return null;

          return {
            type: 'transcript',
            id: t.id,
            meeting_id: meeting.id,
            title: `Transcripción: ${meeting.title}`,
            date: meeting.date,
            preview: matches.join(' ... '),
            score: matches.length,
          };
        })
        .filter(Boolean);

      // Search in reports
      const reportMatches = reports
        .filter(filterByDate)
        .map(r => {
          const meeting = meetings.find(m => m.id === r.meeting_id);
          if (!meeting || !filterByParticipants(meeting)) return null;

          const content = r.content_markdown || '';
          if (!content.toLowerCase().includes(keywordLower)) return null;

          const lines = content.split('\n');
          const matches = lines.filter(l => l.toLowerCase().includes(keywordLower)).slice(0, 3);

          return {
            type: 'report',
            id: r.id,
            meeting_id: meeting.id,
            title: r.title,
            date: meeting.date,
            preview: matches.join(' ... '),
            score: matches.length,
          };
        })
        .filter(Boolean);

      results = [...transcriptMatches, ...reportMatches]
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }

    // Semantic search using LLM
    if (searchType === 'semantic' || (searchType === 'combined' && results.length < 10)) {
      const relevantTranscripts = transcripts
        .filter(filterByDate)
        .filter(t => {
          const meeting = meetings.find(m => m.id === t.meeting_id);
          return meeting && filterByParticipants(meeting);
        })
        .slice(0, 20);

      if (relevantTranscripts.length > 0) {
        const semanticResults = await Promise.all(
          relevantTranscripts.map(async (t) => {
            const meeting = meetings.find(m => m.id === t.meeting_id);
            const fullText = t.full_text || '';
            
            if (fullText.length === 0) return null;

            const response = await base44.integrations.Core.InvokeLLM({
              prompt: `Given this search query: "${query}"

Determine if this meeting transcript is relevant to the query (semantic match, not just keyword).
Return a relevance score from 0-100 (0 = not relevant, 100 = highly relevant).
Also return a brief summary of why it's relevant (1-2 sentences).

TRANSCRIPT:
${fullText.substring(0, 3000)}`,
              response_json_schema: {
                type: "object",
                properties: {
                  relevance_score: { type: "number" },
                  reason: { type: "string" }
                }
              }
            });

            if (!response || response.relevance_score < 30) return null;

            return {
              type: 'transcript_semantic',
              id: t.id,
              meeting_id: meeting.id,
              title: `Transcripción: ${meeting.title}`,
              date: meeting.date,
              preview: response.reason,
              score: response.relevance_score,
            };
          })
        );

        results = [...results, ...semanticResults.filter(Boolean)]
          .reduce((acc, item) => {
            const exists = acc.find(r => r.id === item.id);
            if (!exists) acc.push(item);
            return acc;
          }, [])
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      }
    }

    // Enrich results with meeting metadata
    const enrichedResults = results.map(r => {
      const meeting = meetings.find(m => m.id === r.meeting_id);
      return {
        ...r,
        meeting_title: meeting?.title,
        meeting_date: meeting?.date,
        participants: meeting?.participants || [],
      };
    });

    return Response.json({ results: enrichedResults, total: enrichedResults.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});