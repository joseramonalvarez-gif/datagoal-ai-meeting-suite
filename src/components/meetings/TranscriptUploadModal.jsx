import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function TranscriptUploadModal({ open, onOpenChange, meeting_id, onSuccess }) {
  const [file, setFile] = useState(null);
  const [format, setFormat] = useState('md');
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    try {
      // Upload file
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadRes.file_url;

      // Parse transcript
      const parseRes = await base44.functions.invoke('parseTranscriptFile', {
        file_url: fileUrl,
        file_format: format,
        meeting_id: meeting_id,
      });

      if (parseRes.data?.success) {
        onSuccess?.(parseRes.data.transcript_id);
        onOpenChange(false);
        setFile(null);
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Error uploading transcript: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Subir Transcripción</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Formato del archivo *</label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="md">Markdown (.md)</SelectItem>
                <SelectItem value="txt">Texto plano (.txt)</SelectItem>
                <SelectItem value="docx">Word (.docx)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Archivo *</label>
            <div className="mt-1 border-2 border-dashed border-[#B7CAC9] rounded-lg p-6 text-center">
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-5 h-5 text-[#33A19A]" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <Upload className="w-6 h-6 mx-auto mb-2 text-[#B7CAC9]" />
                  <p className="text-sm text-[#3E4C59]">Arrastra archivo o haz clic</p>
                  <Input
                    type="file"
                    onChange={e => setFile(e.target.files?.[0])}
                    className="hidden"
                    accept=".md,.txt,.docx"
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleUpload}
            disabled={!file || loading}
            className="bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Subir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}