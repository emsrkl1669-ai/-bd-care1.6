import React from 'react';
import { Printer, X, ArrowLeft, Navigation, Phone, MapPin, HeartHandshake } from 'lucide-react';
import { PatientRecord } from '../types';
import { formatPhone, formatThaiDate } from '../utils/idCard';

interface PrintHouseQrLabelProps {
  patient: PatientRecord;
  onClose: () => void;
}

export const PrintHouseQrLabel: React.FC<PrintHouseQrLabelProps> = ({ patient, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="qr-label-modal fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex flex-col items-center p-3 sm:p-6">
      {/* Control Bar */}
      <div className="no-print w-full max-w-2xl bg-white rounded-xl shadow-lg p-4 mb-4 flex items-center justify-between gap-4 sticky top-4 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">
              🏷️ พิมพ์ป้ายพิกัด QR Code หน้าบ้านผู้ป่วย
            </h2>
            <p className="text-xs text-slate-500">
              สำหรับเคลือบพลาสติกติดหน้าบ้าน หรือติดหน้าแฟ้มประวัติ สค.04
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            พิมพ์ป้ายพิกัด
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable Label Card */}
      <div className="w-full max-w-[190mm] bg-white text-slate-900 border-4 border-blue-900 rounded-2xl p-6 sm:p-8 shadow-2xl font-['Prompt',sans-serif]">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b-2 border-blue-900 pb-4 mb-5">
          <div className="flex items-center gap-4">
            <img
              src="/assets/aistudio/382492-Photoroom_4c9e02f3.png"
              alt="ตรามูลนิธิร่วมกุศลสมุทรปราการ"
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-sm">
                  北欖天德善堂
                </span>
                <span className="text-xs font-bold text-blue-900 tracking-wider">
                  มูลนิธิร่วมกุศลสมุทรปราการ
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-blue-950 mt-1">
                โครงการใจถึงใจช่วยผู้ป่วยติดเตียงและยากไร้
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-700">
                ป้ายพิกัดนำทาง GPS ประจำบ้านผู้ป่วย (แบบ สค.04)
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="bg-blue-900 text-white px-3 py-1.5 rounded-lg text-center font-bold text-sm tracking-wide">
              {patient.code}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">รหัสผู้ป่วย</div>
          </div>
        </div>

        {/* Center Grid: QR Code & Navigation Info */}
        <div className="grid grid-cols-12 gap-6 items-center bg-blue-50/60 p-5 rounded-xl border border-blue-200 mb-5">
          {/* QR Code */}
          <div className="col-span-12 sm:col-span-5 flex flex-col items-center justify-center">
            <div className="bg-white p-3 rounded-xl border-2 border-blue-900 shadow-sm">
              {patient.qrCodeDataUrl ? (
                <img
                  src={patient.qrCodeDataUrl}
                  alt="QR Code พิกัด Google Maps"
                  className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                />
              ) : (
                <div className="w-48 h-48 border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                  ไม่มี QR Code พิกัด
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 mt-2 text-center">
              <Navigation className="w-3.5 h-3.5 text-red-600" />
              <span>สแกนเพื่อเปิด Google Maps นำทาง</span>
            </div>
          </div>

          {/* Details */}
          <div className="col-span-12 sm:col-span-7 space-y-3">
            <div>
              <div className="text-xs text-slate-500 font-medium">ชื่อผู้ป่วยในโครงการ:</div>
              <div className="text-xl sm:text-2xl font-black text-slate-900">
                {patient.title} {patient.fullName}
              </div>
              <div className="inline-block mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                {patient.mobilityLevel === 'bedridden' ? 'ติดเตียง 100%' :
                 patient.mobilityLevel === 'semi_bedridden' ? 'กึ่งติดเตียง' : 'พอเดินได้'}
              </div>
              {patient.admissionDate && (
                <div className="text-[11px] text-slate-500 font-medium mt-1">
                  รับเข้าโครงการ: {formatThaiDate(patient.admissionDate)}
                </div>
              )}
            </div>

            <div className="border-t border-blue-200 pt-2">
              <div className="flex items-start gap-1.5 text-xs text-slate-700">
                <MapPin className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">ที่อยู่:</span> เลขที่ {patient.currentAddress.houseNo} {patient.currentAddress.buildingVillage && `(${patient.currentAddress.buildingVillage})`} {patient.currentAddress.soi && `ซ.${patient.currentAddress.soi}`} {patient.currentAddress.road && `ถ.${patient.currentAddress.road}`} ต.{patient.currentAddress.subdistrict} อ.{patient.currentAddress.district} จ.{patient.currentAddress.province}
                </div>
              </div>
            </div>

            {patient.landmarkNote && (
              <div className="bg-white p-2.5 rounded-lg border border-blue-200 text-xs text-slate-700">
                <span className="font-bold text-blue-900">จุดสังเกต/ทางเข้า:</span>{' '}
                {patient.landmarkNote}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-blue-200">
              <div>
                <span className="text-slate-500 block">พิกัด GPS:</span>
                <span className="font-mono font-bold text-slate-800">
                  {patient.latitude?.toFixed(5)}, {patient.longitude?.toFixed(5)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">ผู้ดูแล/ติดต่อ:</span>
                <span className="font-bold text-slate-800">
                  {patient.caregiverName || '-'} {patient.caregiverPhone && `(${formatPhone(patient.caregiverPhone)})`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer & Emergency Hotlines */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t-2 border-blue-900 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-red-700 font-bold">
              <Phone className="w-4 h-4" />
              <span>แจ้งเหตุฉุกเฉิน/กู้ชีพ: 1669</span>
            </div>
            <div className="text-slate-700">
              สำนักงานมูลนิธิฯ: <span className="font-bold">02-395-0202</span>
            </div>
          </div>
          <div className="text-slate-500 text-[11px]">
            มูลนิธิร่วมกุศลสมุทรปราการ • 北欖天德善堂
          </div>
        </div>

      </div>
    </div>
  );
};
