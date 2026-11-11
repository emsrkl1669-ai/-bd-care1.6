import React, { useState, useEffect } from 'react';
import { DonationDistributionRecord } from '../types';
import { formatNationalId, formatPhone, formatThaiDate } from '../utils/idCard';
import { Printer, X, ArrowLeft, ZoomIn, ZoomOut, Minimize2, FileText, CheckCircle2 } from 'lucide-react';

interface PrintDonationFormProps {
  record: DonationDistributionRecord;
  onClose: () => void;
}

export const PrintDonationForm: React.FC<PrintDonationFormProps> = ({ record, onClose }) => {
  const isIndividual = record.recipientType === 'individual';
  const [scale, setScale] = useState<number>(0.8);

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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="a4-print-modal fixed inset-0 z-50 overflow-y-auto bg-slate-900/85 backdrop-blur-xs flex flex-col items-center p-2 sm:p-4">
      {/* Floating Action Bar - Hidden in Print */}
      <div className="no-print w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-3 sm:p-4 mb-3 sticky top-2 z-50 border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
                <FileText className="w-4 h-4 text-amber-600" />
                <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                  ใบสำคัญการส่งมอบสิ่งของบริจาคสงเคราะห์ (A4)
                </h2>
                <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md font-mono">
                  {record.code}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                ผู้รับ: <strong className="text-slate-800">{isIndividual ? `${record.individualTitle}${record.individualName}` : record.agencyName}</strong> • วันที่: {formatThaiDate(record.distributionDate)}
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
                onClick={() => setScale(0.8)}
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
              <span>สั่งพิมพ์ / บันทึก PDF (A4)</span>
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
      </div>

      {/* Printable A4 Container */}
      <div
        className="w-full flex flex-col items-center a4-container transition-all duration-150 origin-top pb-10"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          marginBottom: scale < 1 ? `-${Math.round((1 - scale) * 1150)}px` : undefined,
        }}
      >
        {/* A4 Sheet (Standard 210mm x 297mm) */}
        <div className="a4-sheet bg-white text-black shadow-2xl rounded-xs p-6 sm:p-[14mm] border border-slate-300 relative font-['Sarabun',sans-serif] flex flex-col justify-between">
          <div>
            {/* Header with Foundation Seal */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-3">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/aistudio/382492-Photoroom_4c9e02f3.png"
                  alt="ตรามูลนิธิร่วมกุศลสมุทรปราการ"
                  className="w-14 h-14 object-contain shrink-0"
                />
                <div>
                  <div className="text-base font-bold text-slate-900 leading-tight">
                    มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂)
                  </div>
                  <div className="text-[12px] font-semibold text-slate-800 mt-0.5">
                    โครงการสงเคราะห์ผู้ยากไร้และสาธารณประโยชน์ • งานสังคมสงเคราะห์และบรรเทาสาธารณภัย
                  </div>
                  <div className="text-[10px] text-slate-600">
                    เลขที่ 158 ถนนประโคนชัย ตำบลปากน้ำ อำเภอเมืองสมุทรปราการ จังหวัดสมุทรปราการ 10270 • โทร. 02-395-0919, 02-387-1111
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="inline-block border-2 border-slate-900 px-3 py-0.5 rounded-xs bg-slate-50 text-right">
                  <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                    แบบฟอร์ม บจ.01
                  </div>
                  <div className="text-xs font-black font-mono text-slate-900">
                    {record.code}
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 mt-1">
                  วันที่: <span className="font-semibold text-slate-900">{formatThaiDate(record.distributionDate)}</span>
                </div>
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center my-2.5">
              <h2 className="text-base font-bold text-slate-900 tracking-wide uppercase underline underline-offset-4">
                ใบสำคัญการส่งมอบสิ่งของบริจาคสงเคราะห์
              </h2>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {isIndividual ? 'สำหรับประชาชนทั่วไป / ผู้ยากไร้ / ผู้ประสบปัญหาทางสังคม' : 'สำหรับหน่วยงานราชการ / องค์กรสาธารณประโยชน์'}
              </p>
            </div>

            {/* Section 1: Recipient Information */}
            <div className="border border-slate-900 p-2.5 bg-slate-50/40 mb-2.5 text-[11.5px] space-y-1">
              <div className="font-bold text-xs text-slate-900 border-b border-slate-300 pb-0.5 mb-1 flex items-center justify-between">
                <span>
                  1. ข้อมูลผู้รับมอบสิ่งของบริจาค ({isIndividual ? 'ประชาชนทั่วไป' : 'หน่วยงานราชการ'}):
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-semibold">
                  {isIndividual ? (record.individualCategory || 'ประชาชนทั่วไป') : (record.agencyType || 'ส่วนราชการ')}
                </span>
              </div>

              {isIndividual ? (
                <>
                  <div className="grid grid-cols-12 gap-1.5">
                    <div className="col-span-7">
                      <span className="font-bold">ชื่อ-นามสกุล ผู้รับมอบ:</span>{' '}
                      <span className="font-semibold text-slate-900">
                        {record.individualTitle} {record.individualName}
                      </span>
                    </div>
                    <div className="col-span-5">
                      <span className="font-bold">เลขประจำตัวประชาชน:</span>{' '}
                      <span className="font-mono font-semibold">
                        {formatNationalId(record.individualNationalId || '') || '-'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-1.5">
                    <div className="col-span-7">
                      <span className="font-bold">ที่อยู่ / ชุมชน:</span> {record.individualAddress || '-'}
                    </div>
                    <div className="col-span-5">
                      <span className="font-bold">เบอร์โทรศัพท์ติดต่อ:</span>{' '}
                      <span className="font-mono">{formatPhone(record.individualPhone || '') || '-'}</span>
                    </div>
                  </div>

                  <div>
                    <span className="font-bold">เหตุผลความจำเป็น / สภาพปัญหา:</span>{' '}
                    <span className="text-slate-700">{record.individualNeedReason || 'ครอบครัวมีฐานะยากจน รายได้ไม่เพียงพอต่อการดำรงชีพ'}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-12 gap-1.5">
                    <div className="col-span-7">
                      <span className="font-bold">ชื่อหน่วยงานราชการ / องค์กร:</span>{' '}
                      <span className="font-bold text-slate-900">{record.agencyName}</span>
                    </div>
                    <div className="col-span-5">
                      <span className="font-bold">ประเภทหน่วยงาน:</span> {record.agencyType || '-'}
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-1.5">
                    <div className="col-span-7">
                      <span className="font-bold">ชื่อผู้แทน / ผู้รับมอบ:</span>{' '}
                      <span className="font-semibold text-slate-900">{record.agencyContactPerson}</span>
                      {record.agencyContactPosition && (
                        <span className="text-slate-600"> (ตำแหน่ง: {record.agencyContactPosition})</span>
                      )}
                    </div>
                    <div className="col-span-5">
                      <span className="font-bold">เบอร์โทรศัพท์ติดต่อ:</span>{' '}
                      <span className="font-mono">{formatPhone(record.agencyPhone || '') || '-'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-1.5">
                    <div className="col-span-7">
                      <span className="font-bold">สถานที่ตั้งหน่วยงาน:</span> {record.agencyAddress || '-'}
                    </div>
                    <div className="col-span-5">
                      <span className="font-bold">เลขที่หนังสือขอความอนุเคราะห์:</span>{' '}
                      <span className="font-semibold">{record.officialLetterNo || '-'}</span>
                    </div>
                  </div>

                  <div>
                    <span className="font-bold">วัตถุประสงค์ในการขอรับบริจาค:</span>{' '}
                    <span className="text-slate-700">{record.agencyRequestPurpose || 'เพื่อนำไปแจกจ่ายและช่วยเหลือประชาชนในพื้นที่รับผิดชอบ'}</span>
                  </div>
                </>
              )}
            </div>

            {/* Section 2: Donated Items Table */}
            <div className="border border-slate-900 mb-2.5 overflow-hidden text-[11px]">
              <div className="bg-slate-900 text-white font-bold p-1.5 text-xs flex items-center justify-between">
                <span>2. รายการสิ่งของที่มูลนิธิร่วมกุศลสมุทรปราการ ให้การบริจาค / ส่งมอบ:</span>
                <span className="text-[10.5px] font-normal text-slate-200">
                  สถานะ: {record.status === 'completed' ? 'ส่งมอบเสร็จสิ้น' : 'รอส่งมอบ'}
                </span>
              </div>

              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                    <th className="p-1.5 border-r border-slate-300 w-12 text-center">ลำดับ</th>
                    <th className="p-1.5 border-r border-slate-300">รายการสิ่งของบริจาค</th>
                    <th className="p-1.5 border-r border-slate-300 w-24 text-center">จำนวน</th>
                    <th className="p-1.5 border-r border-slate-300 w-20 text-center">หน่วยนับ</th>
                    <th className="p-1.5">หมายเหตุ / รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* Item 1: Water */}
                  <tr>
                    <td className="p-1.5 border-r border-slate-300 text-center font-bold">1</td>
                    <td className="p-1.5 border-r border-slate-300 font-semibold text-slate-900">
                      น้ำดื่มสะอาด (มูลนิธิร่วมกุศลสมุทรปราการ)
                    </td>
                    <td className="p-1.5 border-r border-slate-300 text-center font-bold text-blue-900 font-mono">
                      {record.waterPacks ? record.waterPacks.toLocaleString() : '-'}
                    </td>
                    <td className="p-1.5 border-r border-slate-300 text-center text-slate-700">
                      {record.waterUnit || 'แพ็ค'}
                    </td>
                    <td className="p-1.5 text-slate-600 text-[10.5px]">
                      {record.waterPacks > 0 ? 'บรรจุน้ำดื่มบรรจุขวดมาตรฐาน' : 'ไม่ได้รับในรอบนี้'}
                    </td>
                  </tr>

                  {/* Item 2: Dry Food */}
                  <tr>
                    <td className="p-1.5 border-r border-slate-300 text-center font-bold">2</td>
                    <td className="p-1.5 border-r border-slate-300 font-semibold text-slate-900">
                      อาหารแห้ง (ปลากระป๋อง, บะหมี่กึ่งสำเร็จรูป, เครื่องปรุง ฯลฯ)
                    </td>
                    <td className="p-1.5 border-r border-slate-300 text-center font-bold text-blue-900 font-mono">
                      {record.dryFoodCount ? record.dryFoodCount.toLocaleString() : '-'}
                    </td>
                    <td className="p-1.5 border-r border-slate-300 text-center text-slate-700">
                      {record.dryFoodUnit || 'ชุด'}
                    </td>
                    <td className="p-1.5 text-slate-600 text-[10.5px]">
                      {record.dryFoodCount > 0 ? 'ชุดถุงยังชีพ / กล่องอาหารแห้งยังชีพ' : 'ไม่ได้รับในรอบนี้'}
                    </td>
                  </tr>

                  {/* Item 3: Rice */}
                  <tr>
                    <td className="p-1.5 border-r border-slate-300 text-center font-bold">3</td>
                    <td className="p-1.5 border-r border-slate-300 font-semibold text-slate-900">
                      ข้าวสาร (ข้าวขาวคัดพิเศษ ถุงละ 5 กิโลกรัม)
                    </td>
                    <td className="p-1.5 border-r border-slate-300 text-center font-bold text-blue-900 font-mono">
                      {record.riceBags ? record.riceBags.toLocaleString() : '-'}
                    </td>
                    <td className="p-1.5 border-r border-slate-300 text-center text-slate-700">
                      ถุง (5 กก.)
                    </td>
                    <td className="p-1.5 text-slate-600 text-[10.5px]">
                      {record.riceBags > 0 ? `รวมน้ำหนัก ${(record.riceBags * 5).toLocaleString()} กก.` : 'ไม่ได้รับในรอบนี้'}
                    </td>
                  </tr>

                  {/* Item 4: Diapers */}
                  <tr>
                    <td className="p-1.5 border-r border-slate-300 text-center font-bold">4</td>
                    <td className="p-1.5 border-r border-slate-300 font-semibold text-slate-900">
                      แพมเพิส / ผ้าอ้อมผู้ใหญ่หรือผ้าอ้อมเด็ก
                    </td>
                    <td className="p-1.5 border-r border-slate-300 text-center font-bold text-blue-900 font-mono">
                      {record.diaperPacks ? record.diaperPacks.toLocaleString() : '-'}
                    </td>
                    <td className="p-1.5 border-r border-slate-300 text-center text-slate-700">
                      แพ็ค/ห่อ
                    </td>
                    <td className="p-1.5 text-slate-600 text-[10.5px]">
                      {record.diaperPacks > 0 ? `ขนาด: ${record.diaperSize || 'คละไซส์'}` : 'ไม่ได้รับในรอบนี้'}
                    </td>
                  </tr>

                  {/* Other Items */}
                  {record.otherItems && record.otherItems.length > 0 && record.otherItems.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="p-1.5 border-r border-slate-300 text-center font-bold">{5 + idx}</td>
                      <td className="p-1.5 border-r border-slate-300 font-semibold text-slate-900">
                        {item.name}
                      </td>
                      <td className="p-1.5 border-r border-slate-300 text-center font-bold text-blue-900 font-mono">
                        {item.quantity.toLocaleString()}
                      </td>
                      <td className="p-1.5 border-r border-slate-300 text-center text-slate-700">
                        {item.unit}
                      </td>
                      <td className="p-1.5 text-slate-600 text-[10.5px]">
                        สิ่งของช่วยเหลือเพิ่มเติม
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Section 3: Delivery Place & Method */}
            <div className="border border-slate-900 p-2 bg-slate-50/40 mb-3 text-[11px]">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-6">
                  <span className="font-bold">สถานที่ส่งมอบ:</span>{' '}
                  <span className="font-semibold">{record.handoverPlace || 'มูลนิธิร่วมกุศลสมุทรปราการ'}</span>
                </div>
                <div className="col-span-6">
                  <span className="font-bold">วิธีการส่งมอบ:</span>{' '}
                  <span className="font-semibold">{record.deliveryMethod || 'รับเองที่มูลนิธิฯ'}</span>
                </div>
              </div>
              {record.notes && (
                <div className="mt-1 text-slate-600">
                  <span className="font-bold">หมายเหตุเพิ่มเติม:</span> {record.notes}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Signatures & Certification */}
          <div className="pt-2 border-t-2 border-slate-900">
            <div className="text-[10.5px] text-slate-700 text-center mb-3 leading-tight">
              ข้าพเจ้าขอรับรองว่าได้รับมอบสิ่งของบริจาคตามรายการข้างต้นจาก มูลนิธิร่วมกุศลสมุทรปราการ ไว้เรียบร้อยครบถ้วนถูกต้องแล้ว<br />
              เพื่อนำไปใช้ประโยชน์ตามวัตถุประสงค์ในการสงเคราะห์ผู้ยากไร้และภารกิจสาธารณประโยชน์อย่างแท้จริง
            </div>

            <div className="grid grid-cols-3 gap-3 text-center text-[10.5px]">
              {/* 1. Recipient Signature */}
              <div className="flex flex-col items-center">
                <div className="text-slate-400 mb-2.5">...................................................</div>
                <div className="font-bold text-slate-900">
                  ( {isIndividual ? `${record.individualTitle || ''}${record.individualName || '................................................'}` : `${record.agencyContactPerson || '................................................'}`} )
                </div>
                <div className="text-slate-600 text-[10px]">ผู้รับมอบสิ่งของบริจาค</div>
                <div className="text-slate-400 text-[9.5px]">วันที่ ........./........./............</div>
              </div>

              {/* 2. Officer Signature */}
              <div className="flex flex-col items-center">
                <div className="text-slate-400 mb-2.5">...................................................</div>
                <div className="font-bold text-slate-900">( นายกริชพิพัฒน์  สลับทอง )</div>
                <div className="text-slate-600 text-[10px]">เจ้าหน้าที่ฝ่ายสังคมสงเคราะห์ (ผู้ส่งมอบ)</div>
                <div className="text-slate-400 text-[9.5px]">วันที่ ........./........./............</div>
              </div>

              {/* 3. Foundation Manager Signature */}
              <div className="flex flex-col items-center">
                <div className="text-slate-400 mb-2.5">...................................................</div>
                <div className="font-bold text-slate-900">( นางสาวศาตพร ภูมิโคกรักษ์ )</div>
                <div className="text-slate-600 text-[10px]">ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ (ผู้อนุมัติ)</div>
                <div className="text-slate-400 text-[9.5px]">วันที่ ........./........./............</div>
              </div>
            </div>

            <div className="text-center text-[9.5px] text-slate-400 mt-2.5 border-t border-slate-200 pt-1">
              เอกสารทางการ มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂) • แบบฟอร์ม บจ.01 ขนาดมาตรฐาน A4
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
