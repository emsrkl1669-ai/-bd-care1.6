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
} from 'lucide-react';
import { formatThaiDate } from '../utils/idCard';

export interface RosterColumn<T> {
  header: string;
  width?: string;
  colWidth?: string;
  noWrap?: boolean;
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
  orientation?: 'portrait' | 'landscape';
  indexColWidth?: string;
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
  itemsPerPage = 10,
  orientation: initialOrientation = 'portrait',
  indexColWidth = '5%',
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
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(initialOrientation);
  const [scale, setScale] = useState<number>(0.8);
  const [activeTab, setActiveTab] = useState<'all' | number>('all');

  const isLandscape = orientation === 'landscape';

  useEffect(() => {
    document.body.classList.add('is-printing-sk04');
    if (isLandscape) {
      document.body.classList.add('is-printing-landscape');
    } else {
      document.body.classList.remove('is-printing-landscape');
    }
    return () => {
      document.body.classList.remove('is-printing-sk04');
      document.body.classList.remove('is-printing-landscape');
    };
  }, [isLandscape]);

  const computeFitScale = (mode: 'portrait' | 'landscape') => {
    const sheetWidth = mode === 'landscape' ? 1123 : 794;
    const sheetHeight = mode === 'landscape' ? 794 : 1123;
    const isMobile = window.innerWidth < 1024;
    const horizPad = window.innerWidth < 640 ? 16 : 48;
    const vertPad = window.innerWidth < 640 ? 190 : 165;
    const fitW = (window.innerWidth - horizPad) / sheetWidth;
    const fitH = (window.innerHeight - vertPad) / sheetHeight;
    const fit = isMobile ? fitW : Math.min(fitW, fitH);
    return parseFloat(Math.min(1, Math.max(0.28, fit)).toFixed(2));
  };

  useEffect(() => {
    const updateFitScale = () => {
      setScale(computeFitScale(orientation));
    };
    updateFitScale();
    window.addEventListener('resize', updateFitScale);
    return () => window.removeEventListener('resize', updateFitScale);
  }, [orientation]);

  // Portrait mode uses explicit page chunking; Landscape uses continuous native flow with repeating thead
  const pages = useMemo(() => {
    if (isLandscape) return [items];
    if (items.length === 0) return [[]];
    const chunked: T[][] = [];
    for (let i = 0; i < items.length; i += itemsPerPage) {
      chunked.push(items.slice(i, i + itemsPerPage));
    }
    return chunked;
  }, [items, itemsPerPage, isLandscape]);

  const totalPages = pages.length;

  const handlePrint = () => {
    window.print();
  };

  const renderSignatures = () => (
    <div className="signature-block-keep mt-3 space-y-2.5">
      {/* Summary Count Attached Directly at End of Table */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 border border-slate-900 px-3 py-1.5 text-[10.5px] font-bold text-slate-900">
        <span>สรุปรายงาน {documentCode}</span>
        <span>จำนวนทั้งหมด {items.length} รายการ</span>
      </div>

      <div className="grid grid-cols-2 gap-8 text-center pt-1">
        {/* Left: Officer Signature */}
        <div className="space-y-1 p-2.5 bg-slate-50/80 rounded border border-slate-200">
          <div className="text-[11px] font-bold text-slate-900">
            ผู้จัดทำรายงาน / เจ้าหน้าที่รับผิดชอบ
          </div>
          <div className="pt-7 border-b border-dotted border-slate-700 w-56 mx-auto"></div>
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
        <div className="space-y-1 p-2.5 bg-slate-50/80 rounded border border-slate-200">
          <div className="text-[11px] font-bold text-slate-900">
            ผู้ตรวจสอบและรับรองความถูกต้อง
          </div>
          <div className="pt-7 border-b border-dotted border-slate-700 w-56 mx-auto"></div>
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

      {/* Footer Watermark */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 text-[8.5px] text-slate-500 border-t border-slate-200 pt-1.5">
        <div>
          มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂) • 57/1 ซอยท้ายบ้าน 17 (ซอยมูลนิธิ) ถนนท้ายบ้าน ต.ปากน้ำ อ.เมืองสมุทรปราการ จ.สมุทรปราการ 10270 โทร.02 175 8668, 02 175 8789
        </div>
        <div>
          พิมพ์เมื่อ: {formatThaiDate(new Date().toISOString().slice(0, 10))} เวลา{' '}
          {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div
      className={`a4-print-modal ${
        isLandscape ? 'is-landscape' : ''
      } fixed inset-0 z-50 overflow-y-auto bg-slate-900/85 backdrop-blur-xs flex flex-col items-center p-2 sm:p-4`}
    >
      {/* Dynamic Landscape @page directive with 0.5-inch (12.7mm) margins on all pages */}
      {isLandscape && (
        <style>{`@media print { @page { size: A4 landscape; margin: 12.7mm; } }`}</style>
      )}

      {/* Top Floating Control Bar - Hidden when printing */}
      <div className="no-print w-full max-w-6xl bg-white rounded-2xl shadow-2xl p-3 sm:p-4 mb-3 sticky top-2 z-50 border border-slate-200">
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
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                  {title}
                </h2>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                  {isLandscape ? 'A4 แนวนอน (หัวตารางซ้ำอัตโนมัติทุกหน้า)' : `ขนาด A4 แนวตั้ง (${totalPages} หน้า)`}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {subtitle} • รวมข้อมูลทั้งหมด <strong className="text-blue-700">{items.length}</strong> รายการ
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Orientation Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer ${
                  isLandscape ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                แนวนอน
              </button>
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer ${
                  !isLandscape ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                แนวตั้ง
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.28, parseFloat((s - 0.05).toFixed(2))))}
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
                onClick={() => setScale(computeFitScale(orientation))}
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
              <span>สั่งพิมพ์เอกสาร {isLandscape ? 'A4 แนวนอน' : 'A4'} (Print / PDF)</span>
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

        {/* Page Switcher Tabs (Portrait manual pagination only) */}
        {!isLandscape && totalPages > 1 && (
          <div className="flex items-center gap-1.5 pt-2.5 overflow-x-auto no-scrollbar text-xs">
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
      <div className="w-full overflow-x-auto flex print:block print:overflow-visible">
        <div
          className="a4-container w-fit mx-auto transition-transform duration-150 origin-top flex flex-col items-center gap-6 pb-10"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            marginLeft:
              scale < 1
                ? `-${Math.round(((1 - scale) * (isLandscape ? 1123 : 794)) / 2)}px`
                : undefined,
            marginRight:
              scale < 1
                ? `-${Math.round(((1 - scale) * (isLandscape ? 1123 : 794)) / 2)}px`
                : undefined,
            marginBottom:
              !isLandscape && scale < 1
                ? `-${Math.round((1 - scale) * ((activeTab === 'all' ? totalPages : 1) * 1140))}px`
                : undefined,
          }}
        >
        {pages.map((pageItems, pageIdx) => {
          const isHiddenOnScreen = !isLandscape && activeTab !== 'all' && activeTab !== pageIdx;
          const isLastPage = pageIdx === totalPages - 1;
          const hasExplicitColWidths = columns.some((c) => Boolean(c.colWidth));

          return (
            <div
              key={pageIdx}
              className={`a4-sheet ${
                isLandscape
                  ? 'a4-sheet-landscape p-[12.7mm] print:p-0'
                  : 'a4-sheet-compact flex flex-col justify-between py-[10mm] px-[12mm]'
              } bg-white text-slate-900 shadow-2xl relative border border-slate-300 font-['Sarabun',sans-serif] ${
                isHiddenOnScreen ? 'hidden print:flex' : isLandscape ? 'block' : 'flex'
              } ${isLastPage ? 'last-sheet' : ''}`}
            >
              {/* Top Section */}
              <div className="space-y-2.5">
                {/* Official Foundation Header */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2">
                  <div className="flex items-center gap-3">
                    <img
                      src="/assets/aistudio/382492-Photoroom_4c9e02f3.png"
                      alt="ตรามูลนิธิร่วมกุศลสมุทรปราการ"
                      className="w-12 h-12 object-contain shrink-0"
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
                    {!isLandscape && (
                      <div className="text-[10px] text-slate-600 font-mono mt-1">
                        หน้า {pageIdx + 1} จาก {totalPages}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-600 mt-1">
                      วันที่ออกรายงาน: {formatThaiDate(new Date().toISOString().slice(0, 10))}
                    </div>
                  </div>
                </div>

                {/* Integrated Summary Strip ONLY below Page 1 Header */}
                {pageIdx === 0 && summaryItems && summaryItems.length > 0 && (
                  <div
                    className={`grid ${
                      summaryItems.length <= 5
                        ? 'grid-cols-2 sm:grid-cols-5'
                        : 'grid-cols-3 sm:grid-cols-6'
                    } gap-2 text-center text-[10.5px] border border-blue-200 bg-blue-50/60 p-2 rounded-lg`}
                  >
                    {summaryItems.map((s, idx) => (
                      <div
                        key={idx}
                        className={
                          idx < summaryItems.length - 1 ? 'border-r border-blue-200/80 pr-1.5' : ''
                        }
                      >
                        <div className="text-slate-600 text-[9.5px] leading-tight">{s.label}</div>
                        <div className="font-bold text-xs sm:text-sm text-slate-900 mt-0.5 whitespace-nowrap">
                          {s.value}
                        </div>
                        {s.sublabel && <div className="text-[8.5px] text-slate-500">{s.sublabel}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Data Table (NO overflow-hidden so multi-page print rows never merge/clip) */}
                <div className="border border-slate-900 print:border-0">
                  <table
                    className={`w-full text-left border-collapse border border-slate-900 ${
                      hasExplicitColWidths || isLandscape ? 'table-fixed' : ''
                    } text-[10px] leading-[1.3]`}
                  >
                    {(hasExplicitColWidths || isLandscape) && (
                      <colgroup>
                        <col style={{ width: indexColWidth }} />
                        {columns.map((col, cIdx) => (
                          <col key={cIdx} style={col.colWidth ? { width: col.colWidth } : undefined} />
                        ))}
                      </colgroup>
                    )}
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold text-center border-b border-slate-900">
                        <th className="py-1.5 px-1 border border-slate-700 whitespace-nowrap">
                          ลำดับ
                        </th>
                        {columns.map((col, cIdx) => (
                          <th
                            key={cIdx}
                            className={`py-1.5 px-1.5 border border-slate-700 ${col.width || ''} ${
                              col.noWrap ? 'whitespace-nowrap' : ''
                            } ${
                              col.align === 'center'
                                ? 'text-center'
                                : col.align === 'right'
                                ? 'text-right'
                                : 'text-left'
                            }`}
                          >
                            {col.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.length === 0 ? (
                        <tr>
                          <td
                            colSpan={columns.length + 1}
                            className="p-6 text-center text-slate-400 italic border border-slate-300"
                          >
                            ไม่มีข้อมูลรายการที่ตรงกับเงื่อนไข
                          </td>
                        </tr>
                      ) : (
                        pageItems.map((item, rowIdx) => {
                          const globalIdx = isLandscape
                            ? rowIdx + 1
                            : pageIdx * itemsPerPage + rowIdx + 1;
                          return (
                            <tr
                              key={rowIdx}
                              className="align-middle odd:bg-white even:bg-slate-50/40 hover:bg-blue-50/30"
                            >
                              <td className="py-1.5 px-1 text-center font-bold text-slate-800 border border-slate-300 whitespace-nowrap">
                                {globalIdx}
                              </td>
                              {columns.map((col, cIdx) => (
                                <td
                                  key={cIdx}
                                  className={`py-1.5 px-1.5 border border-slate-300 ${
                                    col.noWrap ? 'whitespace-nowrap' : ''
                                  } ${
                                    col.align === 'center'
                                      ? 'text-center'
                                      : col.align === 'right'
                                      ? 'text-right'
                                      : 'text-left'
                                  }`}
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

              {/* Bottom Section: Signatures attached directly after table on Last Page */}
              {isLastPage ? (
                renderSignatures()
              ) : (
                <div className="mt-auto pt-2 border-t-2 border-slate-900 space-y-1.5 signature-block-keep">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                    <span>(ดูสรุปและลงนามในหน้าสุดท้าย - หน้า {totalPages})</span>
                    <span>รายงานทางการ มูลนิธิร่วมกุศลสมุทรปราการ</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-x-2 text-[8.5px] text-slate-500 border-t border-slate-200 pt-1">
                    <div>
                      มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂) • 57/1 ซอยท้ายบ้าน 17 (ซอยมูลนิธิ) ถนนท้ายบ้าน ต.ปากน้ำ อ.เมืองสมุทรปราการ จ.สมุทรปราการ 10270 โทร.02 175 8668, 02 175 8789
                    </div>
                    <div>
                      พิมพ์เมื่อ: {formatThaiDate(new Date().toISOString().slice(0, 10))} เวลา{' '}
                      {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </div>,
    document.body
  );
}
