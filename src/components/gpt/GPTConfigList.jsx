import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Edit, CheckCircle, Circle } from 'lucide-react';

const outputTypeLabels = {
  strategic_analysis: 'Análisis Estratégico',
  copy_content: 'Copywriting',
  custom: 'Personalizado',
};

const outputTypeColors = {
  strategic_analysis: 'bg-blue-100 text-blue-800',
  copy_content: 'bg-purple-100 text-purple-800',
  custom: 'bg-gray-100 text-gray-800',
};

export default function GPTConfigList({ configs, onEdit, onDelete }) {
  return (
    <div className="grid gap-3">
      {configs.length === 0 ? (
        <p className="text-center text-[#3E4C59] py-8">No hay configuraciones de GPT</p>
      ) : (
        configs.map((config) => (
          <Card key={config.id} className="p-4 border-[#B7CAC9]/30 hover:border-[#33A19A]/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-[#1B2731]">{config.name}</h4>
                  {config.is_active ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <Circle className="w-4 h-4 text-[#B7CAC9]" />
                  )}
                </div>
                <p className="text-sm text-[#3E4C59] mb-3">{config.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge className={`${outputTypeColors[config.output_type]} text-xs`}>
                    {outputTypeLabels[config.output_type]}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {config.model_name}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Temp: {config.temperature?.toFixed(1) || '0.7'}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onEdit(config)}
                  className="text-[#33A19A] hover:bg-[#E8F5F4]"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm('¿Eliminar esta configuración?')) {
                      onDelete(config.id);
                    }
                  }}
                  className="text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}