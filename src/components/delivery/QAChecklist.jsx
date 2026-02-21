import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, AlertTriangle, XCircle } from 'lucide-react';

export default function QAChecklist({ checkpoints = [], overallStatus, overallScore, onApprove, onReject, isLoading }) {
  const [expandedCheckpoint, setExpandedCheckpoint] = useState(null);

  const severityConfig = {
    low: { icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
    medium: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    high: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
    critical: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' }
  };

  const statusBadge = {
    READY_TO_SEND: { label: '✅ Listo para enviar', color: 'bg-green-100 text-green-800' },
    REVIEW_NEEDED: { label: '⚠️ Requiere revisión', color: 'bg-yellow-100 text-yellow-800' },
    FAILED: { label: '❌ No aprobado', color: 'bg-red-100 text-red-800' }
  };

  const currentBadge = statusBadge[overallStatus] || statusBadge.REVIEW_NEEDED;

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <Card className="border-2 border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Validación de Calidad</CardTitle>
            <div>
              <Badge className={currentBadge.color}>{currentBadge.label}</Badge>
              <p className="text-sm font-semibold text-gray-600 mt-1">
                Score: {(overallScore * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all ${
                overallScore >= 0.9
                  ? 'bg-green-600'
                  : overallScore >= 0.75
                  ? 'bg-yellow-600'
                  : 'bg-red-600'
              }`}
              style={{ width: `${Math.min(100, overallScore * 100)}%` }}
            />
          </div>

          {/* Checkpoints */}
          <div className="space-y-2">
            {checkpoints.map((checkpoint, idx) => {
              const SeverityIcon = severityConfig[checkpoint.issues?.[0]?.severity]?.icon || CheckCircle2;
              const isExpanded = expandedCheckpoint === idx;

              return (
                <div
                  key={idx}
                  className={`border rounded-lg overflow-hidden transition-all ${
                    checkpoint.status === 'passed'
                      ? 'border-green-200 bg-green-50'
                      : checkpoint.status === 'failed'
                      ? 'border-red-200 bg-red-50'
                      : 'border-yellow-200 bg-yellow-50'
                  }`}
                >
                  <button
                    onClick={() => setExpandedCheckpoint(isExpanded ? null : idx)}
                    className="w-full p-3 flex items-center justify-between hover:bg-black/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {checkpoint.status === 'passed' && (
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      )}
                      {checkpoint.status === 'failed' && (
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      )}
                      {checkpoint.status === 'review_required' && (
                        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                      )}
                      <div className="text-left">
                        <p className="font-medium text-sm text-gray-800">
                          {checkpoint.checkpoint_type.replace(/_/g, ' ').charAt(0).toUpperCase() +
                            checkpoint.checkpoint_type.replace(/_/g, ' ').slice(1)}
                        </p>
                        <p className="text-xs text-gray-600">
                          Score: {(checkpoint.score * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">{checkpoint.issues?.length || 0} issues</div>
                  </button>

                  {/* Expanded issues */}
                  {isExpanded && checkpoint.issues && checkpoint.issues.length > 0 && (
                    <div className="border-t border-gray-200 p-3 space-y-2 bg-white/50">
                      {checkpoint.issues.map((issue, issueIdx) => {
                        const config = severityConfig[issue.severity];
                        const Icon = config?.icon;

                        return (
                          <div key={issueIdx} className={`p-2 rounded ${config?.bg}`}>
                            <div className="flex items-start gap-2">
                              <Icon className={`w-4 h-4 ${config?.color} flex-shrink-0 mt-0.5`} />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-800">{issue.message}</p>
                                {issue.suggestion && (
                                  <p className="text-xs text-gray-600 mt-1">
                                    💡 <em>{issue.suggestion}</em>
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      {overallStatus === 'READY_TO_SEND' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800 mb-3">
            ✅ Este documento está listo para enviar. Todos los controles de calidad han pasado.
          </p>
          <Button className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={isLoading}>
            Continuar al envío
          </Button>
        </div>
      )}

      {overallStatus === 'REVIEW_NEEDED' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
          <p className="text-sm text-yellow-800">
            ⚠️ Este documento necesita revisión. Puedes enviarlo de todos modos o editar antes de enviar.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onApprove()}
              disabled={isLoading}
              className="flex-1"
            >
              Enviar de todas formas
            </Button>
            <Button
              variant="outline"
              onClick={() => onReject()}
              disabled={isLoading}
              className="flex-1"
            >
              Editar
            </Button>
          </div>
        </div>
      )}

      {overallStatus === 'FAILED' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800 mb-3">
            ❌ Este documento no puede enviarse. Por favor, corrija los problemas identificados arriba.
          </p>
          <Button
            variant="outline"
            onClick={() => onReject()}
            disabled={isLoading}
            className="w-full text-red-600 border-red-300 hover:bg-red-50"
          >
            Volver a editar
          </Button>
        </div>
      )}
    </div>
  );
}