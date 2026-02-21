import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { delivery_run_id } = await req.json();

    if (!delivery_run_id) {
      return Response.json({ error: 'delivery_run_id required' }, { status: 400 });
    }

    const deliveryRun = await base44.entities.DeliveryRun.read(delivery_run_id);
    if (!deliveryRun) {
      return Response.json({ error: 'DeliveryRun not found' }, { status: 404 });
    }

    const content = deliveryRun.output_content || '';
    const checkpoints = [];
    let totalScore = 0;
    let checkCount = 0;

    // ========== CHECKPOINT 1: SPELL CHECK ==========
    const spellCheckPrompt = `
Revisa este texto y encuentra TODOS los errores de ortografía, acentos y gramática.
Retorna como JSON.

TEXTO:
${content}

Formato:
{
  "errors": [
    {
      "word": "palabra con error",
      "position": 0,
      "suggestion": "palabra correcta",
      "severity": "low|medium|high"
    }
  ],
  "total_errors": 0
}

Si no hay errores, retorna {"errors": [], "total_errors": 0}
    `;

    const spellResponse = await base44.integrations.Core.InvokeLLM({
      prompt: spellCheckPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                word: { type: 'string' },
                position: { type: 'number' },
                suggestion: { type: 'string' },
                severity: { type: 'string' }
              }
            }
          },
          total_errors: { type: 'number' }
        }
      }
    });

    const spellScore = Math.max(0, 1 - (spellResponse.total_errors || 0) * 0.1);
    const spellCheckpoint = {
      checkpoint_type: 'spell_check',
      status: spellResponse.total_errors > 3 ? 'failed' : 'passed',
      issues: (spellResponse.errors || []).slice(0, 5).map(e => ({
        type: 'spelling',
        severity: e.severity || 'low',
        message: `Error: "${e.word}"`,
        suggestion: e.suggestion
      })),
      score: spellScore,
      checked_by: 'system'
    };
    checkpoints.push(spellCheckpoint);
    totalScore += spellScore;
    checkCount++;

    // ========== CHECKPOINT 2: FORMAT VALIDATION ==========
    const markdownSections = content.split('#').filter(s => s.trim()).length;
    const hasLinks = /\[.+\]\(.+\)/.test(content);
    const wordCount = content.split(/\s+/).length;

    const formatIssues = [];
    if (markdownSections < 3) formatIssues.push({
      type: 'structure',
      severity: 'medium',
      message: 'Menos de 3 secciones principales',
      suggestion: 'Agregar más secciones (ej: Objetivos, Resultados, Próximos pasos)'
    });
    if (wordCount < 500) formatIssues.push({
      type: 'length',
      severity: 'high',
      message: `Documento muy corto (${wordCount} palabras)`,
      suggestion: 'Expandir contenido a mínimo 500 palabras'
    });
    if (wordCount > 5000) formatIssues.push({
      type: 'length',
      severity: 'low',
      message: `Documento muy largo (${wordCount} palabras)`,
      suggestion: 'Considerar resumir a máximo 5000 palabras'
    });

    const formatScore = formatIssues.length === 0 ? 1 : Math.max(0, 1 - formatIssues.length * 0.15);
    const formatCheckpoint = {
      checkpoint_type: 'format_validation',
      status: formatIssues.length > 2 ? 'failed' : 'passed',
      issues: formatIssues,
      score: formatScore,
      checked_by: 'system'
    };
    checkpoints.push(formatCheckpoint);
    totalScore += formatScore;
    checkCount++;

    // ========== CHECKPOINT 3: COMPLETENESS ==========
    const requiredKeywords = ['objetivo', 'decisiones', 'acción', 'próximo'];
    const missingKeywords = requiredKeywords.filter(kw => !content.toLowerCase().includes(kw));
    
    const completenessScore = Math.max(0, 1 - (missingKeywords.length * 0.25));
    const completenessIssues = missingKeywords.map(kw => ({
      type: 'missing_section',
      severity: 'medium',
      message: `No se menciona: "${kw}"`,
      suggestion: `Agregar sección sobre ${kw}`
    }));

    const completenessCheckpoint = {
      checkpoint_type: 'completeness',
      status: completenessScore > 0.7 ? 'passed' : 'review_required',
      issues: completenessIssues,
      score: completenessScore,
      checked_by: 'system'
    };
    checkpoints.push(completenessCheckpoint);
    totalScore += completenessScore;
    checkCount++;

    // ========== CHECKPOINT 4: LOGIC (LLM coherence) ==========
    const logicPrompt = `
Analiza si este texto es coherente, lógico y profesional.
Retorna score 0-1 y lista de issues.

TEXTO:
${content}

Responde SOLO con JSON:
{
  "score": 0.85,
  "is_coherent": true,
  "issues": [
    {
      "type": "contradiction|unclear|weak_structure",
      "message": "descripción"
    }
  ]
}
    `;

    const logicResponse = await base44.integrations.Core.InvokeLLM({
      prompt: logicPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          score: { type: 'number' },
          is_coherent: { type: 'boolean' },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    });

    const logicScore = logicResponse.score || 0.8;
    const logicCheckpoint = {
      checkpoint_type: 'logic',
      status: logicScore > 0.7 ? 'passed' : 'review_required',
      issues: (logicResponse.issues || []).slice(0, 3).map(i => ({
        type: i.type,
        severity: 'medium',
        message: i.message,
        suggestion: 'Revisar y mejorar coherencia'
      })),
      score: logicScore,
      checked_by: 'system'
    };
    checkpoints.push(logicCheckpoint);
    totalScore += logicScore;
    checkCount++;

    // ========== CHECKPOINT 5: COMPLIANCE ==========
    const complianceIssues = [];
    if (!content.includes('@')) {
      complianceIssues.push({
        type: 'missing_signature',
        severity: 'low',
        message: 'Sin firma de consultor',
        suggestion: 'Agregar email/nombre del responsable'
      });
    }

    const complianceScore = complianceIssues.length === 0 ? 1 : 0.8;
    const complianceCheckpoint = {
      checkpoint_type: 'compliance',
      status: 'passed',
      issues: complianceIssues,
      score: complianceScore,
      checked_by: 'system'
    };
    checkpoints.push(complianceCheckpoint);
    totalScore += complianceScore;
    checkCount++;

    // ========== SUMMARY ==========
    const overallScore = checkCount > 0 ? totalScore / checkCount : 0;
    const overallStatus = overallScore > 0.85 ? 'READY_TO_SEND' : overallScore > 0.7 ? 'REVIEW_NEEDED' : 'FAILED';

    // Create DeliveryCheckpoint records
    for (const checkpoint of checkpoints) {
      await base44.entities.DeliveryCheckpoint.create({
        delivery_run_id,
        ...checkpoint
      });
    }

    // Update DeliveryRun quality score
    await base44.entities.DeliveryRun.update(delivery_run_id, {
      quality_score: overallScore,
      delivery_checkpoints: checkpoints.map((_, i) => `cp_${i}`)
    });

    return Response.json({
      overall_status: overallStatus,
      quality_score: overallScore,
      checkpoints,
      recommendations: checkpoints
        .filter(cp => cp.issues.length > 0)
        .flatMap(cp => cp.issues.slice(0, 2))
    });

  } catch (error) {
    console.error('QA validation error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});