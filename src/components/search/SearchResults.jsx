import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, BookOpen, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function SearchResults({ results, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#33A19A] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-[#3E4C59]">Buscando...</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-12 h-12 text-[#B7CAC9] mx-auto mb-3" />
        <p className="text-[#3E4C59]">No se encontraron resultados</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {results.map((result) => (
        <Link
          key={result.id}
          to={createPageUrl('Meetings', `?meeting=${result.meeting_id}`)}
        >
          <Card className="p-4 border-[#B7CAC9]/30 hover:border-[#33A19A] hover:shadow-lg transition-all cursor-pointer bg-white">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                {result.type === 'transcript' || result.type === 'transcript_semantic' ? (
                  <FileText className="w-5 h-5 text-[#33A19A]" />
                ) : (
                  <BookOpen className="w-5 h-5 text-blue-500" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-[#1B2731] text-sm">{result.title}</h3>
                    <p className="text-xs text-[#3E4C59] mt-1">
                      Reunión: {result.meeting_title}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {result.type === 'transcript_semantic' && (
                      <Badge variant="secondary" className="gap-1 text-xs bg-blue-100 text-blue-700">
                        <Zap className="w-3 h-3" /> IA
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {result.score > 70 ? '🔥 Alto' : result.score > 40 ? '⭐ Medio' : '📌 Bajo'}
                    </Badge>
                  </div>
                </div>

                <p className="text-xs text-[#3E4C59] mt-2 line-clamp-2 italic">
                  {result.preview}
                </p>

                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs text-[#B7CAC9]">
                    📅 {new Date(result.date).toLocaleDateString('es-ES')}
                  </span>
                  {result.participants && result.participants.length > 0 && (
                    <span className="text-xs text-[#B7CAC9]">
                      👥 {result.participants.length} participantes
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}