import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Copy, Play, Lightbulb, Save } from 'lucide-react';

export default function SavedQueriesManager() {
  const queryClient = useQueryClient();
  const [newQuery, setNewQuery] = useState({ name: '', description: '', query_sql: '', category: 'custom', tags: [] });
  const [showDialog, setShowDialog] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const { data: savedQueries = [], isLoading } = useQuery({
    queryKey: ['savedQueries'],
    queryFn: () => base44.entities.SavedQuery.list('-updated_date', 100)
  });

  const createMutation = useMutation({
    mutationFn: (query) => base44.entities.SavedQuery.create(query),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedQueries'] });
      setNewQuery({ name: '', description: '', query_sql: '', category: 'custom', tags: [] });
      setShowDialog(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SavedQuery.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['savedQueries'] })
  });

  const getSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const response = await base44.functions.invoke('suggestQueriesByActivity', {});
      setSuggestions(response.data.suggestions || []);
    } catch (error) {
      console.error('Error getting suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const acceptSuggestion = (suggestion) => {
    setNewQuery({
      name: suggestion.name,
      description: suggestion.description,
      query_sql: suggestion.query_sql,
      category: suggestion.category,
      tags: []
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!newQuery.name || !newQuery.query_sql) return;
    createMutation.mutate(newQuery);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1B2731] font-heading">Consultas Guardadas</h1>
          <p className="text-[#3E4C59] mt-2">Gestiona y reutiliza tus consultas personalizadas</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={getSuggestions}
            disabled={loadingSuggestions}
            variant="outline"
            className="gap-2 border-[#33A19A] text-[#33A19A]"
          >
            <Lightbulb className="w-4 h-4" />
            {loadingSuggestions ? 'Generando...' : 'Sugerencias IA'}
          </Button>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-[#33A19A] hover:bg-[#2A857F]">
                <Plus className="w-4 h-4" />
                Nueva Consulta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nueva Consulta Guardada</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nombre</label>
                  <Input
                    placeholder="Nombre descriptivo"
                    value={newQuery.name}
                    onChange={(e) => setNewQuery({...newQuery, name: e.target.value})}
                    className="mt-1 border-[#B7CAC9]/40"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Descripción</label>
                  <Input
                    placeholder="¿Qué obtiene esta consulta?"
                    value={newQuery.description}
                    onChange={(e) => setNewQuery({...newQuery, description: e.target.value})}
                    className="mt-1 border-[#B7CAC9]/40"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Categoría</label>
                  <Select value={newQuery.category} onValueChange={(v) => setNewQuery({...newQuery, category: v})}>
                    <SelectTrigger className="mt-1 border-[#B7CAC9]/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meetings">Reuniones</SelectItem>
                      <SelectItem value="transcriptions">Transcripciones</SelectItem>
                      <SelectItem value="deliveries">Entregas</SelectItem>
                      <SelectItem value="tasks">Tareas</SelectItem>
                      <SelectItem value="analytics">Análitica</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Consulta SQL</label>
                  <Textarea
                    placeholder="SELECT * FROM `project.dataset.table`"
                    value={newQuery.query_sql}
                    onChange={(e) => setNewQuery({...newQuery, query_sql: e.target.value})}
                    className="mt-1 font-mono text-sm h-48 border-[#B7CAC9]/40"
                  />
                </div>

                <Button
                  onClick={handleSave}
                  disabled={createMutation.isPending}
                  className="w-full bg-[#33A19A] hover:bg-[#2A857F] gap-2"
                >
                  <Save className="w-4 h-4" />
                  Guardar Consulta
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="queries" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="queries">Mis Consultas</TabsTrigger>
          <TabsTrigger value="suggestions">Sugerencias ({suggestions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="queries" className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="bg-white rounded-lg p-4 animate-pulse h-24" />)}
            </div>
          ) : savedQueries.length === 0 ? (
            <Card className="bg-white border-[#B7CAC9]/30">
              <CardContent className="pt-6 text-center">
                <p className="text-[#3E4C59]">No tienes consultas guardadas. Crea una nueva.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {savedQueries.map(query => (
                <Card key={query.id} className="bg-white border-[#B7CAC9]/30 hover:border-[#33A19A] transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-[#1B2731]">{query.name}</CardTitle>
                        <CardDescription>{query.description}</CardDescription>
                        <div className="flex gap-2 mt-2">
                          <Badge className="bg-[#E8F5F4] text-[#33A19A]">{query.category}</Badge>
                          {query.is_scheduled && <Badge className="bg-blue-100 text-blue-800">Programada</Badge>}
                          {query.is_shared && <Badge className="bg-purple-100 text-purple-800">Compartida</Badge>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" onClick={() => navigator.clipboard.writeText(query.query_sql)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => base44.functions.invoke('executeBigQueryCustom', { query_template: query.query_sql })}
                        >
                          <Play className="w-4 h-4 text-[#33A19A]" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(query.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-[#FFFAF3] p-3 rounded overflow-x-auto text-[#3E4C59]">
                      {query.query_sql.substring(0, 200)}...
                    </pre>
                    {query.last_executed && (
                      <p className="text-xs text-[#B7CAC9] mt-2">
                        Última ejecución: {new Date(query.last_executed).toLocaleString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4">
          {suggestions.length === 0 ? (
            <Card className="bg-white border-[#B7CAC9]/30">
              <CardContent className="pt-6 text-center">
                <p className="text-[#3E4C59]">Haz clic en "Sugerencias IA" para obtener consultas personalizadas.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion, idx) => (
                <Card key={idx} className="bg-white border-[#B7CAC9]/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-[#1B2731]">{suggestion.name}</CardTitle>
                        <CardDescription>{suggestion.description}</CardDescription>
                        <Badge className="mt-2 bg-[#E8F5F4] text-[#33A19A]">{suggestion.category}</Badge>
                      </div>
                      <Button
                        onClick={() => acceptSuggestion(suggestion)}
                        className="bg-[#33A19A] hover:bg-[#2A857F]"
                        size="sm"
                      >
                        Usar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-[#FFFAF3] p-3 rounded overflow-x-auto text-[#3E4C59]">
                      {suggestion.query_sql.substring(0, 300)}...
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}