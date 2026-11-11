import React from 'react';
import { DonationDistributionRecord } from '../types';
import { formatNationalId, formatPhone, formatThaiDate } from '../utils/idCard';
import { Printer, X } from 'lucide-react';

interface PrintDonationFormProps {
  record: DonationDistributionRecord;
  onClose: () => void;
}

export const PrintDonationForm: React.FC<PrintDonationFormProps> = ({ record, onClose }) => {
  const isIndividual = record.recipientType === 'individual';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex flex-col items-center p-2 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Floating Action Bar - Hidden in Print */}
      <div className="no-print w-full max-w-4xl bg-slate-900 text-white px-4 py-3 rounded-t-2xl flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-2">
          <Printer className="w-5 h-5 text-amber-400" />
          <span className="font-bold text-sm">
            ตัวอย่างก่อนพิมพ์: ใบสำคัญการส่งมอบสิ่งของบริจาค ({record.code})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>สั่งพิมพ์เอกสาร (Print / PDF)</span>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable Paper (A4 Style) */}
      <div className="w-full max-w-4xl bg-white text-slate-900 shadow-2xl p-6 sm:p-10 border border-slate-300 print:border-none print:shadow-none print:p-6 print:w-full font-sans">
        
        {/* Header with Foundation Seal */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-4">
          <div className="flex items-center gap-3.5">
            <img
              src="/assets/aistudio/382492-Photoroom_4c9e02f3.png"
              alt="ตรามูลนิธิร่วมกุศลสมุทรปราการ"
              className="w-16 h-16 object-contain shrink-0"
            />
            <div>
              <div className="text-lg font-black text-slate-900 leading-tight">
                มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂)
              </div>
              <div className="text-xs text-slate-700 font-semibold mt-0.5">
                โครงการสงเคราะห์ผู้ยากไร้และสาธารณประโยชน์ • งานสังคมสงเคราะห์และบรรเทาสาธารณภัย
              </div>
              <div className="text-[11px] text-slate-500">
                เลขที่ 158 ถนนประโคนชัย ตำบลปากน้ำ อำเภอเมืองสมุทรปราการ จังหวัดสมุทรปราการ 10270 • โทร. 02-395-0919
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="inline-block border-2 border-slate-900 px-3 py-1 rounded-sm bg-slate-50 text-right">
              <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                เลขที่บันทึกบริจาค
              </div>
              <div className="text-sm font-black font-mono text-slate-900">
                {record.code}
              </div>
            </div>
            <div className="text-[11px] text-slate-600 mt-1.5">
              วันที่: <span className="font-semibold">{formatThaiDate(record.distributionDate)}</span>
            </div>
          </div>
        </div>

        {/* Document Title */}
        <div className="text-center my-4">
          <h2 className="text-base font-black text-slate-900 tracking-wide uppercase">
            ใบสำคัญการส่งมอบสิ่งของบริจาคสงเคราะห์
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            {isIndividual ? 'สำหรับประชาชนทั่วไป / ผู้ยากไร้ / ผู้ประสบปัญหาทางสังคม' : 'สำหรับหน่วยงานราชการ / องค์กรสาธารณประโยชน์'}
          </p>
        </div>

        {/* Section 1: Recipient Information */}
        <div className="border border-slate-900 p-3 bg-slate-50/50 mb-3 text-xs space-y-1.5">
          <div className="font-bold text-xs text-slate-900 border-b border-slate-300 pb-1 mb-1.5 flex items-center justify-between">
            <span>
              1. ข้อมูลผู้รับมอบสิ่งของบริจาค: ({isIndividual ? 'ประชาชนทั่วไป' : 'หน่วยงานราชการ'})
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-semibold">
              {isIndividual ? (record.individualCategory || 'ประชาชนทั่วไป') : (record.agencyType || 'ส่วนราชการ')}
            </span>
          </div>

          {isIndividual ? (
            <>
              <div className="grid grid-cols-12 gap-2">
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

              <div className="grid grid-cols-12 gap-2">
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
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-7">
                  <span className="font-bold">ชื่อหน่วยงานราชการ / องค์กร:</span>{' '}
                  <span className="font-bold text-slate-900">{record.agencyName}</span>
                </div>
                <div className="col-span-5">
                  <span className="font-bold">ประเภทหน่วยงาน:</span> {record.agencyType || '-'}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2">
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

              <div className="grid grid-cols-12 gap-2">
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
        <div className="border border-slate-900 mb-3 overflow-hidden text-xs">
          <div className="bg-slate-900 text-white font-bold p-2 text-xs flex items-center justify-between">
            <span>2. รายการสิ่งของที่มูลนิธิร่วมกุศลสมุทรปราการ ให้การบริจาค / ส่งมอบ:</span>
            <span className="text-[11px] font-normal text-slate-200">
              สถานะ: {record.status === 'completed' ? 'ส่งมอบเสร็จสิ้น' : 'รอส่งมอบ'}
            </span>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                <th className="p-2 border-r border-slate-300 w-12 text-center">ลำดับ</th>
                <th className="p-2 border-r border-slate-300">รายการสิ่งของบริจาค</th>
                <th className="p-2 border-r border-slate-300 w-28 text-center">จำนวน</th>
                <th className="p-2 border-r border-slate-300 w-24 text-center">หน่วยนับ</th>
                <th className="p-2">หมายเหตุ / รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {/* Item 1: Water */}
              <tr>
                <td className="p-2 border-r border-slate-300 text-center font-bold">1</td>
                <td className="p-2 border-r border-slate-300 font-semibold text-slate-900">
                  น้ำดื่มสะอาด (มูลนิธิร่วมกุศลสมุทรปราการ)
                </td>
                <td className="p-2 border-r border-slate-300 text-center font-bold text-blue-700 font-mono text-sm">
                  {record.waterPacks ? record.waterPacks.toLocaleString() : '-'}
                </td>
                <td className="p-2 border-r border-slate-300 text-center text-slate-700">
                  {record.waterUnit || 'แพ็ค'}
                </td>
                <td className="p-2 text-slate-600 text-[11px]">
                  {record.waterPacks > 0 ? 'บรรจุน้ำดื่มบรรจุขวดมาตรฐาน' : 'ไม่ได้รับในรอบนี้'}
                </td>
              </tr>

              {/* Item 2: Dry Food */}
              <tr>
                <td className="p-2 border-r border-slate-300 text-center font-bold">2</td>
                <td className="p-2 border-r border-slate-300 font-semibold text-slate-900">
                  อาหารแห้ง (ปลากระป๋อง, บะหมี่กึ่งสำเร็จรูป, เครื่องปรุง ฯลฯ)
                </td>
                <td className="p-2 border-r border-slate-300 text-center font-bold text-blue-700 font-mono text-sm">
                  {record.dryFoodCount ? record.dryFoodCount.toLocaleString() : '-'}
                </td>
                <td className="p-2 border-r border-slate-300 text-center text-slate-700">
                  {record.dryFoodUnit || 'ชุด'}
                </td>
                <td className="p-2 text-slate-600 text-[11px]">
                  {record.dryFoodCount > 0 ? 'ชุดถุงยังชีพ / กล่องอาหารแห้งยังชีพ' : 'ไม่ได้รับในรอบนี้'}
                </td>
              </tr>

              {/* Item 3: Rice */}
              <tr>
                <td className="p-2 border-r border-slate-300 text-center font-bold">3</td>
                <td className="p-2 border-r border-slate-300 font-semibold text-slate-900">
                  ข้าวสาร (ข้าวขาวคัดพิเศษ ถุงละ 5 กิโลกรัม)
                </td>
                <td className="p-2 border-r border-slate-300 text-center font-bold text-blue-700 font-mono text-sm">
                  {record.riceBags ? record.riceBags.toLocaleString() : '-'}
                </td>
                <td className="p-2 border-r border-slate-300 text-center text-slate-700">
                  ถุง (5 กก.)
                </td>
                <td className="p-2 text-slate-600 text-[11px]">
                  {record.riceBags > 0 ? `รวมน้ำหนักประมาณ ${(record.riceBags * 5).toLocaleString()} กิโลกรัม` : 'ไม่ได้รับในรอบนี้'}
                </td>
              </tr>

              {/* Item 4: Diapers */}
              <tr>
                <td className="p-2 border-r border-slate-300 text-center font-bold">4</td>
                <td className="p-2 border-r border-slate-300 font-semibold text-slate-900">
                  แพมเพิส / ผ้าอ้อมผู้ใหญ่หรือผ้าอ้อมเด็ก
                </td>
                <td className="p-2 border-r border-slate-300 text-center font-bold text-blue-700 font-mono text-sm">
                  {record.diaperPacks ? record.diaperPacks.toLocaleString() : '-'}
                </td>
                <td className="p-2 border-r border-slate-300 text-center text-slate-700">
                  แพ็ค/ห่อ
                </td>
                <td className="p-2 text-slate-600 text-[11px]">
                  {record.diaperPacks > 0 ? `ขนาด: ${record.diaperSize || 'คละไซส์'}` : 'ไม่ได้รับในรอบนี้'}
                </td>
              </tr>

              {/* Other Items */}
              {record.otherItems && record.otherItems.length > 0 && record.otherItems.map((item, idx) => (
                <tr key={item.id || idx}>
                  <td className="p-2 border-r border-slate-300 text-center font-bold">{5 + idx}</td>
                  <td className="p-2 border-r border-slate-300 font-semibold text-slate-900">
                    {item.name}
                  </td>
                  <td className="p-2 border-r border-slate-300 text-center font-bold text-blue-700 font-mono text-sm">
                    {item.quantity.toLocaleString()}
                  </td>
                  <td className="p-2 border-r border-slate-300 text-center text-slate-700">
                    {item.unit}
                  </td>
                  <td className="p-2 text-slate-600 text-[11px]">
                    สิ่งของช่วยเหลือเพิ่มเติม
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 3: Delivery Place & Method */}
        <div className="border border-slate-900 p-2.5 bg-slate-50/50 mb-4 text-xs">
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

        {/* Section 4: Signatures */}
        <div className="border border-slate-900 p-4 bg-white mb-2">
          <div className="text-[11px] text-slate-700 text-center mb-6 leading-relaxed">
            ข้าพเจ้าขอรับรองว่าได้รับมอบสิ่งของบริจาคตามรายการข้างต้นจาก มูลนิธิร่วมกุศลสมุทรปราการ ไว้เรียบร้อยครบถ้วนถูกต้องแล้ว<br />
            เพื่อนำไปใช้ประโยชน์ตามวัตถุประสงค์ในการสงเคราะห์ผู้ยากไร้และภารกิจสาธารณประโยชน์อย่างแท้จริง
          </div>

          <div className="grid grid-cols-2 gap-8 text-center text-xs">
            {/* Recipient Signature */}
            <div className="space-y-2">
              <div className="font-bold text-slate-900">
                ลงชื่อ ................................................................ ผู้รับมอบสิ่งของ
              </div>
              <div className="text-slate-800 font-medium">
                ( {isIndividual ? `${record.individualTitle || ''}${record.individualName || '....................................................'}` : `${record.agencyContactPerson || '....................................................'}`} )
              </div>
              <div className="text-[11px] text-slate-600">
                {isIndividual ? 'ประชาชนผู้รับมอบสิ่งของ' : `ตำแหน่ง: ${record.agencyContactPosition || 'ผู้แทนหน่วยงาน'}`}
              </div>
              <div className="text-[10px] text-slate-500">
                วันที่ ........./........./............
              </div>
            </div>

            {/* Officer Signature */}
            <div className="space-y-2">
              <div className="font-bold text-slate-900">
                ลงชื่อ ................................................................ ผู้ส่งมอบสิ่งของ
              </div>
              <div className="text-slate-800 font-medium">
                ( {record.officerName || 'นายกริชพิพัฒน์ สลับทอง'} )
              </div>
              <div className="text-[11px] text-slate-600">
                {record.officerPosition || 'เจ้าหน้าที่ฝ่ายสังคมสงเคราะห์ มูลนิธิร่วมกุศลสมุทรปราการ'}
              </div>
              <div className="text-[10px] text-slate-500">
                วันที่ ........./........./............
              </div>
            </div>
          </div>

          {/* Foundation Approver Stamp Area */}
          <div className="border-t border-slate-200 mt-6 pt-4 text-center">
            <div className="text-xs font-bold text-slate-900">
              ลงชื่อ ................................................................ ผู้อนุมัติการมอบสิ่งของ
            </div>
            <div className="text-xs text-slate-800 font-semibold mt-1">
              ( {record.approverName || 'นางสาวศาตพร ภูมิโคกรักษ์'} )
            </div>
            <div className="text-[11px] text-slate-600">
              {record.approverPosition || 'ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ'}
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-[10px] text-slate-400 mt-3 border-t border-slate-200 pt-2">
          เอกสารทางการ มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂) • พิมพ์จากระบบ BD-Care เมื่อ {formatThaiDate(new Date().toISOString().slice(0, 10))} เวลา {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
        </div>
      </div>
    </div>
  );
};
