import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export default function QueryResultsTable({ results }) {
  if (!results || !results.data || results.data.length === 0) {
    return null;
  }

  const downloadCSV = () => {
    const headers = results.columns.map(c => c.name);
    const rows = results.data.map(row => 
      headers.map(h => {
        const val = row[h];
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
      }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  return (
    <Card className="bg-white border-[#B7CAC9]/30">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-[#1B2731]">Resultados ({results.total_rows} filas)</CardTitle>
        <Button
          onClick={downloadCSV}
          variant="outline"
          size="sm"
          className="gap-2 border-[#33A19A] text-[#33A19A]"
        >
          <Download className="w-4 h-4" />
          CSV
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#E8F5F4]">
                {results.columns.map((col) => (
                  <TableHead key={col.name} className="text-[#1B2731]">
                    {col.name} <span className="text-xs text-[#B7CAC9]">({col.type})</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.data.slice(0, 50).map((row, idx) => (
                <TableRow key={idx} className="hover:bg-[#FFFAF3]">
                  {results.columns.map((col) => (
                    <TableCell key={col.name} className="text-[#3E4C59] text-sm">
                      {row[col.name]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}