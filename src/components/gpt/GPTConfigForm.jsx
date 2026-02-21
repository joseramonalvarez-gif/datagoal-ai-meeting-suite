import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';

export default function GPTConfigForm({ config, onSave, onCancel }) {
  const [formData, setFormData] = useState(config || {
    name: '',
    description: '',
    system_prompt: '',
    output_type: 'strategic_analysis',
    model_name: 'gpt-4-turbo',
    temperature: 0.7,
    is_active: true,
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.description || !formData.system_prompt) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="p-6 border-[#B7CAC9]/30">
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm font-semibold text-[#1B2731]">Nombre *</label>
            <Input
              placeholder="ej: Pakito McKensey"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-semibold text-[#1B2731]">Descripción *</label>
            <Input
              placeholder="ej: Análisis estratégico de reuniones"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Output Type */}
          <div>
            <label className="text-sm font-semibold text-[#1B2731]">Tipo de Salida *</label>
            <Select value={formData.output_type} onValueChange={(value) => handleChange('output_type', value)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strategic_analysis">Análisis Estratégico</SelectItem>
                <SelectItem value="copy_content">Contenido de Copywriting</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* System Prompt */}
          <div>
            <label className="text-sm font-semibold text-[#1B2731]">System Prompt *</label>
            <Textarea
              placeholder="Define el comportamiento y expertise del modelo..."
              value={formData.system_prompt}
              onChange={(e) => handleChange('system_prompt', e.target.value)}
              className="mt-1 min-h-[120px]"
            />
          </div>

          {/* Model Name */}
          <div>
            <label className="text-sm font-semibold text-[#1B2731]">Modelo OpenAI</label>
            <Select value={formData.model_name} onValueChange={(value) => handleChange('model_name', value)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                <SelectItem value="gpt-4">GPT-4</SelectItem>
                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Temperature */}
          <div>
            <label className="text-sm font-semibold text-[#1B2731]">
              Temperatura: {formData.temperature.toFixed(1)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={formData.temperature}
              onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
              className="w-full mt-1"
            />
            <p className="text-xs text-[#3E4C59] mt-1">
              Menor = más determinístico, Mayor = más creativo
            </p>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => handleChange('is_active', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-[#1B2731]">
              Activado
            </label>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="flex-1 bg-[#33A19A] hover:bg-[#2A857F]"
          >
            {config ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </Card>
    </form>
  );
}