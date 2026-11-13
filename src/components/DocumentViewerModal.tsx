import React from 'react';
import { X, Download, FileText, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { PatientDocument } from '../types';
import { useUiFeedback } from './UiFeedback';

interface DocumentViewerModalProps {
  document: PatientDocument | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  document,
  isOpen,
  onClose,
}) => {
  const { showToast } = useUiFeedback();
  if (!isOpen || !document) return null;

  const isPdf = document.fileType.includes('pdf') || document.fileName.toLowerCase().endsWith('.pdf');
  const isImage = document.fileType.includes('image') || /\.(jpg|jpeg|png|webp|gif)$/i.test(document.fileName);

  const handleDownload = () => {
    if (!document.dataUrl) {
      showToast('ไม่มีข้อมูลไบนารีสำหรับดาวน์โหลด', 'warning');
      return;
    }
    const link = window.document.createElement('a');
    link.href = document.dataUrl;
    link.download = document.fileName || 'document';
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl overflow-hidden max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {isPdf ? (
              <FileText className="w-5 h-5 text-red-400 shrink-0" />
            ) : (
              <ImageIcon className="w-5 h-5 text-blue-400 shrink-0" />
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{document.title || document.fileName}</h3>
              <p className="text-[11px] text-slate-400">
                {document.fileName} • {document.uploadDate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {document.dataUrl && (
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                ดาวน์โหลด
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer Content */}
        <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center p-4 min-h-[400px]">
          {isImage ? (
            document.dataUrl ? (
              <img
                src={document.dataUrl}
                alt={document.title}
                className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-md bg-white"
              />
            ) : (
              <div className="text-center p-8 text-slate-500">
                <ImageIcon className="w-12 h-12 mx-auto text-slate-400 mb-2" />
                <p>ไม่พบข้อมูลรูปภาพตัวอย่าง</p>
              </div>
            )
          ) : isPdf ? (
            document.dataUrl ? (
              <iframe
                src={document.dataUrl}
                title={document.title}
                className="w-full h-[70vh] rounded-lg border border-slate-300 bg-white"
              />
            ) : (
              <div className="text-center p-8 bg-white rounded-xl shadow-xs border border-slate-200 max-w-sm">
                <FileText className="w-16 h-16 mx-auto text-red-500 mb-3" />
                <h4 className="font-semibold text-slate-800 mb-1">{document.title}</h4>
                <p className="text-xs text-slate-500 mb-4">{document.fileName}</p>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  เปิด/ดาวน์โหลดไฟล์เอกสาร PDF
                </button>
              </div>
            )
          ) : (
            <div className="text-center p-8 text-slate-500">
              <FileText className="w-12 h-12 mx-auto text-slate-400 mb-2" />
              <p>ไฟล์นามสกุลนี้ไม่สามารถเปิดพรีวิวในเบราว์เซอร์ได้</p>
              <button
                type="button"
                onClick={handleDownload}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                ดาวน์โหลดไฟล์
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
