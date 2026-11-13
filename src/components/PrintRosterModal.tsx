import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Printer, 
  X, 
  ArrowLeft, 
  ZoomIn, 
  ZoomOut, 
  Minimize2, 
  FileText,
  Building2,
  Calendar,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { formatThaiDate } from '../utils/idCard';

export interface RosterColumn<T> {
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render: (item: T, index: number) => React.ReactNode;
}

export interface RosterSummaryItem {
  label: string;
  value: string | number;
  sublabel?: string;
}

interface PrintRosterModalProps<T> {
  title: string;
  subtitle: string;
  documentCode?: string;
  items: T[];
  columns: RosterColumn<T>[];
  summaryItems?: RosterSummaryItem[];
  itemsPerPage?: number;
  onClose: () => void;
  preparedBy?: { name: string; position: string };
  approvedBy?: { name: string; position: string };
}

export function PrintRosterModal<T>({
  title,
  subtitle,
  documentCode = 'แบบรายงาน A4',
  items,
  columns,
  summaryItems,
  itemsPerPage = 9,
  onClose,
  preparedBy = {
    name: 'นายกริชพิพัฒน์  สลับทอง',
    position: 'เจ้าหน้าที่ฝ่ายสังคมสงเคราะห์',
  },
  approvedBy = {
    name: 'นางสาวศาตพร  ภูมิโคกรักษ์',
    position: 'ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ',
  },
}: PrintRosterModalProps<T>) {
  const [scale, setScale] = useState<number>(0.75);
  const [activeTab, setActiveTab] = useState<'all' | number>('all');

  useEffect(() => {
    document.body.classList.add('is-printing-sk04');
    return () => {
      document.body.classList.remove('is-printing-sk04');
    };
  }, []);

  useEffect(() => {
    const updateFitScale = () => {
      const availableHeight = window.innerHeight - 150;
      const fit = Math.min(1, Math.max(0.4, availableHeight / 1150));
      setScale(parseFloat(fit.toFixed(2)));
    };

    updateFitScale();
    window.addEventListener('resize', updateFitScale);
    return () => window.removeEventListener('resize', updateFitScale);
  }, []);

  // Chunk items into pages
  const pages = useMemo(() => {
    if (items.length === 0) return [[]];
    const chunked: T[][] = [];
    for (let i = 0; i < items.length; i += itemsPerPage) {
      chunked.push(items.slice(i, i + itemsPerPage));
    }
    return chunked;
  }, [items, itemsPerPage]);

  const totalPages = pages.length;

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div className="a4-print-modal fixed inset-0 z-50 overflow-y-auto bg-slate-900/85 backdrop-blur-xs flex flex-col items-center p-2 sm:p-4">
      {/* Top Floating Control Bar - Hidden when printing */}
      <div className="no-print w-full max-w-5xl bg-white rounded-2xl shadow-2xl p-3 sm:p-4 mb-3 sticky top-2 z-50 border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              title="ย้อนกลับ"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                  {title}
                </h2>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                  ขนาด A4 ({totalPages} หน้า)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {subtitle} • รวมข้อมูลทั้งหมด <strong className="text-blue-700">{items.length}</strong> รายการ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.4, parseFloat((s - 0.05).toFixed(2))))}
                className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition cursor-pointer"
                title="ย่อ"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono px-1 font-semibold text-slate-700 min-w-10 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(1.2, parseFloat((s + 0.05).toFixed(2))))}
                className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition cursor-pointer"
                title="ขยาย"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setScale(0.75)}
                className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition cursor-pointer"
                title="พอดีจอ"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>สั่งพิมพ์เอกสาร A4 (Print / บันทึก PDF)</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Page Switcher Tabs */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 pt-2.5 overflow-x-auto text-xs">
            <span className="text-slate-500 font-medium shrink-0 mr-1">เลือกดูหน้า:</span>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ดูทั้งหมด ({totalPages} หน้า)
            </button>
            {pages.map((_, pIdx) => (
              <button
                key={pIdx}
                onClick={() => setActiveTab(pIdx)}
                className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  activeTab === pIdx
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                หน้าที่ {pIdx + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Printable A4 Container */}
      <div
        className="a4-container transition-transform duration-150 origin-top flex flex-col items-center gap-6 pb-10"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          marginBottom: scale < 1 ? `-${Math.round((1 - scale) * (totalPages * 1140))}px` : undefined,
        }}
      >
        {pages.map((pageItems, pageIdx) => {
          const isHiddenOnScreen = activeTab !== 'all' && activeTab !== pageIdx;
          const isLastPage = pageIdx === totalPages - 1;

          return (
            <div
              key={pageIdx}
              className={`a4-sheet bg-white text-slate-900 shadow-2xl relative flex flex-col justify-between p-5 sm:py-[11mm] sm:px-[13mm] border border-slate-300 font-['Sarabun',sans-serif] ${
                isHiddenOnScreen ? 'hidden print:flex' : 'flex'
              } ${isLastPage ? 'last-sheet' : ''}`}
            >
              {/* Top Section */}
              <div className="space-y-3">
                {/* Official Foundation Header */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2.5">
                  <div className="flex items-center gap-3">
                    <img
                      src="/assets/aistudio/382492-Photoroom_4c9e02f3.png"
                      alt="ตรามูลนิธิร่วมกุศลสมุทรปราการ"
                      className="w-14 h-14 object-contain shrink-0"
                    />
                    <div>
                      <div className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                        มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂)
                      </div>
                      <div className="text-xs font-bold text-blue-900 mt-0.5">
                        {title}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        {subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="inline-block border border-slate-900 rounded px-2.5 py-0.5 text-[10px] font-bold text-slate-900 bg-slate-50">
                      {documentCode}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1">
                      หน้า {pageIdx + 1} จาก {totalPages}
                    </div>
                    <div className="text-[10px] text-slate-600">
                      วันที่ออกรายงาน: {formatThaiDate(new Date().toISOString().slice(0, 10))}
                    </div>
                  </div>
                </div>

                {/* Page 1 Summary Box */}
                {pageIdx === 0 && summaryItems && summaryItems.length > 0 && (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 text-center text-[10.5px] border border-blue-200 bg-blue-50/50 p-2 rounded-lg">
                    {summaryItems.map((s, idx) => (
                      <div key={idx} className={idx < summaryItems.length - 1 ? 'border-r border-blue-200/80 pr-1' : ''}>
                        <div className="text-slate-500 text-[9.5px] leading-tight">{s.label}</div>
                        <div className="font-bold text-xs sm:text-sm text-slate-900 mt-0.5">{s.value}</div>
                        {s.sublabel && <div className="text-[8.5px] text-slate-500">{s.sublabel}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Data Table */}
                <div className="border border-slate-900 rounded overflow-hidden">
                  <table className="w-full text-left border-collapse text-[10.5px]">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold text-center border-b border-slate-900">
                        <th className="p-1.5 w-10 border-r border-slate-700">ลำดับ</th>
                        {columns.map((col, cIdx) => (
                          <th
                            key={cIdx}
                            className={`p-1.5 ${col.width || ''} ${
                              cIdx < columns.length - 1 ? 'border-r border-slate-700' : ''
                            } ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}
                          >
                            {col.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {pageItems.length === 0 ? (
                        <tr>
                          <td colSpan={columns.length + 1} className="p-6 text-center text-slate-400 italic">
                            ไม่มีข้อมูลรายการที่ตรงกับเงื่อนไข
                          </td>
                        </tr>
                      ) : (
                        pageItems.map((item, rowIdx) => {
                          const globalIdx = pageIdx * itemsPerPage + rowIdx + 1;
                          return (
                            <tr key={rowIdx} className="align-middle hover:bg-slate-50">
                              <td className="p-1.5 text-center font-bold text-slate-800 border-r border-slate-300">
                                {globalIdx}
                              </td>
                              {columns.map((col, cIdx) => (
                                <td
                                  key={cIdx}
                                  className={`p-1.5 ${
                                    cIdx < columns.length - 1 ? 'border-r border-slate-300' : ''
                                  } ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}
                                >
                                  {col.render(item, globalIdx - 1)}
                                </td>
                              ))}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Section: Official Signatures on Last Page (or compact on each) */}
              <div className="mt-4 pt-2.5 border-t-2 border-slate-900 space-y-2">
                {isLastPage ? (
                  <div className="grid grid-cols-2 gap-8 text-center">
                    {/* Left: Officer Signature */}
                    <div className="space-y-1 p-2 bg-slate-50/80 rounded border border-slate-200">
                      <div className="text-[11px] font-bold text-slate-900">
                        ผู้จัดทำรายงาน / เจ้าหน้าที่รับผิดชอบ
                      </div>
                      <div className="pt-7 border-b border-dotted border-slate-700 w-52 mx-auto"></div>
                      <div className="text-xs font-bold text-slate-900 mt-1">
                        ( {preparedBy.name} )
                      </div>
                      <div className="text-[10px] font-semibold text-slate-700">
                        {preparedBy.position}
                      </div>
                      <div className="text-[9.5px] text-slate-500">
                        วันที่ .......... เดือน .............................. พ.ศ. ................
                      </div>
                    </div>

                    {/* Right: Foundation Manager Approval */}
                    <div className="space-y-1 p-2 bg-slate-50/80 rounded border border-slate-200">
                      <div className="text-[11px] font-bold text-slate-900">
                        ผู้ตรวจสอบและรับรองความถูกต้อง
                      </div>
                      <div className="pt-7 border-b border-dotted border-slate-700 w-52 mx-auto"></div>
                      <div className="text-xs font-bold text-slate-900 mt-1">
                        ( {approvedBy.name} )
                      </div>
                      <div className="text-[10px] font-semibold text-slate-700">
                        {approvedBy.position}
                      </div>
                      <div className="text-[9.5px] text-slate-500">
                        วันที่ .......... เดือน .............................. พ.ศ. ................
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                    <span>(ดูสรุปและลงนามในหน้าสุดท้าย - หน้า {totalPages})</span>
                    <span>รายงานทางการ มูลนิธิร่วมกุศลสมุทรปราการ</span>
                  </div>
                )}

                {/* Footer Watermark */}
                <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-200 pt-1">
                  <div>
                    ระบบดิจิทัล BD-Care • มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂) • โทร. 02-395-0919, 02-387-1111
                  </div>
                  <div>
                    พิมพ์เมื่อ: {formatThaiDate(new Date().toISOString().slice(0, 10))} เวลา {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
