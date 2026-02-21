import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Clock, Download, Send, RefreshCw, Zap } from 'lucide-react';

export default function DeliveryCard({ delivery, onValidate, onDownload, onSend, onRetry, isLoading }) {
  const statusConfig = {
    running: { icon: Clock, color: 'bg-blue-100 text-blue-800', label: 'En progreso', textColor: 'text-blue-600' },
    success: { icon: CheckCircle2, color: 'bg-green-100 text-green-800', label: 'Listo', textColor: 'text-green-600' },
    failed: { icon: AlertCircle, color: 'bg-red-100 text-red-800', label: 'Error', textColor: 'text-red-600' },
    review_pending: { icon: AlertCircle, color: 'bg-yellow-100 text-yellow-800', label: 'Requiere revisión', textColor: 'text-yellow-600' },
    delivered: { icon: CheckCircle2, color: 'bg-green-100 text-green-800', label: 'Enviado', textColor: 'text-green-600' }
  };

  const config = statusConfig[delivery.status] || statusConfig.running;
  const StatusIcon = config.icon;

  const qualityColor = (score) => {
    if (!score) return 'text-gray-500';
    if (score >= 0.9) return 'text-green-600';
    if (score >= 0.75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const qualityLabel = (score) => {
    if (!score) return 'Sin evaluar';
    if (score >= 0.9) return 'Excelente';
    if (score >= 0.75) return 'Bueno';
    return 'Revisar';
  };

  return (
    <Card className="hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusIcon className={`w-5 h-5 flex-shrink-0 ${config.textColor}`} />
              <CardTitle className="text-base truncate">Reunión #{delivery.trigger_entity_id.substring(0, 8)}</CardTitle>
              <Badge className={config.color}>{config.label}</Badge>
            </div>
            <p className="text-xs text-gray-500">
              {new Date(delivery.created_date).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            {delivery.quality_score !== undefined && (
              <div>
                <p className={`text-sm font-semibold ${qualityColor(delivery.quality_score)}`}>
                  {(delivery.quality_score * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-gray-500">{qualityLabel(delivery.quality_score)}</p>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Steps Timeline */}
        {delivery.steps_executed && delivery.steps_executed.length > 0 && (
          <div className="space-y-1 text-xs">
            {delivery.steps_executed.slice(-3).map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {step.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
                {step.status === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />}
                {step.status === 'running' && <Clock className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 animate-spin" />}
                <span className="text-gray-600 truncate">{step.step_name}</span>
                {step.error && <span className="text-red-600 text-xs ml-auto flex-shrink-0">Error</span>}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-gray-200 flex-wrap">
          {delivery.status === 'success' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onValidate(delivery.id)}
                disabled={isLoading}
                className="text-xs"
              >
                <Zap className="w-3 h-3 mr-1" />
                Validar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDownload(delivery.id)}
                disabled={isLoading}
                className="text-xs"
              >
                <Download className="w-3 h-3 mr-1" />
                Descargar
              </Button>
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs"
                onClick={() => onSend(delivery.id)}
                disabled={isLoading}
              >
                <Send className="w-3 h-3 mr-1" />
                Enviar
              </Button>
            </>
          )}
          {delivery.status === 'failed' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRetry(delivery.id)}
              disabled={isLoading}
              className="text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Reintentar
            </Button>
          )}
          {delivery.status === 'review_pending' && (
            <Badge className="bg-yellow-100 text-yellow-800 text-xs">
              Requiere validación manual
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}