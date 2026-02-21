import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Test the complete delivery flow end-to-end
 * Creates a test meeting → generates report → validates QA → prepares for send
 * Useful for debugging the orchestration pipeline
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { action, meeting_id, template_id } = await req.json();

    console.log(`[testDeliveryFlow] Starting test flow - action: ${action}`);

    // ========== STEP 1: CREATE TEST DATA ==========
    if (action === 'setup') {
      console.log('[testDeliveryFlow:setup] Creating test data...');

      // Create test client
      const client = await base44.entities.Client.create({
        name: `Test Client ${Date.now()}`,
        industry: 'Technology',
        contact_email: 'test@example.com',
        status: 'active'
      });
      console.log(`[testDeliveryFlow:setup] Client created: ${client.id}`);

      // Create test project
      const project = await base44.entities.Project.create({
        client_id: client.id,
        name: `Test Project ${Date.now()}`,
        description: 'Test project for delivery flow validation',
        status: 'active',
        progress: 0
      });
      console.log(`[testDeliveryFlow:setup] Project created: ${project.id}`);

      // Create test meeting
      const testMeeting = await base44.entities.Meeting.create({
        client_id: client.id,
        project_id: project.id,
        title: 'Test Kickoff Meeting',
        date: new Date().toISOString(),
        objective: 'Discutir estrategia y scope del proyecto',
        organizer_email: user.email,
        participants: [
          { email: 'participant1@example.com', name: 'Juan García', role: 'PM' },
          { email: user.email, name: user.full_name, role: 'Consultor' }
        ],
        source_type: 'transcript_upload',
        status: 'transcribed'
      });
      console.log(`[testDeliveryFlow:setup] Meeting created: ${testMeeting.id}`);

      // Create test transcript
      const transcript = await base44.entities.Transcript.create({
        meeting_id: testMeeting.id,
        client_id: client.id,
        project_id: project.id,
        status: 'completed',
        full_text: `
JUAN: Buenos días, gracias por organizar esta reunión de kickoff.
CONSULTOR: Claro, es importante alinear expectativas desde el inicio.
JUAN: Nuestro objetivo principal es modernizar la infraestructura de datos.
CONSULTOR: Entendido. ¿Cuál es el timeline?
JUAN: Necesitamos estar listos en 3 meses. Ya identificamos los riesgos principales: integración con sistemas legacy.
CONSULTOR: Tomaré nota. Próximos pasos: hacer diagrama de arquitectura y validar con tu equipo.
JUAN: Perfecto. También necesitamos entrenar al equipo en nuevas tecnologías.
CONSULTOR: Agregaré eso al plan de capacitación. ¿Presupuesto confirmado?
JUAN: Sí, $50k asignados. Queremos empezar fase 1 en 2 semanas.
CONSULTOR: Excelente. Confirmaré acceso a infraestructura y enviaremos propuesta técnica por email.
        `,
        source: 'manual_upload',
        has_timeline: true
      });
      console.log(`[testDeliveryFlow:setup] Transcript created: ${transcript.id}`);

      // Get default template
      const templates = await base44.entities.DeliveryTemplate.filter({
        is_default: true,
        delivery_type: 'informe'
      }, '-created_date', 1);

      const testTemplate = templates[0] || {
        id: 'default-template',
        name: 'Default Informe',
        delivery_type: 'informe',
        sections: [
          { title: 'Resumen Ejecutivo', order: 1, required: true },
          { title: 'Contexto y Objetivos', order: 2, required: true },
          { title: 'Decisiones y Compromisos', order: 3, required: true },
          { title: 'Próximos Pasos', order: 4, required: true }
        ]
      };

      return Response.json({
        success: true,
        client_id: client.id,
        project_id: project.id,
        meeting_id: testMeeting.id,
        transcript_id: transcript.id,
        template_id: testTemplate.id,
        message: 'Test data created. Use meeting_id and template_id for next step.'
      });
    }

    // ========== STEP 2: RUN FULL DELIVERY FLOW ==========
    if (action === 'run_full_flow' && meeting_id && template_id) {
      console.log(`[testDeliveryFlow:run_full_flow] Running delivery for meeting ${meeting_id}`);

      const startTime = Date.now();
      const steps = [];

      try {
        // Invoke orchestrateMeetingDelivery
        steps.push({ step: 'orchestrate_delivery', status: 'running', timestamp: new Date().toISOString() });

        const orchestrateRes = await base44.asServiceRole.functions.invoke('orchestrateMeetingDelivery', {
          meeting_id,
          template_id
        });

        console.log('[testDeliveryFlow] Orchestrate response:', orchestrateRes);

        if (!orchestrateRes.success) {
          throw new Error(`Orchestration failed: ${orchestrateRes.error}`);
        }

        steps[steps.length - 1].status = 'success';
        steps[steps.length - 1].delivery_run_id = orchestrateRes.delivery_run_id;

        // Validate QA
        steps.push({ step: 'validate_qa', status: 'running', timestamp: new Date().toISOString() });

        const qaRes = await base44.asServiceRole.functions.invoke('validateDeliveryQA', {
          delivery_run_id: orchestrateRes.delivery_run_id
        });

        steps[steps.length - 1].status = 'success';
        steps[steps.length - 1].qa_score = qaRes.quality_score;
        steps[steps.length - 1].qa_status = qaRes.overall_status;

        const totalTime = Date.now() - startTime;

        console.log(`[testDeliveryFlow:run_full_flow] Flow completed in ${totalTime}ms`);

        return Response.json({
          success: true,
          delivery_run_id: orchestrateRes.delivery_run_id,
          steps,
          total_time_ms: totalTime,
          qa_score: qaRes.quality_score,
          qa_status: qaRes.overall_status,
          report_preview: orchestrateRes.report_content?.substring(0, 300) + '...'
        });

      } catch (error) {
        console.error('[testDeliveryFlow:run_full_flow] Flow failed:', error);
        steps[steps.length - 1].status = 'failed';
        steps[steps.length - 1].error = error.message;

        return Response.json({
          success: false,
          error: error.message,
          steps,
          total_time_ms: Date.now() - startTime
        }, { status: 500 });
      }
    }

    // ========== STEP 3: CHECK DELIVERY STATUS ==========
    if (action === 'check_status' && meeting_id) {
      console.log(`[testDeliveryFlow:check_status] Checking status for meeting ${meeting_id}`);

      const deliveries = await base44.entities.DeliveryRun.filter({
        trigger_entity_id: meeting_id
      }, '-created_date', 1);

      if (deliveries.length === 0) {
        return Response.json({
          success: false,
          error: 'No deliveries found for this meeting'
        });
      }

      const delivery = deliveries[0];
      const checkpoints = await base44.entities.DeliveryCheckpoint.filter({
        delivery_run_id: delivery.id
      });

      return Response.json({
        success: true,
        delivery: {
          id: delivery.id,
          status: delivery.status,
          quality_score: delivery.quality_score,
          total_time_ms: delivery.total_time_ms,
          created_date: delivery.created_date,
          steps_executed: delivery.steps_executed,
          output_file_url: delivery.output_file_url
        },
        checkpoints: checkpoints.map(cp => ({
          type: cp.checkpoint_type,
          status: cp.status,
          score: cp.score,
          issues_count: cp.issues?.length || 0
        }))
      });
    }

    return Response.json(
      { error: 'Invalid action. Use: setup, run_full_flow, or check_status' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[testDeliveryFlow] Unhandled error:', error);
    return Response.json(
      { error: error.message, step: 'test_flow' },
      { status: 500 }
    );
  }
});