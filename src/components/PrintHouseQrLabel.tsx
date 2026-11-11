import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  X, 
  ArrowLeft, 
  Navigation, 
  Phone, 
  MapPin, 
  HeartHandshake, 
  ZoomIn, 
  ZoomOut, 
  Minimize2,
  FileText,
  ShieldCheck
} from 'lucide-react';
import { PatientRecord } from '../types';
import { formatPhone, formatThaiDate } from '../utils/idCard';

interface PrintHouseQrLabelProps {
  patient: PatientRecord;
  onClose: () => void;
}

export const PrintHouseQrLabel: React.FC<PrintHouseQrLabelProps> = ({ patient, onClose }) => {
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
      {/* Control Bar */}
      <div className="no-print w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-3 sm:p-4 mb-3 sticky top-2 z-50 border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                  🏷️ ป้ายพิกัด QR Code แผนที่ประจำบ้านผู้ป่วย (A4)
                </h2>
                <span className="text-xs bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded-md font-mono">
                  {patient.code}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                ผู้ป่วย: <strong className="text-slate-800">{patient.title}{patient.fullName}</strong> • สำหรับเคลือบติดหน้าบ้าน / หน้าแฟ้ม สค.04
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

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์เอกสาร A4 (Print / PDF)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* A4 Container */}
      <div
        className="w-full flex flex-col items-center a4-container transition-all duration-150 origin-top pb-10"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          marginBottom: scale < 1 ? `-${Math.round((1 - scale) * 1150)}px` : undefined,
        }}
      >
        {/* Printable A4 Sheet */}
        <div className="a4-sheet bg-white text-slate-900 shadow-2xl rounded-xs p-6 sm:p-[14mm] border border-slate-300 relative font-['Prompt',sans-serif] flex flex-col justify-between">
          <div>
            {/* Top Header */}
            <div className="flex items-center justify-between border-b-2 border-blue-900 pb-3 mb-4">
              <div className="flex items-center gap-3.5">
                <img
                  src="/assets/aistudio/382492-Photoroom_4c9e02f3.png"
                  alt="ตรามูลนิธิร่วมกุศลสมุทรปราการ"
                  className="w-16 h-16 object-contain shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-red-600 text-white text-[11px] font-bold px-2 py-0.2 rounded-xs">
                      北欖天德善堂
                    </span>
                    <span className="text-xs font-bold text-blue-900 tracking-wider">
                      มูลนิธิร่วมกุศลสมุทรปราการ
                    </span>
                  </div>
                  <h1 className="text-base font-black text-blue-950 mt-0.5">
                    โครงการใจถึงใจช่วยผู้ป่วยติดเตียงและยากไร้
                  </h1>
                  <p className="text-xs font-semibold text-slate-700">
                    ป้ายพิกัดนำทาง GPS ประจำบ้านผู้ป่วย (แบบ สค.04-QR)
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="border-2 border-blue-900 px-3 py-1 rounded bg-blue-50 text-center">
                  <div className="text-[10px] text-blue-900 font-bold uppercase">รหัสผู้ป่วย</div>
                  <div className="text-sm font-black font-mono text-blue-950">{patient.code}</div>
                </div>
              </div>
            </div>

            {/* Main Label Content Box */}
            <div className="border-2 border-blue-900 rounded-xl p-4 bg-blue-50/30 mb-4">
              <div className="grid grid-cols-12 gap-5 items-center">
                {/* QR Code */}
                <div className="col-span-5 flex flex-col items-center justify-center">
                  <div className="bg-white p-2.5 rounded-xl border-2 border-blue-900 shadow-sm">
                    {patient.qrCodeDataUrl ? (
                      <img
                        src={patient.qrCodeDataUrl}
                        alt="QR Code พิกัด Google Maps"
                        className="w-44 h-44 object-contain"
                      />
                    ) : (
                      <div className="w-44 h-44 border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                        ไม่มี QR Code พิกัด
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-900 mt-2 text-center">
                    <Navigation className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>สแกนเพื่อเปิด Google Maps นำทาง</span>
                  </div>
                </div>

                {/* Patient Information */}
                <div className="col-span-7 space-y-2 text-xs">
                  <div>
                    <div className="text-[11px] text-slate-500 font-medium">ชื่อผู้ป่วยในโครงการ:</div>
                    <div className="text-xl font-black text-slate-900">
                      {patient.title} {patient.fullName}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                        {patient.mobilityLevel === 'bedridden' ? 'ติดเตียง 100%' :
                         patient.mobilityLevel === 'semi_bedridden' ? 'กึ่งติดเตียง' : 'พอเดินได้'}
                      </span>
                      {patient.admissionDate && (
                        <span className="text-[11px] text-slate-600">
                          รับเข้าโครงการ: {formatThaiDate(patient.admissionDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-blue-200 pt-2">
                    <div className="flex items-start gap-1.5 text-xs text-slate-800">
                      <MapPin className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">ที่อยู่:</span> เลขที่ {patient.currentAddress.houseNo} {patient.currentAddress.buildingVillage && `(${patient.currentAddress.buildingVillage})`} {patient.currentAddress.soi && `ซ.${patient.currentAddress.soi}`} {patient.currentAddress.road && `ถ.${patient.currentAddress.road}`} ต.{patient.currentAddress.subdistrict} อ.{patient.currentAddress.district} จ.{patient.currentAddress.province}
                      </div>
                    </div>
                  </div>

                  {patient.landmarkNote && (
                    <div className="bg-white p-2 rounded-lg border border-blue-200 text-[11px] text-slate-700">
                      <span className="font-bold text-blue-900">จุดสังเกต/ทางเข้า:</span>{' '}
                      {patient.landmarkNote}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-blue-200">
                    <div>
                      <span className="text-slate-500 block">พิกัด GPS:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {patient.latitude ? `${patient.latitude.toFixed(5)}, ${patient.longitude?.toFixed(5)}` : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">ผู้ดูแล/เบอร์โทร:</span>
                      <span className="font-bold text-slate-800">
                        {patient.caregiverName || '-'} {patient.caregiverPhone && `(${formatPhone(patient.caregiverPhone)})`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Assistance Summary Box */}
            <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-[11px] mb-4">
              <div className="font-bold text-slate-900 mb-1">
                รายการสิ่งของที่ได้รับมอบประจำเดือน (โครงการใจถึงใจ):
              </div>
              <div className="grid grid-cols-3 gap-2 text-slate-700">
                <div>
                  • ข้าวสาร 5 กก.: <strong className="text-slate-900">{patient.helpRicePacks || 0} ถุง</strong>
                </div>
                <div>
                  • น้ำดื่มสิงห์: <strong className="text-slate-900">{patient.helpWaterPacks || 0} แพ็ค</strong> ({patient.helpWaterSize === '600ML' ? '600 ML' : '1.5L'})
                </div>
                <div>
                  • ผ้าอ้อม: <strong className="text-slate-900">{patient.helpDiaperSize !== 'NONE' ? `ไซส์ ${patient.helpDiaperSize} (${patient.helpDiaperPacks} ห่อ)` : 'ไม่ได้รับ'}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Sign-off & Foundation Contacts */}
          <div>
            <div className="grid grid-cols-2 gap-6 text-center text-[10.5px] border-t border-slate-300 pt-3">
              <div className="flex flex-col items-center">
                <div className="text-slate-400 mb-2">...................................................</div>
                <div className="font-bold text-slate-900">( นายกริชพิพัฒน์  สลับทอง )</div>
                <div className="text-slate-600 text-[10px]">เจ้าหน้าที่ฝ่ายสังคมสงเคราะห์ (ผู้สำรวจพิกัด)</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-slate-400 mb-2">...................................................</div>
                <div className="font-bold text-slate-900">( นางสาวศาตพร ภูมิโคกรักษ์ )</div>
                <div className="text-slate-600 text-[10px]">ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ (ผู้อนุมัติ)</div>
              </div>
            </div>

            {/* Emergency Hotline Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t-2 border-blue-900 text-xs">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-red-700 font-bold">
                  <Phone className="w-3.5 h-3.5" />
                  <span>แจ้งเหตุฉุกเฉิน/กู้ชีพ: 1669</span>
                </div>
                <div className="text-slate-700">
                  สำนักงานมูลนิธิฯ: <span className="font-bold">02-395-0919, 02-387-1111</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                มูลนิธิร่วมกุศลสมุทรปราการ • 北欖天德善堂 (แบบ สค.04-QR A4)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
