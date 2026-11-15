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
  Layers,
  MapPin,
  Calendar,
  CheckCircle2,
  Package
} from 'lucide-react';
import { PatientRecord, AdminUser, DiaperSize } from '../types';
import { formatCurrency, formatPhone, formatThaiDate } from '../utils/idCard';

interface PrintDeliveryPlanModalProps {
  patients: PatientRecord[];
  selectedDistrict: string;
  currentMonth: string;
  currentAdmin: AdminUser;
  riceBagsOverride?: number | null;
  riceUnitPrice?: number;
  onClose: () => void;
}

export const PrintDeliveryPlanModal: React.FC<PrintDeliveryPlanModalProps> = ({
  patients,
  selectedDistrict,
  currentMonth,
  currentAdmin,
  riceBagsOverride,
  riceUnitPrice = 0,
  onClose,
}) => {
  const [scale, setScale] = useState<number>(0.75);
  const [activeTab, setActiveTab] = useState<'all' | number>('all');

  // Mark body for print stylesheet
  useEffect(() => {
    document.body.classList.add('is-printing-sk04');
    return () => {
      document.body.classList.remove('is-printing-sk04');
    };
  }, []);

  // Auto-fit scale on viewport resize
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

  // Calculate totals
  const totalCash = useMemo(() => {
    return patients.reduce((sum, p) => sum + (p.helpCashEnabled ? p.helpCashAmount : 0), 0);
  }, [patients]);

  const totalRice = useMemo(() => {
    if (riceBagsOverride !== null && riceBagsOverride !== undefined) {
      return riceBagsOverride;
    }
    return patients.reduce((sum, p) => sum + (p.helpRicePacks || 0), 0);
  }, [patients, riceBagsOverride]);

  const waterCounts = useMemo(() => {
    let size15L = 0;
    let size600ML = 0;
    patients.forEach((p) => {
      if (p.helpWaterSize === '600ML') {
        size600ML += p.helpWaterPacks || 0;
      } else if (p.helpWaterSize !== 'NONE') {
        size15L += p.helpWaterPacks || 0;
      }
    });
    return { size15L, size600ML, total: size15L + size600ML };
  }, [patients]);

  const diaperCounts = useMemo(() => {
    const counts: Record<DiaperSize, number> = {
      S: 0,
      M: 0,
      L: 0,
      XL: 0,
      XXL: 0,
      NONE: 0,
    };
    patients.forEach((p) => {
      if (p.helpDiaperSize && p.helpDiaperSize !== 'NONE') {
        counts[p.helpDiaperSize] += p.helpDiaperPacks || 0;
      }
    });
    return counts;
  }, [patients]);

  const totalDiapers = useMemo(() => {
    return Object.entries(diaperCounts).reduce((sum, [size, qty]) => {
      return size === 'NONE' ? sum : sum + qty;
    }, 0);
  }, [diaperCounts]);

  // Layout-aware pagination: compact rows allow 15 entries to condense cleanly onto 2 well-organized pages, with signatures anchored at the end of the last page
  const pages = useMemo(() => {
    if (patients.length === 0) return [[]];

    const estimateRowHeight = (p: PatientRecord): number => {
      let h = 44;
      const addrLen =
        (p.currentAddress.houseNo || '').length +
        (p.currentAddress.buildingVillage || '').length +
        (p.currentAddress.road || '').length +
        (p.currentAddress.subdistrict || '').length +
        (p.currentAddress.district || '').length;
      if (addrLen > 68) h += 11;
      if (p.landmarkNote) {
        h += p.landmarkNote.length > 42 ? 20 : 11;
      }
      const supplyLines =
        (p.helpCashEnabled ? 1 : 0) +
        (p.helpDiaperSize && p.helpDiaperSize !== 'NONE' ? 1 : 0) +
        1 +
        (p.helpWaterSize !== 'NONE' && (p.helpWaterPacks || 0) > 0 ? 1 : 0) +
        (p.helpOtherSupplies ? (p.helpOtherSupplies.length > 34 ? 2 : 1) : 0);
      if (supplyLines >= 4) h += (supplyLines - 3) * 10;
      return h;
    };

    // Usable A4 height (295mm ~ 1114px, minus 12mm vertical padding ~ 45px, minus safety buffer ~ 39px = 1030px)
    const SAFE_SHEET_HEIGHT = 1030;
    const HEADER_SUBHEADER_THEAD = 124;
    const PAGE1_SUMMARY_HEIGHT = 44;
    const SIGNATURE_FOOTER_HEIGHT = 136;
    const NON_LAST_FOOTER_HEIGHT = 32;

    const getNonLastBudget = (pageIndex: number) =>
      SAFE_SHEET_HEIGHT -
      HEADER_SUBHEADER_THEAD -
      (pageIndex === 0 ? PAGE1_SUMMARY_HEIGHT : 0) -
      NON_LAST_FOOTER_HEIGHT;

    const getLastBudget = (pageIndex: number) =>
      SAFE_SHEET_HEIGHT -
      HEADER_SUBHEADER_THEAD -
      (pageIndex === 0 ? PAGE1_SUMMARY_HEIGHT : 0) -
      SIGNATURE_FOOTER_HEIGHT;

    const result: PatientRecord[][] = [];
    let currentRows: PatientRecord[] = [];
    let currentHeight = 0;

    for (const p of patients) {
      const rowH = estimateRowHeight(p);
      const budget = getNonLastBudget(result.length);
      if (currentRows.length > 0 && (currentHeight + rowH > budget || currentRows.length >= 10)) {
        result.push(currentRows);
        currentRows = [p];
        currentHeight = rowH;
      } else {
        currentRows.push(p);
        currentHeight += rowH;
      }
    }

    if (currentRows.length > 0) {
      const lastPageIndex = result.length;
      const lastBudget = getLastBudget(lastPageIndex);

      if (currentHeight > lastBudget && currentRows.length > 1) {
        let keptHeight = 0;
        let splitIdx = currentRows.length;
        for (let i = 0; i < currentRows.length; i++) {
          const rowH = estimateRowHeight(currentRows[i]);
          if (i > 0 && (keptHeight + rowH > getNonLastBudget(lastPageIndex) || keptHeight + rowH > lastBudget)) {
            splitIdx = i;
            break;
          }
          keptHeight += rowH;
        }
        result.push(currentRows.slice(0, splitIdx));
        result.push(currentRows.slice(splitIdx));
      } else {
        result.push(currentRows);
      }
    }

    return result.length > 0 ? result : [[]];
  }, [patients]);

  const totalPages = pages.length;

  const handlePrint = () => {
    window.print();
  };

  const districtLabel = selectedDistrict === 'all' 
    ? 'ทุกอำเภอ ในจังหวัดสมุทรปราการ' 
    : `อำเภอ${selectedDistrict} จังหวัดสมุทรปราการ`;

  return createPortal(
    <div className="a4-print-modal sk04-print-modal fixed inset-0 z-50 overflow-y-auto bg-slate-900/85 backdrop-blur-xs flex flex-col items-center p-2 sm:p-4">
      {/* Top Floating Control Bar - Hidden in Print */}
      <div className="no-print w-full max-w-5xl bg-white rounded-2xl shadow-2xl p-3 sm:p-4 mb-3 sticky top-2 z-50 border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Back & Title */}
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
                <h2 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>ตัวอย่างก่อนพิมพ์: แผนการส่งมอบสิ่งของ & บัญชีลงชื่อรับมอบ</span>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                    ขนาด A4 ({totalPages} หน้า)
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                รอบเดือน: <span className="font-semibold text-slate-700">{currentMonth}</span> • สายส่งมอบ: <span className="font-semibold text-slate-700">{districtLabel}</span> • ผู้ป่วยทั้งหมด: <span className="font-bold text-blue-700">{patients.length}</span> ราย
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setScale((s) => Math.max(0.4, parseFloat((s - 0.05).toFixed(2))))}
                className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition"
                title="ย่อขนาด"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono px-1 font-semibold text-slate-700 min-w-10 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => Math.min(1.2, parseFloat((s + 0.05).toFixed(2))))}
                className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition"
                title="ขยายขนาด"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setScale(0.75)}
                className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition"
                title="ขนาดพอดี"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-md cursor-pointer"
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
        {pages.map((pagePatients, pageIdx) => {
          // If viewing a specific tab and it's not this page, hide on screen (visible in print via CSS)
          const isHiddenOnScreen = activeTab !== 'all' && activeTab !== pageIdx;
          const isLastPage = pageIdx === totalPages - 1;
          const startNo = pages
            .slice(0, pageIdx)
            .reduce((sum, rows) => sum + rows.length, 0);

          return (
            <div
              key={pageIdx}
              className={`a4-sheet a4-sheet-compact bg-white text-slate-900 shadow-2xl relative flex flex-col justify-between p-4 sm:py-[6mm] sm:px-[9mm] border border-slate-300 font-['Sarabun',sans-serif] ${
                isHiddenOnScreen ? 'hidden print:flex' : 'flex'
              } ${isLastPage ? 'last-sheet' : ''}`}
            >
              {/* Top Section: Header & Summary */}
              <div className="space-y-1.5">
                {/* Official Foundation Header */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-1.5">
                  <div className="flex items-center gap-2.5">
                    <img
                      src="/assets/aistudio/382492-Photoroom_4c9e02f3.png"
                      alt="ตรามูลนิธิร่วมกุศลสมุทรปราการ"
                      className="w-11 h-11 object-contain shrink-0"
                    />
                    <div>
                      <div className="text-[14.5px] font-black text-slate-900 tracking-tight leading-tight">
                        มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂)
                      </div>
                      <div className="text-[11px] font-bold text-blue-900 leading-tight mt-0.5">
                        โครงการใจถึงใจช่วยผู้ป่วยติดเตียงและยากไร้
                      </div>
                      <div className="text-[10.5px] font-semibold text-slate-800 leading-tight">
                        แผนการส่งมอบสิ่งของสงเคราะห์ & บัญชีลงลายมือชื่อรับมอบสิ่งของประจำเดือน
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="inline-block border border-slate-900 rounded px-2 py-0.5 text-[9.5px] font-bold text-slate-900 bg-slate-50">
                      เอกสารโครงการใจถึงใจ
                    </div>
                    <div className="text-[10px] font-semibold text-slate-700 mt-0.5">
                      รอบเดือน: <span className="text-blue-900 font-bold">{currentMonth}</span>
                    </div>
                    <div className="text-[9.5px] text-slate-500 font-mono">
                      หน้า {pageIdx + 1} จาก {totalPages}
                    </div>
                  </div>
                </div>

                {/* Sub-header: District & Officer */}
                <div className="flex flex-wrap items-center justify-between text-[10.5px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                    <MapPin className="w-3 h-3 text-red-600 shrink-0" />
                    <span>สายส่งมอบ: <strong className="text-slate-900">{districtLabel}</strong></span>
                  </div>
                  <div className="text-[10px] text-slate-700">
                    เจ้าหน้าที่ผู้จัดทำ/ลงพื้นที่: <strong className="text-slate-900">นายกริชพิพัฒน์  สลับทอง</strong> (เจ้าหน้าที่ฝ่ายสังคมสงเคราะห์)
                  </div>
                </div>

                {/* Page 1 Summary Card */}
                {pageIdx === 0 && (
                  <div className="grid grid-cols-5 gap-1.5 text-center text-[9.5px] border border-blue-200 bg-blue-50/60 px-2 py-1 rounded">
                    <div className="border-r border-blue-200/80 pr-1">
                      <div className="text-slate-500 text-[9px] leading-tight">ผู้ป่วยรับมอบ</div>
                      <div className="font-black text-[12px] text-slate-900 leading-tight">{patients.length} ราย</div>
                    </div>
                    <div className="border-r border-blue-200/80 pr-1">
                      <div className="text-slate-500 text-[9px] leading-tight">เงินสดรวม</div>
                      <div className="font-black text-[12px] text-emerald-700 leading-tight">{formatCurrency(totalCash)} บ.</div>
                    </div>
                    <div className="border-r border-blue-200/80 pr-1">
                      <div className="text-slate-500 text-[9px] leading-tight">ข้าวสาร (5 กก.)</div>
                      <div className="font-black text-[12px] text-amber-800 leading-tight">{totalRice} ถุง</div>
                      {riceUnitPrice > 0 && (
                        <div className="text-[8px] text-slate-600 leading-none">
                          (@{formatCurrency(riceUnitPrice)} = {formatCurrency(totalRice * riceUnitPrice)} บ.)
                        </div>
                      )}
                    </div>
                    <div className="border-r border-blue-200/80 pr-1">
                      <div className="text-slate-500 text-[9px] leading-tight">น้ำดื่มสิงห์รวม</div>
                      <div className="font-black text-[12px] text-cyan-800 leading-tight">{waterCounts.total} แพ็ค</div>
                      <div className="text-[8px] text-slate-600 leading-none">
                        (1.5L:{waterCounts.size15L} • 600ML:{waterCounts.size600ML})
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[9px] leading-tight">ผ้าอ้อมผู้ใหญ่</div>
                      <div className="font-black text-[12px] text-indigo-800 leading-tight">
                        {totalDiapers} ห่อ
                      </div>
                      <div className="text-[8px] text-slate-600 leading-none">
                        (M:{diaperCounts.M} L:{diaperCounts.L} XL:{diaperCounts.XL} XXL:{diaperCounts.XXL})
                      </div>
                    </div>
                  </div>
                )}

                {/* Patient Delivery Dispatch Table */}
                <div className="border border-slate-900 rounded overflow-hidden">
                  <table className="w-full table-fixed text-left border-collapse text-[9.5px] leading-[1.22]">
                    <thead>
                      <tr className="bg-slate-800 text-white font-bold text-center border-b border-slate-900">
                        <th className="py-1 px-1 w-[5%] border-r border-slate-700">ลำดับ</th>
                        <th className="py-1 px-1.5 w-[22%] text-left border-r border-slate-700">รหัส / ชื่อผู้ป่วย</th>
                        <th className="py-1 px-1.5 w-[35%] border-r border-slate-700 text-left">ที่อยู่ส่งมอบ & เบอร์ติดต่อ</th>
                        <th className="py-1 px-1.5 w-[24%] border-r border-slate-700 text-left">รายการสิ่งของส่งมอบ</th>
                        <th className="py-1 px-1 w-[14%] text-center">ลายมือชื่อผู้รับมอบ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {pagePatients.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                            ไม่มีรายการผู้ป่วยที่จะส่งมอบในสายนี้
                          </td>
                        </tr>
                      ) : (
                        pagePatients.map((patient, pRowIdx) => {
                          const globalIdx = startNo + pRowIdx + 1;
                          const mobilityText = 
                            patient.mobilityLevel === 'bedridden' ? 'ติดเตียง 100%' :
                            patient.mobilityLevel === 'semi_bedridden' ? 'กึ่งติดเตียง' : 'พอเดินได้';

                          return (
                            <tr key={patient.id} className="align-top hover:bg-slate-50">
                              {/* No. */}
                              <td className="py-[3px] px-1 text-center font-bold text-slate-800 border-r border-slate-300">
                                {globalIdx}
                              </td>

                              {/* Patient ID & Name */}
                              <td className="py-[3px] px-1.5 border-r border-slate-300 break-words">
                                <div className="font-bold text-slate-900 text-[10px] leading-tight">
                                  {patient.fullName}
                                </div>
                                <div className="text-[9px] text-slate-700 leading-tight mt-0.5">
                                  <span className="font-mono font-bold text-blue-800">{patient.code}</span>
                                  <span> • {mobilityText}</span>
                                </div>
                                <div className="text-[8.5px] text-slate-500 font-mono leading-tight">
                                  บัตร: {patient.nationalId ? patient.nationalId.slice(0, 10) + '...' : '-'}
                                </div>
                              </td>

                              {/* Address, Landmark & Contact */}
                              <td className="py-[3px] px-1.5 border-r border-slate-300 break-words">
                                <div className="font-medium text-slate-800 text-[9px] leading-tight">
                                  เลขที่ {patient.currentAddress.houseNo}
                                  {patient.currentAddress.buildingVillage && ` ${patient.currentAddress.buildingVillage}`}
                                  {patient.currentAddress.road && ` ถ.${patient.currentAddress.road}`}
                                  {` ต.${patient.currentAddress.subdistrict} อ.${patient.currentAddress.district}`}
                                </div>
                                {patient.landmarkNote && (
                                  <div className="text-[8.5px] text-amber-900 italic leading-tight mt-0.5">
                                    จุดสังเกต: {patient.landmarkNote}
                                  </div>
                                )}
                                <div className="text-[8.5px] text-slate-700 leading-tight mt-0.5">
                                  ผู้ดูแล: <span className="font-semibold">{patient.caregiverName || patient.fullName}</span>
                                  {patient.caregiverPhone && ` (${formatPhone(patient.caregiverPhone)})`}
                                </div>
                              </td>

                              {/* Items to Deliver */}
                              <td className="py-[3px] px-1.5 border-r border-slate-300 break-words">
                                <div className="space-y-[1px] text-[9px] leading-tight">
                                  {patient.helpCashEnabled && (
                                    <div className="font-bold text-emerald-900">
                                      [✓] เงินสด: <strong>{formatCurrency(patient.helpCashAmount)}</strong> บ.
                                    </div>
                                  )}
                                  {patient.helpDiaperSize && patient.helpDiaperSize !== 'NONE' && (
                                    <div className="font-semibold text-blue-950">
                                      [✓] ผ้าอ้อม: ไซส์ <strong>{patient.helpDiaperSize}</strong> ({patient.helpDiaperPacks} ห่อ)
                                    </div>
                                  )}
                                  <div>
                                    [✓] ข้าวสาร 5 กก. ({patient.helpRicePacks} ถุง)
                                  </div>
                                  {patient.helpWaterSize !== 'NONE' && (patient.helpWaterPacks || 0) > 0 && (
                                    <div>
                                      [✓] น้ำสิงห์ {patient.helpWaterSize === '600ML' ? '600ML(12ขวด)' : '1.5L(6ขวด)'} ({patient.helpWaterPacks} แพ็ค)
                                    </div>
                                  )}
                                  {patient.helpOtherSupplies && (
                                    <div className="text-[8.5px] text-slate-600">
                                      [✓] อื่นๆ: {patient.helpOtherSupplies}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Recipient Signature Box */}
                              <td className="py-[3px] px-1 text-center bg-slate-50/50 align-middle">
                                <div className="pt-3.5 pb-0.5">
                                  <div className="border-b border-dotted border-slate-700 w-20 mx-auto"></div>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Section: Official Foundation Signatures anchored at the very end of the Final Page ONLY */}
              <div className="mt-auto pt-2 border-t-2 border-slate-900 space-y-1.5 signature-block-keep">
                {isLastPage ? (
                  <div className="grid grid-cols-2 gap-6 text-center">
                    {/* Left: Officer Signature (นายกริชพิพัฒน์ สลับทอง) */}
                    <div className="space-y-0.5 py-1.5 px-2 bg-slate-50/80 rounded border border-slate-200">
                      <div className="text-[11px] font-bold text-slate-900">
                        ผู้ส่งมอบ / ผู้จัดทำแผนการส่งมอบ
                      </div>
                      <div className="pt-6 border-b border-dotted border-slate-700 w-52 mx-auto"></div>
                      <div className="text-[11px] font-black text-slate-900 mt-1">
                        ( นายกริชพิพัฒน์ สลับทอง )
                      </div>
                      <div className="text-[10px] font-semibold text-slate-700">
                        เจ้าหน้าที่ฝ่ายสังคมสงเคราะห์
                      </div>
                      <div className="text-[9px] text-slate-500">
                        วันที่ .......... เดือน .............................. พ.ศ. ................
                      </div>
                    </div>

                    {/* Right: Foundation Manager Approval (นางสาวศาตพร ภูมิโคกรักษ์) */}
                    <div className="space-y-0.5 py-1.5 px-2 bg-slate-50/80 rounded border border-slate-200">
                      <div className="text-[11px] font-bold text-slate-900">
                        ผู้ตรวจสอบและอนุมัติการส่งมอบ
                      </div>
                      <div className="pt-6 border-b border-dotted border-slate-700 w-52 mx-auto"></div>
                      <div className="text-[11px] font-black text-slate-900 mt-1">
                        ( นางสาวศาตพร ภูมิโคกรักษ์ )
                      </div>
                      <div className="text-[10px] font-semibold text-slate-700">
                        ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ
                      </div>
                      <div className="text-[9px] text-slate-500">
                        วันที่ .......... เดือน .............................. พ.ศ. ................
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[9.5px] text-slate-500 px-1">
                    <span>(มีรายการต่อหน้าถัดไป — ลงชื่อผู้ส่งมอบและผู้อนุมัติในหน้าสุดท้ายแผ่นเดียว หน้า {totalPages})</span>
                    <span>แผนการส่งมอบสิ่งของสงเคราะห์ • มูลนิธิร่วมกุศลสมุทรปราการ</span>
                  </div>
                )}

                {/* Footer Watermark */}
                <div className="flex items-center justify-between text-[8.5px] text-slate-500 border-t border-slate-200 pt-1">
                  <div>
                    ระบบดิจิทัล BD-Care • มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂) • โทร. 02-395-0118, 02-387-1111
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
};
