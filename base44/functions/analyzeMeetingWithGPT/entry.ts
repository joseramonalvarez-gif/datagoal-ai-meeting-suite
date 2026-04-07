import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { transcript_id, full_text } = await req.json();

    if (!transcript_id || !full_text) {
      return Response.json({ error: 'Missing transcript_id or full_text' }, { status: 400 });
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const prompt = `Analiza esta transcripción de reunión de consultoría y extrae en JSON puro (sin markdown):
{
  "decisiones": [
    {"descripción": "...", "fecha_vencimiento": "YYYY-MM-DD", "responsable": "..."}
  ],
  "riesgos": [
    {"título": "...", "descripción": "...", "severidad": "high|medium|low", "mitigación": "..."}
  ],
  "oportunidades": [
    {"título": "...", "descripción": "...", "impacto": "high|medium|low", "próximos_pasos": "..."}
  ],
  "action_items": [
    {"título": "...", "descripción": "...", "due_date": "YYYY-MM-DD", "owner": "..."}
  ],
  "sentiment": "positivo|neutral|negativo",
  "resumen_ejecutivo": "Max 100 palabras"
}

TRANSCRIPCIÓN:
${full_text}`;

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: 'Eres un analista estratégico experto en reuniones de consultoría. Extrae información crítica y estructúrala en JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.json();
      throw new Error(`OpenAI API error: ${err.error?.message}`);
    }

    const openaiData = await openaiRes.json();
    const content = openaiData.choices[0].message.content;

    // Parsear JSON de la respuesta
    let analysis = {};
    try {
      analysis = JSON.parse(content);
    } catch {
      // Si falla parsing, extraer JSON manualmente
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse GPT response as JSON');
      }
    }

    return Response.json({
      success: true,
      transcript_id: transcript_id,
      analysis: analysis,
      decisiones: analysis.decisiones || [],
      riesgos: analysis.riesgos || [],
      oportunidades: analysis.oportunidades || [],
      action_items: analysis.action_items || [],
      sentiment: analysis.sentiment || 'neutral',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});