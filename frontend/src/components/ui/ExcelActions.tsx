import React, { useRef, useState } from 'react';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface ExcelActionsProps {
  /** API base path without trailing slash, e.g. "/customers" */
  basePath: string;
  /** Base name for the exported file, e.g. "customers" */
  exportName: string;
  /** Friendly filename for the downloaded template */
  templateFileName: string;
  /** Labels (optional overrides) */
  templateLabel?: string;
  importLabel?: string;
  exportLabel?: string;
  /** Called after a successful import so the page can refresh */
  onImported?: () => void;
}

function downloadBlob(data: Blob, filename: string) {
  const url = window.URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

const ExcelActions: React.FC<ExcelActionsProps> = ({
  basePath, exportName, templateFileName,
  templateLabel = 'قالب', importLabel = 'استيراد', exportLabel = 'تصدير', onImported,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleTemplate = async () => {
    try {
      const res = await api.get(`${basePath}/template`, { responseType: 'blob' });
      downloadBlob(res.data, templateFileName);
      toast.success('تم تحميل القالب');
    } catch {
      toast.error('خطأ في تحميل القالب');
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await api.get(`${basePath}/export`, { responseType: 'blob' });
      downloadBlob(res.data, `${exportName}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('تم التصدير إلى Excel');
    } catch {
      toast.error('خطأ في التصدير');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImporting(true);
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await api.post(`${basePath}/import`, { fileBase64 });
      const r = res.data.data;
      toast.success(res.data.message, { duration: 5000 });
      if (r?.errors?.length) {
        toast.error(`${r.errors.length} صف به مشكلة: ${r.errors.slice(0, 3).map((x: any) => x.message).join(' • ')}`, { duration: 9000 });
      }
      onImported?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في استيراد الملف');
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
      <button onClick={handleTemplate} className="btn-secondary text-sm" title="تحميل قالب Excel جاهز للتعبئة">
        <FileSpreadsheet className="w-4 h-4" />
        <span className="hidden md:inline">{templateLabel}</span>
      </button>
      <button onClick={() => inputRef.current?.click()} disabled={importing} className="btn-secondary text-sm" title="استيراد من ملف Excel">
        <Upload className="w-4 h-4" />
        <span className="hidden md:inline">{importing ? 'جاري...' : importLabel}</span>
      </button>
      <button onClick={handleExport} disabled={exporting} className="btn-secondary text-sm" title="تصدير إلى Excel">
        <Download className="w-4 h-4" />
        <span className="hidden md:inline">{exporting ? 'جاري...' : exportLabel}</span>
      </button>
    </div>
  );
};

export default ExcelActions;
