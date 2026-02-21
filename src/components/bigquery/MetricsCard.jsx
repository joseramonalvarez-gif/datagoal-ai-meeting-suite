import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function MetricsCard({ title, metrics, loading = false }) {
  if (loading) {
    return <div className="bg-white rounded-lg p-6 animate-pulse h-48" />;
  }

  if (!metrics || Object.keys(metrics).length === 0) {
    return null;
  }

  return (
    <Card className="bg-white border-[#B7CAC9]/30">
      <CardHeader>
        <CardTitle className="text-[#1B2731]">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Object.entries(metrics).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-[#3E4C59] capitalize">{key.replace(/_/g, ' ')}</span>
              <Badge variant="secondary" className="bg-[#E8F5F4] text-[#33A19A]">
                {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2) : value}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}