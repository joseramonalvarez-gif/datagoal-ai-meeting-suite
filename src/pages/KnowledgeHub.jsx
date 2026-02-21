import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, BookOpen, ArrowUpRight, Eye, Download, Plus, Loader2, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';

const ASSET_TYPES = {
  methodology: { label: 'Metodología', icon: '📊', color: 'bg-blue-100 text-blue-700' },
  framework: { label: 'Framework', icon: '🏗️', color: 'bg-purple-100 text-purple-700' },
  template: { label: 'Template', icon: '📄', color: 'bg-green-100 text-green-700' },
  case_study: { label: 'Caso Éxito', icon: '⭐', color: 'bg-amber-100 text-amber-700' },
  best_practice: { label: 'Best Practice', icon: '✨', color: 'bg-pink-100 text-pink-700' },
  tool: { label: 'Herramienta', icon: '🔧', color: 'bg-cyan-100 text-cyan-700' },
  checklist: { label: 'Checklist', icon: '✅', color: 'bg-teal-100 text-teal-700' },
  proposal_template: { label: 'Propuesta', icon: '💼', color: 'bg-indigo-100 text-indigo-700' }
};

const CATEGORIES = [
  { value: 'digital_transformation', label: 'Transformación Digital' },
  { value: 'data_strategy', label: 'Estrategia de Datos' },
  { value: 'cloud_migration', label: 'Cloud Migration' },
  { value: 'ai_ml', label: 'IA & Machine Learning' },
  { value: 'customer_experience', label: 'Experiencia del Cliente' },
  { value: 'operations', label: 'Operaciones' },
  { value: 'innovation', label: 'Innovación' },
  { value: 'other', label: 'Otros' }
];

export default function KnowledgeHub() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [searchDone, setSearchDone] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) {
      toast.error('Ingresa un término de búsqueda');
      return;
    }

    setLoading(true);
    setSearchDone(true);

    try {
      const res = await base44.functions.invoke('semanticSearch', {
        query: query.trim(),
        category: selectedCategory || undefined,
        asset_type: selectedType || undefined,
        limit: 20
      });

      setResults(res.data.results || []);
      if (res.data.results.length === 0) {
        toast.info(`No se encontraron activos para "${query}"`);
      }
    } catch (err) {
      toast.error('Error en búsqueda: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold text-[#1B2731]">Centro de Conocimiento</h1>
        <p className="text-sm text-[#3E4C59] mt-2">
          Busca metodologías, casos de éxito, templates y best practices de proyectos anteriores
        </p>
      </div>

      {/* Search Section */}
      <Card className="border-[#33A19A]/30 bg-gradient-to-br from-[#E8F5F4] to-white">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-[#33A19A]" />
            Búsqueda Inteligente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            {/* Query Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B7CAC9]" />
              <Input
                placeholder="Busca metodologías, frameworks, casos de éxito..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 h-11 border-[#33A19A]/30 focus:border-[#33A19A]"
              />
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-10 border-[#B7CAC9]/30">
                  <SelectValue placeholder="Categoría (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todas las categorías</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="h-10 border-[#B7CAC9]/30">
                  <SelectValue placeholder="Tipo de activo (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos los tipos</SelectItem>
                  {Object.entries(ASSET_TYPES).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {val.icon} {val.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-gradient-to-r from-[#33A19A] to-[#2A857F] hover:from-[#2A857F] hover:to-[#1E7168] text-white font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Buscar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {searchDone && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold text-[#1B2731]">
              {results.length} resultado{results.length !== 1 ? 's' : ''}
            </h2>
            {results.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuery('')}
                className="text-xs"
              >
                Limpiar
              </Button>
            )}
          </div>

          {results.length === 0 ? (
            <Card className="border-dashed border-2 border-[#B7CAC9]/30">
              <CardContent className="py-12 text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-[#B7CAC9]" />
                <p className="text-[#3E4C59] mb-2">No se encontraron activos</p>
                <p className="text-sm text-[#B7CAC9]">Intenta con otros términos o filtros</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {results.map((asset) => {
                const typeInfo = ASSET_TYPES[asset.asset_type] || { label: asset.asset_type, icon: '📋', color: 'bg-gray-100 text-gray-700' };
                const categoryLabel = CATEGORIES.find(c => c.value === asset.category)?.label || asset.category;

                return (
                  <Card key={asset.id} className="hover:shadow-md transition-all border-[#B7CAC9]/20">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 text-2xl">{typeInfo.icon}</div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2 gap-2">
                            <h3 className="font-semibold text-[#1B2731] line-clamp-2">{asset.title}</h3>
                            <Badge className={`flex-shrink-0 whitespace-nowrap text-xs ${typeInfo.color} border-0`}>
                              {typeInfo.label}
                            </Badge>
                          </div>

                          <p className="text-sm text-[#3E4C59] mb-2 line-clamp-2">{asset.snippet}</p>

                          <div className="flex flex-wrap gap-2 mb-3">
                            <Badge variant="outline" className="text-xs border-[#B7CAC9]/30">
                              {categoryLabel}
                            </Badge>
                            {asset.match_score && (
                              <Badge variant="outline" className="text-xs border-[#33A19A]/30 text-[#33A19A]">
                                {Math.round(asset.match_score * 10)}% relevancia
                              </Badge>
                            )}
                          </div>

                          {asset.tags && asset.tags.length > 0 && (
                            <div className="flex gap-1.5 mb-3 flex-wrap">
                              {asset.tags.slice(0, 3).map((tag, i) => (
                                <span key={i} className="text-xs px-2 py-1 rounded-full bg-[#FFFAF3] text-[#3E4C59] border border-[#B7CAC9]/20">
                                  #{tag}
                                </span>
                              ))}
                              {asset.tags.length > 3 && (
                                <span className="text-xs text-[#B7CAC9]">+{asset.tags.length - 3} más</span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between text-xs text-[#B7CAC9]">
                            <div className="flex gap-3">
                              <span className="flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5" />
                                {asset.usage_count || 0} consultas
                              </span>
                              {asset.created_date && (
                                <span>
                                  {new Date(asset.created_date).toLocaleDateString('es-ES')}
                                </span>
                              )}
                            </div>

                            {asset.file_url && (
                              <a
                                href={asset.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2 py-1 rounded text-[#33A19A] hover:bg-[#E8F5F4] transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Descargar
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!searchDone && (
        <Card className="border-dashed border-2 border-[#B7CAC9]/30">
          <CardContent className="py-16 text-center">
            <Lightbulb className="w-16 h-16 mx-auto mb-4 text-[#B7CAC9]" />
            <h3 className="font-heading font-semibold text-[#1B2731] mb-2">Centro de Conocimiento</h3>
            <p className="text-[#3E4C59] mb-1">Acceso a toda la base de conocimiento de Data Goal</p>
            <p className="text-sm text-[#B7CAC9]">Busca metodologías, templates, casos de éxito y best practices</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}