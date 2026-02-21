import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Clock, Zap } from 'lucide-react';

export default function DeliveryStatusBadge({ status, quality_score }) {
  const statusConfig = {
    running: {
      icon: Clock,
      color: 'bg-blue-100 text-blue-800',
      label: 'En progreso',
      animate: true
    },
    success: {
      icon: CheckCircle2,
      color: 'bg-green-100 text-green-800',
      label: 'Completado'
    },
    failed: {
      icon: AlertCircle,
      color: 'bg-red-100 text-red-800',
      label: 'Error'
    },
    review_pending: {
      icon: AlertCircle,
      color: 'bg-yellow-100 text-yellow-800',
      label: 'Revisión pendiente'
    },
    delivered: {
      icon: Zap,
      color: 'bg-green-100 text-green-800',
      label: 'Enviado'
    }
  };

  const config = statusConfig[status] || statusConfig.running;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className={`w-3 h-3 ${config.animate ? 'animate-spin' : ''}`} />
        {config.label}
      </Badge>
      {quality_score !== undefined && (
        <span className="text-xs font-semibold text-gray-600">
          {(quality_score * 100).toFixed(0)}%
        </span>
      )}
    </div>
  );
}