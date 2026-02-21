import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Copy, Search, Filter, Eye } from 'lucide-react';

const PROMPT_TYPES = [
  { value: 'report_generation', label: 'Generación de Reportes' },
  { value: 'task_extraction', label: 'Extracción de Tareas' },
  { value: 'email_generation', label: 'Generación de Emails' },
  { value: 'summary', label: 'Resumen' },
  { value: 'qa_check', label: 'Validación QA' },
  { value: 'semantic_search', label: 'Búsqueda Semántica' }
];

export default function PromptTemplateManager() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    prompt_type: 'report_generation',
    content: '',
    system_message: '',
    model: 'gpt-4-turbo',
    temperature: 0.7,
    max_tokens: 2000
  });

  const queryClient = useQueryClient();

  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ['prompts'],
    queryFn: () => base44.entities.PromptTemplate.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PromptTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PromptTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      setIsEditing(false);
      setSelectedPrompt(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PromptTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      setSelectedPrompt(null);
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isEditing && selectedPrompt) {
      await updateMutation.mutateAsync({
        id: selectedPrompt.id,
        data: formData
      });
    } else {
      await createMutation.mutateAsync(formData);
    }
  };

  const handleEdit = (prompt) => {
    setSelectedPrompt(prompt);
    setFormData(prompt);
    setIsEditing(true);
  };

  const handleDuplicate = async (prompt) => {
    const newPrompt = {
      ...prompt,
      name: `${prompt.name} (Copia)`,
      version: (prompt.version || 1) + 1,
      is_default: false
    };
    delete newPrompt.id;
    delete newPrompt.created_date;
    delete newPrompt.updated_date;
    await createMutation.mutateAsync(newPrompt);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      prompt_type: 'report_generation',
      content: '',
      system_message: '',
      model: 'gpt-4-turbo',
      temperature: 0.7,
      max_tokens: 2000
    });
    setSelectedPrompt(null);
    setIsEditing(false);
  };

  const filteredPrompts = prompts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.content.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || p.prompt_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const typeLabel = (type) => PROMPT_TYPES.find(t => t.value === type)?.label || type;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#1B2731] font-heading">Gestor de Prompts</h1>
        <p className="text-[#3E4C59] mt-1">Crea y gestiona templates de prompts para LLMs</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <Card className="lg:col-span-1 h-fit sticky top-6">
          <CardHeader>
            <CardTitle className="text-lg">{isEditing ? 'Editar Prompt' : 'Nuevo Prompt'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#1B2731]">Nombre</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ej: Informe Kickoff v1"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#1B2731]">Tipo</label>
                <Select value={formData.prompt_type} onValueChange={(v) => setFormData({ ...formData, prompt_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROMPT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-[#1B2731]">Modelo</label>
                <Select value={formData.model} onValueChange={(v) => setFormData({ ...formData, model: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium text-[#1B2731]">Temperature</label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#1B2731]">Max Tokens</label>
                  <Input
                    type="number"
                    value={formData.max_tokens}
                    onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#1B2731]">System Message</label>
                <Textarea
                  value={formData.system_message}
                  onChange={(e) => setFormData({ ...formData, system_message: e.target.value })}
                  placeholder="Instrucciones para el modelo..."
                  className="h-24"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#1B2731]">Contenido del Prompt</label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Usa {{variable}} para placeholders..."
                  className="h-32 font-mono text-xs"
                />
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
          {/* Filters */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B7CAC9]" />
              <Input
                placeholder="Buscar prompts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {PROMPT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prompts Grid */}
          {isLoading ? (
            <div className="text-center py-8 text-[#3E4C59]">Cargando...</div>
          ) : filteredPrompts.length === 0 ? (
            <Card>
              <CardContent className="pt-8 text-center text-[#3E4C59]">
                <p>No hay prompts que coincidan con los filtros</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredPrompts.map(prompt => (
                <Card key={prompt.id} className="hover:shadow-md transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">{prompt.name}</CardTitle>
                        <CardDescription className="text-xs mt-1">v{prompt.version}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={prompt.is_default ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {prompt.is_default ? '⭐ Default' : 'Custom'}
                        </Badge>
                        <Badge className="bg-blue-100 text-blue-800">{typeLabel(prompt.prompt_type)}</Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="text-sm text-[#3E4C59] bg-[#FFFAF3] p-3 rounded border border-[#B7CAC9]/30 max-h-24 overflow-hidden">
                      {prompt.content.substring(0, 200)}...
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-[#3E4C59]">
                      <div>Modelo: <strong>{prompt.model}</strong></div>
                      <div>Temp: <strong>{prompt.temperature}</strong></div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-[#B7CAC9]/30">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(prompt)}
                        className="flex-1 text-xs"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDuplicate(prompt)}
                        className="flex-1 text-xs"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Duplicar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(prompt.id)}
                        className="flex-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}