import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@4.0.0';

/**
 * Generate PDF from delivery content
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { delivery_run_id, include_qa = true } = await req.json();

    if (!delivery_run_id) {
      return Response.json({ error: 'delivery_run_id required' }, { status: 400 });
    }

    console.log(`[generateDeliveryPDF] Generating PDF for ${delivery_run_id}`);

    const delivery = await base44.entities.DeliveryRun.get(delivery_run_id);
    if (!delivery) {
      return Response.json({ error: 'Delivery not found' }, { status: 404 });
    }

    if (!delivery.output_content) {
      return Response.json({ error: 'No content to generate PDF' }, { status: 400 });
    }

    const meeting = await base44.entities.Meeting.get(delivery.trigger_entity_id);
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let yPosition = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const maxWidth = pageWidth - 2 * margin;

    // Title
    doc.setFontSize(18);
    doc.setTextColor(27, 39, 49);
    doc.text('INFORME DE ENTREGA', margin, yPosition);
    yPosition += 10;

    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(62, 76, 89);
    if (meeting) {
      doc.text(`Reunión: ${meeting.title}`, margin, yPosition);
      yPosition += 5;
    }
    doc.text(`Fecha: ${new Date(delivery.created_date).toLocaleString('es-ES')}`, margin, yPosition);
    yPosition += 5;
    doc.text(`Estado: ${delivery.status}`, margin, yPosition);
    yPosition += 5;
    if (delivery.quality_score) {
      doc.text(`Calidad: ${(delivery.quality_score * 100).toFixed(1)}%`, margin, yPosition);
      yPosition += 5;
    }

    // Content
    doc.setFontSize(11);
    doc.setTextColor(27, 39, 49);
    yPosition += 5;

    const lines = doc.splitTextToSize(delivery.output_content, maxWidth);
    
    for (const line of lines) {
      if (yPosition > pageHeight - margin - 10) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += 5;
    }

    // QA Summary
    if (include_qa && delivery.delivery_checkpoints && delivery.delivery_checkpoints.length > 0) {
      yPosition += 10;
      if (yPosition > pageHeight - margin - 20) {
        doc.addPage();
        yPosition = margin;
      }

      doc.setFontSize(14);
      doc.setTextColor(51, 161, 154);
      doc.text('VALIDACIÓN QA', margin, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setTextColor(62, 76, 89);

      for (const checkpointId of delivery.delivery_checkpoints) {
        try {
          const checkpoint = await base44.entities.DeliveryCheckpoint.get(checkpointId);
          if (checkpoint) {
            doc.text(`✓ ${checkpoint.checkpoint_type}: ${checkpoint.status}`, margin + 2, yPosition);
            yPosition += 4;
          }
        } catch (e) {
          console.log(`Checkpoint ${checkpointId} not found`);
        }
      }
    }

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=delivery_${delivery.id.substring(0, 8)}.pdf`
      }
    });

  } catch (error) {
    console.error('[generateDeliveryPDF] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});