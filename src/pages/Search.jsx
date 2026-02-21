import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Search as SearchIcon, Brain, AlignLeft } from 'lucide-react';
import { toast } from 'sonner';
import SearchFilters from '../components/search/SearchFilters';
import SearchResults from '../components/search/SearchResults';

export default function Search({ selectedClient }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState('combined'); // 'keyword', 'semantic', 'combined'
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', participants: [] });
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [clientList, projectList] = await Promise.all([
        base44.entities.Client.list(),
        base44.entities.Project.list(),
      ]);
      setClients(clientList);
      setProjects(projectList);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      toast.error('Ingresa un término de búsqueda');
      return;
    }

    setLoading(true);
    try {
      const { data } = await base44.functions.invoke('searchMeetings', {
        query: searchQuery,
        searchType,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        participants: filters.participants,
        limit: 50,
      });

      setResults(data.results || []);
      if (data.results.length === 0) {
        toast.info('No se encontraron resultados');
      }
    } catch (err) {
      toast.error(err.message || 'Error en la búsqueda');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-[#1B2731]">Búsqueda Avanzada</h1>
        <p className="text-[#3E4C59] mt-2">Busca en transcripciones y reportes de reuniones</p>
      </div>

      {/* Search Bar */}
      <Card className="p-4 mb-8 border-[#B7CAC9]/30 bg-white">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B7CAC9]" />
              <Input
                placeholder="Busca por palabras clave, temas, participantes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-base"
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !searchQuery.trim()}
              className="bg-[#33A19A] hover:bg-[#2A857F] text-white px-6"
            >
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
          </div>

          {/* Search Type Selector */}
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-smooth"
              style={{ borderColor: searchType === 'keyword' ? '#33A19A' : '#B7CAC9/30', backgroundColor: searchType === 'keyword' ? '#E8F5F4' : 'transparent' }}>
              <input
                type="radio"
                value="keyword"
                checked={searchType === 'keyword'}
                onChange={(e) => setSearchType(e.target.value)}
                className="w-4 h-4"
              />
              <AlignLeft className="w-4 h-4 text-[#3E4C59]" />
              <span className="text-sm text-[#1B2731]">Palabras clave</span>
            </label>

            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-smooth"
              style={{ borderColor: searchType === 'semantic' ? '#33A19A' : '#B7CAC9/30', backgroundColor: searchType === 'semantic' ? '#E8F5F4' : 'transparent' }}>
              <input
                type="radio"
                value="semantic"
                checked={searchType === 'semantic'}
                onChange={(e) => setSearchType(e.target.value)}
                className="w-4 h-4"
              />
              <Brain className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-[#1B2731]">Búsqueda semántica (IA)</span>
            </label>

            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-smooth"
              style={{ borderColor: searchType === 'combined' ? '#33A19A' : '#B7CAC9/30', backgroundColor: searchType === 'combined' ? '#E8F5F4' : 'transparent' }}>
              <input
                type="radio"
                value="combined"
                checked={searchType === 'combined'}
                onChange={(e) => setSearchType(e.target.value)}
                className="w-4 h-4"
              />
              <span className="text-sm text-[#1B2731]">Combinada</span>
            </label>
          </div>
        </form>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <SearchFilters
            onFiltersChange={setFilters}
            clients={clients}
            projects={projects}
          />
        </div>

        {/* Results */}
        <div className="lg:col-span-3">
          <SearchResults results={results} loading={loading} />
        </div>
      </div>
    </div>
  );
}