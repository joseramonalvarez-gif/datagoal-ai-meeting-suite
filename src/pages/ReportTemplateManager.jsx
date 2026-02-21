import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, FileText, Copy } from 'lucide-react';

const DELIVERY_TYPES = [
  { value: 'informe', label: 'Informe' },
  { value: 'propuesta', label: 'Propuesta' },
  { value: 'caso_estudio', label: 'Caso Estudio' },
  { value: 'acta', label: 'Acta de Reunión' },
  { value: 'summary', label: 'Resumen Ejecutivo' }
];

const TONES = [
  { value: 'formal', label: 'Formal' },
  { value: 'ejecutivo', label: 'Ejecutivo' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'operativo', label: 'Operativo' }
];

export default function ReportTemplateManager() {
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [sections, setSections] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    delivery_type: 'informe',
    description: '',
    tone: 'ejecutivo',
    include_cover: true,
    include_toc: false,
    include_qa_summary: true,
    is_active: true
  });

  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => base44.entities.DeliveryTemplate.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DeliveryTemplate.create({
      ...data,
      sections: sections
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DeliveryTemplate.update(id, {
      ...data,
      sections: sections
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsEditing(false);
      setSelectedTemplate(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DeliveryTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setSelectedTemplate(null);
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isEditing && selectedTemplate) {
      await updateMutation.mutateAsync({
        id: selectedTemplate.id,
        data: formData
      });
    } else {
      await createMutation.mutateAsync(formData);
    }
  };

  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setFormData(template);
    setSections(template.sections || []);
    setIsEditing(true);
  };

  const addSection = () => {
    setSections([...sections, {
      title: '',
      prompt_hint: '',
      order: sections.length + 1,
      required: true,
      min_words: 50
    }]);
  };

  const updateSection = (idx, field, value) => {
    const updated = [...sections];
    updated[idx][field] = value;
    setSections(updated);
  };

  const removeSection = (idx) => {
    setSections(sections.filter((_, i) => i !== idx));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      delivery_type: 'informe',
      description: '',
      tone: 'ejecutivo',
      include_cover: true,
      include_toc: false,
      include_qa_summary: true,
      is_active: true
    });
    setSections([]);
    setSelectedTemplate(null);
    setIsEditing(false);
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1B2731] font-heading">Templates de Entregas</h1>
        <p className="text-[#3E4C59] mt-1">Crea y gestiona templates para generar reportes automatizados</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <Card className="lg:col-span-1 h-fit sticky top-6">
          <CardHeader>
            <CardTitle className="text-lg">{isEditing ? 'Editar' : 'Nuevo'} Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nombre</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ej: Informe Kickoff"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium">Tipo de Entrega</label>
                <Select
                  value={formData.delivery_type}
                  onValueChange={(v) => setFormData({ ...formData, delivery_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERY_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Tono</label>
                <Select
                  value={formData.tone}
                  onValueChange={(v) => setFormData({ ...formData, tone: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Descripción</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe el propósito de este template"
                  className="h-20"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={formData.include_cover}
                    onCheckedChange={(c) => setFormData({ ...formData, include_cover: c })}
                  />
                  <span className="text-sm">Incluir portada</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={formData.include_toc}
                    onCheckedChange={(c) => setFormData({ ...formData, include_toc: c })}
                  />
                  <span className="text-sm">Tabla de contenidos</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={formData.include_qa_summary}
                    onCheckedChange={(c) => setFormData({ ...formData, include_qa_summary: c })}
                  />
                  <span className="text-sm">Validación QA automática</span>
                </label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1 bg-[#33A19A] hover:bg-[#2A857F]">
                  {isEditing ? 'Actualizar' : 'Crear'}
                </Button>
                {isEditing && (
                  <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <div className="lg:col-span-2 space-y-4">
          <Input
            placeholder="Buscar templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {isLoading ? (
            <div className="text-center py-8">Cargando...</div>
          ) : filteredTemplates.length === 0 ? (
            <Card>
              <CardContent className="pt-8 text-center text-[#3E4C59]">
                No hay templates
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredTemplates.map(template => (
                <Card key={template.id} className="hover:shadow-md transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#33A19A]" />
                          {template.name}
                        </CardTitle>
                        <CardDescription className="text-sm mt-1">
                          {template.description}
                        </CardDescription>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800">
                        {DELIVERY_TYPES.find(t => t.value === template.delivery_type)?.label}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="text-xs text-[#3E4C59] space-y-1">
                      <div>📋 {template.sections?.length || 0} secciones</div>
                      <div>🎯 Tono: <strong>{template.tone}</strong></div>
                      <div>✅ Usado {template.usage_count || 0} veces</div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-[#B7CAC9]/30">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(template)}
                        className="flex-1 text-xs"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(template.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sections Editor */}
      {(isEditing || sections.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Secciones del Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sections.map((section, idx) => (
              <div key={idx} className="p-4 border border-[#B7CAC9]/30 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-sm">Sección {idx + 1}</h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeSection(idx)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Título"
                    value={section.title || ''}
                    onChange={(e) => updateSection(idx, 'title', e.target.value)}
                    required
                  />
                  <Input
                    type="number"
                    min="50"
                    placeholder="Mín. palabras"
                    value={section.min_words || 50}
                    onChange={(e) => updateSection(idx, 'min_words', parseInt(e.target.value))}
                  />
                </div>

                <Textarea
                  placeholder="Instrucción para el LLM"
                  value={section.prompt_hint || ''}
                  onChange={(e) => updateSection(idx, 'prompt_hint', e.target.value)}
                  className="h-20 text-xs"
                />

                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={section.required !== false}
                    onCheckedChange={(c) => updateSection(idx, 'required', c)}
                  />
                  <span className="text-sm">Sección obligatoria</span>
                </label>
              </div>
            ))}

            <Button onClick={addSection} variant="outline" className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Añadir Sección
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}