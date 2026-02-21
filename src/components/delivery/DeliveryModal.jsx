import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Download, Send, Eye } from 'lucide-react';
import QAChecklist from './QAChecklist';

export default function DeliveryModal({ delivery, checkpoints, onClose, onSend, onValidate, isLoading }) {
  const [showQA, setShowQA] = useState(false);

  if (!delivery) return null;

  const statusConfig = {
    running: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    review_pending: 'bg-yellow-100 text-yellow-800',
    delivered: 'bg-green-100 text-green-800'
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-3xl my-8">
        {/* Header */}
        <CardHeader className="flex flex-row items-start justify-between pb-3 border-b">
          <div className="flex-1">
            <CardTitle>Detalle de Entrega</CardTitle>
            <CardDescription className="text-xs mt-1">{delivery.id}</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 p-0 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Status and metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600 font-medium">Estado</p>
              <Badge className={statusConfig[delivery.status]}>
                {delivery.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <div>
              <p className="text-gray-600 font-medium">Calidad</p>
              {delivery.quality_score && (
                <p className="text-lg font-semibold text-gray-900">
                  {(delivery.quality_score * 100).toFixed(0)}%
                </p>
              )}
            </div>
            <div>
              <p className="text-gray-600 font-medium">Tiempo total</p>
              <p className="text-gray-900">{delivery.total_time_ms}ms</p>
            </div>
            <div>
              <p className="text-gray-600 font-medium">Creado</p>
              <p className="text-gray-900 text-xs">
                {new Date(delivery.created_date).toLocaleDateString('es-ES')}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex gap-4">
              <button
                onClick={() => setShowQA(false)}
                className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                  !showQA
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Eye className="w-4 h-4 inline mr-2" />
                Contenido
              </button>
              <button
                onClick={() => setShowQA(true)}
                className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                  showQA
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Control QA
              </button>
            </div>
          </div>

          {/* Content Preview */}
          {!showQA && (
            <div className="space-y-3">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-64 overflow-y-auto text-sm text-gray-700 leading-relaxed">
                {delivery.output_content ? (
                  delivery.output_content
                ) : (
                  <p className="text-gray-500">Sin contenido generado</p>
                )}
              </div>

              {delivery.steps_executed && delivery.steps_executed.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-gray-900 mb-2">Pasos ejecutados</h4>
                  <div className="space-y-1 text-xs">
                    {delivery.steps_executed.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <span className="text-gray-600">{step.step_name}</span>
                        <span className="ml-auto">
                          {step.status === 'success' && '✅'}
                          {step.status === 'failed' && '❌'}
                          {step.status === 'running' && '⏳'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* QA Checklist */}
          {showQA && checkpoints && (
            <QAChecklist
              checkpoints={checkpoints}
              overallStatus={
                delivery.quality_score >= 0.85
                  ? 'READY_TO_SEND'
                  : delivery.quality_score >= 0.7
                  ? 'REVIEW_NEEDED'
                  : 'FAILED'
              }
              overallScore={delivery.quality_score || 0}
              onApprove={() => {}}
              onReject={() => {}}
              isLoading={isLoading}
            />
          )}

          {/* Actions */}
          <div className="border-t pt-4 flex gap-2">
            {delivery.status === 'success' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => onValidate(delivery.id)}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Validar QA
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={isLoading}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar
                </Button>
                <Button
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => onSend(delivery.id)}
                  disabled={isLoading || !delivery.output_content}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Enviar
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}