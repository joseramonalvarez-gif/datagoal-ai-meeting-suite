import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Rocket, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function DeliveryOrchestrator({ meeting, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [steps, setSteps] = useState([]);

  const handleGenerateDelivery = async () => {
    if (!meeting.id) {
      toast.error('No hay reunión seleccionada');
      return;
    }

    setLoading(true);
    setShowProgress(true);
    setSteps([
      { name: 'fetch_meeting', label: 'Cargando reunión...', status: 'running' },
      { name: 'transcribe_audio', label: 'Transcribiendo audio...', status: 'pending' },
      { name: 'analyze_with_gpt', label: 'Analizando con IA...', status: 'pending' },
      { name: 'generate_report', label: 'Generando informe...', status: 'pending' },
      { name: 'create_google_doc', label: 'Creando Google Doc...', status: 'pending' },
      { name: 'send_email', label: 'Enviando email...', status: 'pending' },
      { name: 'create_tasks', label: 'Creando tareas...', status: 'pending' },
    ]);

    try {
      const response = await base44.functions.invoke('orchestrateMeetingDelivery', {
        meeting_id: meeting.id,
      });

      if (response.data?.success) {
        // Actualizar estado de pasos
        const updatedSteps = steps.map(step => ({
          ...step,
          status: response.data.steps?.some(s => s.step_name === step.name) ? 'success' : 'pending'
        }));
        setSteps(updatedSteps);

        toast.success(response.data.summary);
        setTimeout(() => {
          setShowProgress(false);
          onSuccess?.();
        }, 2000);
      } else {
        throw new Error(response.data?.error || 'Error en la generación');
      }
    } catch (err) {
      const errorStep = steps.findIndex(s => s.status === 'running');
      if (errorStep >= 0) {
        const updatedSteps = steps.map((s, i) =>
          i === errorStep ? { ...s, status: 'failed', error: err.message } : s
        );
        setSteps(updatedSteps);
      }
      toast.error('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleGenerateDelivery}
        disabled={loading || !['transcribed', 'report_generated'].includes(meeting?.status)}
        className="bg-gradient-to-r from-[#33A19A] to-[#2A857F] hover:from-[#2A857F] hover:to-[#1E7168] text-white gap-2 font-semibold"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generando...
          </>
        ) : (
          <>
            <Rocket className="w-5 h-5" />
            🚀 Generar Entregable
          </>
        )}
      </Button>

      <Dialog open={showProgress} onOpenChange={setShowProgress}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Generando Entregable</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {steps.map((step, idx) => (
              <div key={step.name} className="flex items-start gap-3 p-3 bg-[#FFFAF3] rounded-lg border border-[#B7CAC9]/20">
                <div className="mt-0.5">
                  {step.status === 'success' && (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  )}
                  {step.status === 'running' && (
                    <Loader2 className="w-5 h-5 text-[#33A19A] animate-spin flex-shrink-0" />
                  )}
                  {step.status === 'failed' && (
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  )}
                  {step.status === 'pending' && (
                    <div className="w-5 h-5 rounded-full border-2 border-[#B7CAC9] flex-shrink-0" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1B2731]">{step.label}</p>
                  {step.error && (
                    <p className="text-xs text-red-600 mt-1">{step.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}