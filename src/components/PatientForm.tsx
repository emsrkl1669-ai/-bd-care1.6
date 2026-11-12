import React, { useState, useEffect } from 'react';
import { 
  Save, 
  ArrowLeft, 
  MapPin, 
  QrCode, 
  Camera, 
  Upload, 
  Sparkles, 
  Trash2, 
  FileText, 
  Check, 
  Copy, 
  ExternalLink, 
  AlertCircle,
  Eye,
  RefreshCw,
  Printer,
  Heart,
  Activity,
  DollarSign,
  Package
} from 'lucide-react';
import { 
  PatientRecord, 
  AdminUser, 
  PatientPhoto, 
  PatientDocument, 
  MobilityLevel, 
  DiaperSize, 
  WaterSize,
  SAMUT_PRAKAN_DISTRICTS, 
  DISABILITY_TYPES 
} from '../types';
import { formatNationalId, calculateAgeFromBirthDate, formatCurrency, formatThaiDate, formatThaiDateShort, generatePatientCode } from '../utils/idCard';
import { generateQrCodeDataUrl, makeGoogleMapsUrl } from '../utils/qrcode';
import { calculateVulnerabilityAssessment, DimensionScores } from '../utils/assessment';
import { ThaiDateInput } from './ThaiDateInput';
import { LiveCameraModal } from './LiveCameraModal';
import { DocumentViewerModal } from './DocumentViewerModal';
import { PrintHouseQrLabel } from './PrintHouseQrLabel';
import { PrintFormSK04 } from './PrintFormSK04';

interface PatientFormProps {
  initialPatient?: PatientRecord | null;
  currentAdmin: AdminUser;
  onSave: (patient: PatientRecord) => void;
  onCancel: () => void;
  existingCount: number;
}

export const PatientForm: React.FC<PatientFormProps> = ({
  initialPatient,
  currentAdmin,
  onSave,
  onCancel,
  existingCount,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  // Generate code if new (format: BDC - {YY}-{NNN})
  const defaultCode = generatePatientCode(todayStr, existingCount + 1);

  // Form State
  const [formData, setFormData] = useState<PatientRecord>(() => {
    if (initialPatient) {
      const baseline = calculateVulnerabilityAssessment(initialPatient);
      const dims = initialPatient.dimensionScores || baseline.dimensionScores;
      const total = dims.mobilityScore + dims.complicationsScore + dims.economicScore + dims.caregiverScore;
      const level = total >= 80 ? 'เปราะบางสูงมาก (วิกฤต)' : (total >= 50 ? 'เปราะบางปานกลาง' : 'เปราะบางเริ่มต้น');
      return { 
        ...initialPatient,
        dimensionScores: dims,
        vulnerabilityScore: total,
        vulnerabilityLevel: initialPatient.vulnerabilityLevel || level,
      };
    }

    const initialAssessment = calculateVulnerabilityAssessment({
      mobilityLevel: 'bedridden',
      incomeSalary: 0,
      monthlyExpense: 0,
      netIncome: 0,
      caregiverRelation: 'บุตร',
    });

    return {
      id: 'pt_' + Date.now(),
      code: defaultCode,
      admissionDate: todayStr,
      status: 'active',
      nationalId: '',
      title: 'นาย',
      fullName: '',
      birthDate: '1955-01-01',
      age: 71,
      gender: 'ชาย',
      phone: '',
      caregiverName: '',
      caregiverRelation: 'บุตร',
      caregiverPhone: '',
      idAddress: {
        houseNo: '',
        moo: '',
        trok: '',
        soi: '',
        road: '',
        subdistrict: '',
        district: 'เมืองสมุทรปราการ',
        province: 'สมุทรปราการ',
      },
      isSameAddress: false,
      currentAddress: {
        houseNo: '',
        buildingVillage: '',
        trok: '',
        soi: '',
        road: '',
        subdistrict: '',
        district: 'เมืองสมุทรปราการ',
        province: 'สมุทรปราการ',
      },
      latitude: 13.5991,
      longitude: 100.5972,
      locationAccuracy: undefined,
      landmarkNote: '',
      googleMapsUrl: makeGoogleMapsUrl(13.5991, 100.5972),
      qrCodeDataUrl: '',
      mobilityLevel: 'bedridden',
      chronicDiseases: '',
      symptomsDetail: '',
      disabilityCard: {
        hasCard: false,
        type: 'ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย',
        cardNumber: '',
      },
      specialNeeds: [],
      familyMembersTotal: 2,
      familyMembersMale: 1,
      familyMembersFemale: 1,
      incomeSalary: 0,
      incomeDisability: 0,
      incomeElderly: 0,
      incomeStateWelfare: 0,
      incomeOther: 0,
      monthlyExpense: 0,
      netIncome: 0,
      economicNote: '',
      helpCashEnabled: initialAssessment.recommendedSupplies.helpCashEnabled,
      helpCashAmount: initialAssessment.recommendedSupplies.helpCashAmount,
      helpDiaperSize: initialAssessment.recommendedSupplies.helpDiaperSize,
      helpDiaperPacks: initialAssessment.recommendedSupplies.helpDiaperPacks,
      helpRicePacks: initialAssessment.recommendedSupplies.helpRicePacks,
      helpWaterSize: '1.5L',
      helpWaterPacks: initialAssessment.recommendedSupplies.helpWaterPacks,
      helpOtherSupplies: initialAssessment.recommendedSupplies.otherSupplies,
      vulnerabilityScore: initialAssessment.vulnerabilityScore,
      vulnerabilityLevel: initialAssessment.vulnerabilityLevel,
      dimensionScores: initialAssessment.dimensionScores,
      socialWorkerOpinion: '',
      interviewerName: 'นายกริชพิพัฒน์ สลับทอง',
      interviewerPosition: 'เจ้าหน้าที่ฝ่ายสังคมสงเคราะห์',
      approverName: 'นางสาวศาตพร ภูมิโคกรักษ์',
      approverPosition: 'ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ',
      presidentName: 'นายไพวงศ์ ชำนินาวากุล',
      presidentPosition: 'ประธานมูลนิธิร่วมกุศลสมุทรปราการ',
      photos: [],
      documents: [],
      deliveries: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  // Modals state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<PatientDocument | null>(null);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResultNotice, setAiResultNotice] = useState<string | null>(null);
  const [showPrintLabel, setShowPrintLabel] = useState(false);
  const [showPrintForm, setShowPrintForm] = useState(false);

  // Recalculate age when birthDate changes
  useEffect(() => {
    if (formData.birthDate) {
      const calculatedAge = calculateAgeFromBirthDate(formData.birthDate);
      setFormData((prev) => ({ ...prev, age: calculatedAge }));
    }
  }, [formData.birthDate]);

  // Recalculate net income whenever income/expenses change
  useEffect(() => {
    const totalIncome =
      Number(formData.incomeSalary || 0) +
      Number(formData.incomeDisability || 0) +
      Number(formData.incomeElderly || 0) +
      Number(formData.incomeStateWelfare || 0) +
      Number(formData.incomeOther || 0);

    const sumExpenses =
      Number(formData.expenseRentHouse || 0) +
      Number(formData.expenseRentLand || 0) +
      Number(formData.expenseLiving || 0) +
      Number(formData.expenseMedicalTravel || 0) +
      Number(formData.expenseDebt || 0) +
      Number(formData.expenseOther || 0);

    const finalExpense = sumExpenses > 0 ? sumExpenses : Number(formData.monthlyExpense || 0);
    const net = totalIncome - finalExpense;
    setFormData((prev) => ({ 
      ...prev, 
      monthlyExpense: finalExpense,
      netIncome: net 
    }));
  }, [
    formData.incomeSalary,
    formData.incomeDisability,
    formData.incomeElderly,
    formData.incomeStateWelfare,
    formData.incomeOther,
    formData.expenseRentHouse,
    formData.expenseRentLand,
    formData.expenseLiving,
    formData.expenseMedicalTravel,
    formData.expenseDebt,
    formData.expenseOther,
  ]);

  // Generate QR code if missing or coordinates change
  useEffect(() => {
    if (formData.latitude && formData.longitude) {
      const mapUrl = makeGoogleMapsUrl(formData.latitude, formData.longitude);
      generateQrCodeDataUrl(mapUrl).then((qr) => {
        setFormData((prev) => ({
          ...prev,
          googleMapsUrl: mapUrl,
          qrCodeDataUrl: qr,
        }));
      });
    }
  }, [formData.latitude, formData.longitude]);

  // Copy ID Address to Current Address
  const handleCopyAddress = () => {
    setFormData((prev) => ({
      ...prev,
      isSameAddress: true,
      currentAddress: {
        houseNo: prev.idAddress.houseNo,
        buildingVillage: '',
        trok: prev.idAddress.trok,
        soi: prev.idAddress.soi,
        road: prev.idAddress.road,
        subdistrict: prev.idAddress.subdistrict,
        district: prev.idAddress.district,
        province: prev.idAddress.province || 'สมุทรปราการ',
      },
    }));
  };

  // Pull GPS Coordinates
  const handleFetchGps = () => {
    if (!navigator.geolocation) {
      alert('อุปกรณ์ของคุณไม่รองรับการดึงพิกัดผ่าน GPS');
      return;
    }

    setIsGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy);
        const mapUrl = makeGoogleMapsUrl(lat, lng);
        const qr = await generateQrCodeDataUrl(mapUrl);

        setFormData((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          locationAccuracy: accuracy,
          googleMapsUrl: mapUrl,
          qrCodeDataUrl: qr,
        }));
        setIsGpsLoading(false);
      },
      (err) => {
        console.error('GPS error:', err);
        alert('ไม่สามารถดึงพิกัด GPS ได้: ' + (err.message || 'กรุณาเปิดสิทธิ์เข้าถึงตำแหน่ง'));
        setIsGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Fine-tune dimension scores directly with automatic sum recalculation
  const updateDimensionScore = (dimension: keyof DimensionScores, value: number) => {
    const clamped = Math.min(25, Math.max(0, value));
    setFormData((prev) => {
      const currentDims = prev.dimensionScores || {
        mobilityScore: 20,
        complicationsScore: 15,
        economicScore: 18,
        caregiverScore: 15,
      };
      const updatedDims = { ...currentDims, [dimension]: clamped };
      const newTotal = updatedDims.mobilityScore + updatedDims.complicationsScore + updatedDims.economicScore + updatedDims.caregiverScore;
      const newLevel = newTotal >= 80 ? 'เปราะบางสูงมาก (วิกฤต)' : (newTotal >= 50 ? 'เปราะบางปานกลาง' : 'เปราะบางเริ่มต้น');
      return {
        ...prev,
        dimensionScores: updatedDims,
        vulnerabilityScore: newTotal,
        vulnerabilityLevel: newLevel,
      };
    });
  };

  // Instant local recalculation from patient's current form data
  const handleRecalculateAssessment = () => {
    const assessment = calculateVulnerabilityAssessment(formData);
    setFormData((prev) => ({
      ...prev,
      vulnerabilityScore: assessment.vulnerabilityScore,
      vulnerabilityLevel: assessment.vulnerabilityLevel,
      dimensionScores: assessment.dimensionScores,
      socialWorkerOpinion: prev.socialWorkerOpinion || assessment.socialWorkerOpinion,
      aiSuggestions: assessment.aiSuggestions,
      helpCashEnabled: assessment.recommendedSupplies.helpCashEnabled,
      helpCashAmount: assessment.recommendedSupplies.helpCashAmount,
      helpDiaperPacks: assessment.recommendedSupplies.helpDiaperPacks,
      helpRicePacks: assessment.recommendedSupplies.helpRicePacks,
      helpWaterPacks: assessment.recommendedSupplies.helpWaterPacks,
    }));
    setAiResultNotice(
      `คำนวณคะแนน 4 มิติสำเร็จ: รวม ${assessment.vulnerabilityScore}/100 คะแนน (${assessment.dimensionScores.mobilityScore} + ${assessment.dimensionScores.complicationsScore} + ${assessment.dimensionScores.economicScore} + ${assessment.dimensionScores.caregiverScore}) ระดับ${assessment.vulnerabilityLevel}`
    );
  };

  // Call AI Evaluation
  const handleRunAiEvaluation = async () => {
    setIsAiLoading(true);
    setAiResultNotice(null);

    try {
      const response = await fetch('/api/ai/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientData: formData,
          interviewNotes: `ระดับการเจ็บป่วย: ${formData.mobilityLevel}, โรคประจำตัว: ${formData.chronicDiseases}, รายได้สุทธิ: ${formData.netIncome} บาท, ผู้ดูแล: ${formData.caregiverName} (${formData.caregiverRelation})`,
        }),
      });

      let data: any;
      if (response.ok) {
        data = await response.json();
      } else {
        throw new Error('Server returned ' + response.status);
      }

      // Ensure exact sum from dimension scores
      const m = Math.min(25, Math.max(0, Number(data.dimensionScores?.mobilityScore ?? 20)));
      const c = Math.min(25, Math.max(0, Number(data.dimensionScores?.complicationsScore ?? 15)));
      const e = Math.min(25, Math.max(0, Number(data.dimensionScores?.economicScore ?? 18)));
      const cg = Math.min(25, Math.max(0, Number(data.dimensionScores?.caregiverScore ?? 15)));
      const exactTotal = m + c + e + cg;
      const exactLevel = exactTotal >= 80 ? 'เปราะบางสูงมาก (วิกฤต)' : (exactTotal >= 50 ? 'เปราะบางปานกลาง' : 'เปราะบางเริ่มต้น');

      setFormData((prev) => ({
        ...prev,
        vulnerabilityScore: exactTotal,
        vulnerabilityLevel: exactLevel,
        dimensionScores: { mobilityScore: m, complicationsScore: c, economicScore: e, caregiverScore: cg },
        socialWorkerOpinion: data.socialWorkerOpinion || prev.socialWorkerOpinion,
        aiSuggestions: data.aiSuggestions || data.missingFieldsAdvice || '',
        helpCashEnabled: data.recommendedSupplies?.helpCashEnabled ?? prev.helpCashEnabled,
        helpCashAmount: data.recommendedSupplies?.helpCashAmount ?? prev.helpCashAmount,
        helpDiaperSize: data.recommendedSupplies?.helpDiaperSize ?? prev.helpDiaperSize,
        helpDiaperPacks: data.recommendedSupplies?.helpDiaperPacks ?? prev.helpDiaperPacks,
        helpRicePacks: data.recommendedSupplies?.helpRicePacks ?? prev.helpRicePacks,
        helpWaterPacks: data.recommendedSupplies?.helpWaterPacks ?? prev.helpWaterPacks,
        helpOtherSupplies: data.recommendedSupplies?.otherSupplies ?? prev.helpOtherSupplies,
      }));

      setAiResultNotice(
        `AI วิเคราะห์และคำนวณคะแนนสำเร็จ: ${exactTotal}/100 คะแนน (${m} + ${c} + ${e} + ${cg}) ระดับ${exactLevel}`
      );
    } catch (err: any) {
      console.warn('AI API call failed, falling back to local exact calculation:', err);
      // Graceful rule-based exact calculation fallback
      const localResult = calculateVulnerabilityAssessment(formData);
      setFormData((prev) => ({
        ...prev,
        vulnerabilityScore: localResult.vulnerabilityScore,
        vulnerabilityLevel: localResult.vulnerabilityLevel,
        dimensionScores: localResult.dimensionScores,
        socialWorkerOpinion: prev.socialWorkerOpinion || localResult.socialWorkerOpinion,
        aiSuggestions: localResult.aiSuggestions,
        helpCashEnabled: localResult.recommendedSupplies.helpCashEnabled,
        helpCashAmount: localResult.recommendedSupplies.helpCashAmount,
        helpDiaperSize: localResult.recommendedSupplies.helpDiaperSize,
        helpDiaperPacks: localResult.recommendedSupplies.helpDiaperPacks,
        helpRicePacks: localResult.recommendedSupplies.helpRicePacks,
        helpWaterPacks: localResult.recommendedSupplies.helpWaterPacks,
        helpOtherSupplies: localResult.recommendedSupplies.otherSupplies,
      }));
      setAiResultNotice(
        `ระบบคำนวณคะแนนตามเกณฑ์มาตรฐานสำเร็จ: ${localResult.vulnerabilityScore}/100 คะแนน ระดับ${localResult.vulnerabilityLevel}`
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  // Handle Photo Capture from Live Camera
  const handlePhotoCaptured = (photo: PatientPhoto) => {
    setFormData((prev) => ({
      ...prev,
      photos: [...prev.photos, photo],
    }));
  };

  // Handle File Upload for Photos
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const newPhoto: PatientPhoto = {
          id: 'photo_' + Date.now() + Math.random().toString(36).substring(2, 6),
          category: 'patient',
          dataUrl,
          caption: file.name,
          timestamp: formatThaiDateShort(new Date().toISOString().slice(0, 10)),
        };
        setFormData((prev) => ({
          ...prev,
          photos: [...prev.photos, newPhoto],
        }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // Handle Document Upload (PDF, JPG, PNG)
  const handleDocumentUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    category: PatientDocument['category'],
    title: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const newDoc: PatientDocument = {
        id: 'doc_' + Date.now(),
        category,
        title,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        dataUrl,
        fileSize: file.size,
        uploadDate: formatThaiDateShort(new Date().toISOString().slice(0, 10)),
      };
      setFormData((prev) => ({
        ...prev,
        documents: [...prev.documents.filter((d) => d.category !== category), newDoc],
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handle Final Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      alert('กรุณากรอกชื่อ-นามสกุลของผู้ป่วย');
      return;
    }

    const updated = {
      ...formData,
      updatedAt: new Date().toISOString(),
    };
    onSave(updated);
  };

  return (
    <div className="max-w-5xl mx-auto py-3 px-3 sm:px-4">
      {/* Top Banner Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>{initialPatient ? 'แก้ไขแบบ สค.04' : 'บันทึกข้อมูลผู้ป่วยใหม่ แบบ สค.04'}</span>
              <span className="text-xs font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.2 rounded-md">
                {formData.code}
              </span>
            </h2>
            <p className="text-[11px] text-slate-500">
              โครงการใจถึงใจช่วยผู้ป่วยติดเตียงและยากไร้ มูลนิธิร่วมกุศลสมุทรปราการ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {initialPatient && (
            <>
              <button
                type="button"
                onClick={() => setShowPrintLabel(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-slate-700" />
                ป้าย QR บ้าน
              </button>
              <button
                type="button"
                onClick={() => setShowPrintForm(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-semibold border border-blue-200 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-blue-700" />
                พิมพ์ สค.04 (3 หน้า)
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            บันทึกข้อมูล
          </button>
        </div>
      </div>

      {/* Sticky Quick-Jump Section Navigation */}
      <div className="sticky top-14 z-30 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl p-1 shadow-xs mb-3 overflow-x-auto flex items-center gap-1 text-[11px] font-semibold text-slate-600">
        <a href="#sec-1" className="px-2.5 py-1 rounded-md hover:bg-blue-50 hover:text-blue-700 whitespace-nowrap">1. ประวัติส่วนตัว</a>
        <a href="#sec-2" className="px-2.5 py-1 rounded-md hover:bg-blue-50 hover:text-blue-700 whitespace-nowrap">2. ที่อยู่</a>
        <a href="#sec-3" className="px-2.5 py-1 rounded-md hover:bg-blue-50 hover:text-blue-700 whitespace-nowrap">3. พิกัด GPS/QR</a>
        <a href="#sec-4" className="px-2.5 py-1 rounded-md hover:bg-blue-50 hover:text-blue-700 whitespace-nowrap">4. อาการเจ็บป่วย</a>
        <a href="#sec-5" className="px-2.5 py-1 rounded-md hover:bg-blue-50 hover:text-blue-700 whitespace-nowrap">5. เศรษฐกิจ</a>
        <a href="#sec-6" className="px-2.5 py-1 rounded-md hover:bg-blue-50 hover:text-blue-700 whitespace-nowrap">6. ของช่วยเหลือ</a>
        <a href="#sec-7" className="px-2.5 py-1 rounded-md hover:bg-indigo-50 hover:text-indigo-700 whitespace-nowrap">7. AI ประเมิน</a>
        <a href="#sec-8" className="px-2.5 py-1 rounded-md hover:bg-blue-50 hover:text-blue-700 whitespace-nowrap">8. ภาพถ่ายสด</a>
        <a href="#sec-9" className="px-2.5 py-1 rounded-md hover:bg-blue-50 hover:text-blue-700 whitespace-nowrap">9. เอกสารแนบ</a>
        <a href="#sec-10" className="px-2.5 py-1 rounded-md hover:bg-blue-50 hover:text-blue-700 whitespace-nowrap">10. คณะกรรมการ</a>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* ============================================================== */}
        {/* 1. ข้อมูลทั่วไป & ประวัติผู้ป่วย */}
        {/* ============================================================== */}
        <div id="sec-1" className="scroll-mt-28 bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
              ประวัติผู้ป่วยยากไร้ & ข้อมูลส่วนบุคคล
            </h3>
            <span className="text-xs text-slate-400">แบบ สค.04</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-start">
            {/* Admission Date */}
            <div className="md:col-span-5 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                วันที่รับเข้าโครงการ (วัน เดือน พ.ศ.) *
              </label>
              <ThaiDateInput
                id="admission-date"
                required
                value={formData.admissionDate}
                onChange={(val) => {
                  if (!initialPatient) {
                    const newCode = generatePatientCode(val, existingCount + 1);
                    setFormData((prev) => ({ ...prev, admissionDate: val, code: newCode }));
                  } else {
                    setFormData((prev) => ({ ...prev, admissionDate: val }));
                  }
                }}
                minYearBE={2550}
                maxYearBE={new Date().getFullYear() + 543 + 5}
              />
            </div>

            {/* Status */}
            <div className="md:col-span-4 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                สถานะผู้ป่วย *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full max-w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium truncate shadow-xs cursor-pointer"
              >
                <option value="active">อยู่ในโครงการ (Active)</option>
                <option value="pending">รอพิจารณา (Pending)</option>
                <option value="deceased">ผู้ป่วยเสียชีวิต (Deceased)</option>
                <option value="moved">ย้ายที่อาศัย (Moved)</option>
                <option value="rejected">ไม่ผ่านโครงการ (Rejected)</option>
              </select>
            </div>

            {/* Code (CSS Selector 1) */}
            <div className="md:col-span-3 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  รหัสผู้ป่วย *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const generated = generatePatientCode(formData.admissionDate, existingCount + 1);
                    setFormData((prev) => ({ ...prev, code: generated }));
                  }}
                  className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5 font-medium cursor-pointer"
                  title="คำนวณรหัสอัตโนมัติ BDC - YY-NNN ตาม พ.ศ. ที่รับเข้าโครงการ"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>คำนวณรหัส</span>
                </button>
              </div>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="BDC - 68-001"
                className="w-full max-w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-blue-900 truncate focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
              />
              <div className="text-[9.5px] text-slate-500 mt-0.5">
                * BDC - {formData.admissionDate ? String(parseInt(formData.admissionDate.split('-')[0], 10) + 543).slice(-2) : '68'}-001 (ตาม พ.ศ.)
              </div>
            </div>

            {/* National ID 13 digits */}
            <div className="md:col-span-6 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                เลขประจำตัวประชาชน 13 หลัก (จัดรูปแบบอัตโนมัติ) *
              </label>
              <input
                type="text"
                required
                maxLength={17}
                placeholder="x-xxxx-xxxxx-xx-x"
                value={formData.nationalId}
                onChange={(e) => setFormData({ ...formData, nationalId: formatNationalId(e.target.value) })}
                className="w-full max-w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono tracking-wider focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Title & Full Name */}
            <div className="md:col-span-2 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                คำนำหน้า *
              </label>
              <select
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full max-w-full text-xs px-2 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="นาย">นาย</option>
                <option value="นาง">นาง</option>
                <option value="นางสาว">นางสาว</option>
                <option value="ด.ช.">ด.ช.</option>
                <option value="ด.ญ.">ด.ญ.</option>
              </select>
            </div>

            <div className="md:col-span-4 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อ-นามสกุล ผู้ป่วย *
              </label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="ระบุชื่อและนามสกุล"
                className="w-full max-w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </div>

            {/* Birth Date & Auto Age */}
            <div className="md:col-span-5 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                วัน/เดือน/ปีเกิด (วัน เดือน พ.ศ.)
              </label>
              <ThaiDateInput
                id="birth-date"
                value={formData.birthDate}
                onChange={(val) => setFormData({ ...formData, birthDate: val })}
                minYearBE={2470}
                maxYearBE={new Date().getFullYear() + 543}
                showTodayButton={false}
              />
            </div>

            <div className="md:col-span-2 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                อายุ (คำนวณอัตโนมัติ)
              </label>
              <div className="w-full max-w-full text-xs px-2.5 py-2 bg-slate-100 border border-slate-300 rounded-lg font-bold text-blue-900 text-center truncate shadow-xs flex items-center justify-center">
                {formData.age} ปี
              </div>
            </div>

            <div className="md:col-span-2 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                เพศ
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                className="w-full max-w-full text-xs px-2 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ชาย">ชาย</option>
                <option value="หญิง">หญิง</option>
              </select>
            </div>

            <div className="md:col-span-3 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                เบอร์โทรศัพท์ผู้ป่วย
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="08x-xxx-xxxx"
                className="w-full max-w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Caregiver Information */}
            <div className="md:col-span-5">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อผู้ประสานงาน / ผู้ดูแลหลัก
              </label>
              <input
                type="text"
                value={formData.caregiverName}
                onChange={(e) => setFormData({ ...formData, caregiverName: e.target.value })}
                placeholder="ชื่อ-สกุล ผู้ดูแล"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ความสัมพันธ์กับผู้ป่วย
              </label>
              <input
                type="text"
                value={formData.caregiverRelation}
                onChange={(e) => setFormData({ ...formData, caregiverRelation: e.target.value })}
                placeholder="เช่น บุตร, คู่สมรส, พี่น้อง"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                เบอร์โทรศัพท์ผู้ดูแล *
              </label>
              <input
                type="tel"
                value={formData.caregiverPhone}
                onChange={(e) => setFormData({ ...formData, caregiverPhone: e.target.value })}
                placeholder="08x-xxx-xxxx"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. ข้อมูลที่อยู่ตามบัตร & ที่อยู่ปัจจุบัน */}
        {/* ============================================================== */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</span>
              ข้อมูลที่อยู่ตามบัตรประชาชน & ที่อยู่ปัจจุบัน
            </h3>
            <button
              type="button"
              onClick={handleCopyAddress}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              คัดลอกไปยังที่อยู่ปัจจุบันในคลิกเดียว
            </button>
          </div>

          {/* ID Address */}
          <div className="mb-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 mb-2">ที่อยู่ตามบัตรประชาชน:</h4>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">บ้านเลขที่</label>
                <input
                  type="text"
                  value={formData.idAddress.houseNo}
                  onChange={(e) => setFormData({
                    ...formData,
                    idAddress: { ...formData.idAddress, houseNo: e.target.value },
                  })}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">หมู่ที่</label>
                <input
                  type="text"
                  value={formData.idAddress.moo}
                  onChange={(e) => setFormData({
                    ...formData,
                    idAddress: { ...formData.idAddress, moo: e.target.value },
                  })}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">ตรอก/ซอย</label>
                <input
                  type="text"
                  value={formData.idAddress.soi}
                  onChange={(e) => setFormData({
                    ...formData,
                    idAddress: { ...formData.idAddress, soi: e.target.value },
                  })}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">ถนน</label>
                <input
                  type="text"
                  value={formData.idAddress.road}
                  onChange={(e) => setFormData({
                    ...formData,
                    idAddress: { ...formData.idAddress, road: e.target.value },
                  })}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">ตำบล/แขวง</label>
                <input
                  type="text"
                  value={formData.idAddress.subdistrict}
                  onChange={(e) => setFormData({
                    ...formData,
                    idAddress: { ...formData.idAddress, subdistrict: e.target.value },
                  })}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">อำเภอ/เขต</label>
                <input
                  type="text"
                  value={formData.idAddress.district}
                  onChange={(e) => setFormData({
                    ...formData,
                    idAddress: { ...formData.idAddress, district: e.target.value },
                  })}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Current Address */}
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-blue-900">ที่อยู่ปัจจุบัน (สำหรับลงพื้นที่และส่งมอบสิ่งของ):</h4>
              {formData.isSameAddress && (
                <span className="text-[11px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-semibold">
                  ✓ ที่อยู่เดียวกันกับบัตรประชาชน
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">บ้านเลขที่ *</label>
                <input
                  type="text"
                  required
                  value={formData.currentAddress.houseNo}
                  onChange={(e) => setFormData({
                    ...formData,
                    currentAddress: { ...formData.currentAddress, houseNo: e.target.value },
                  })}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] text-slate-600 mb-1">ตึก/อาคาร/หมู่บ้าน/ชุมชน</label>
                <input
                  type="text"
                  value={formData.currentAddress.buildingVillage}
                  onChange={(e) => setFormData({
                    ...formData,
                    currentAddress: { ...formData.currentAddress, buildingVillage: e.target.value },
                  })}
                  placeholder="เช่น ชุมชนริมคลอง, เอื้ออาทร"
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">ซอย</label>
                <input
                  type="text"
                  value={formData.currentAddress.soi}
                  onChange={(e) => setFormData({
                    ...formData,
                    currentAddress: { ...formData.currentAddress, soi: e.target.value },
                  })}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">ถนน</label>
                <input
                  type="text"
                  value={formData.currentAddress.road}
                  onChange={(e) => setFormData({
                    ...formData,
                    currentAddress: { ...formData.currentAddress, road: e.target.value },
                  })}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">ตำบล/แขวง *</label>
                <input
                  type="text"
                  required
                  value={formData.currentAddress.subdistrict}
                  onChange={(e) => setFormData({
                    ...formData,
                    currentAddress: { ...formData.currentAddress, subdistrict: e.target.value },
                  })}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[11px] text-slate-600 mb-1">อำเภอ (ในจังหวัดสมุทรปราการ) *</label>
                <select
                  value={formData.currentAddress.district}
                  onChange={(e) => setFormData({
                    ...formData,
                    currentAddress: { ...formData.currentAddress, district: e.target.value },
                  })}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-bold text-blue-900"
                >
                  {SAMUT_PRAKAN_DISTRICTS.map((dist) => (
                    <option key={dist} value={dist}>{dist}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="block text-[11px] text-slate-600 mb-1">จังหวัด</label>
                <input
                  type="text"
                  disabled
                  value="สมุทรปราการ"
                  className="w-full text-xs px-2.5 py-1.5 bg-slate-100 border border-slate-300 rounded-md font-medium text-slate-700"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. ระบบพิกัด GPS & สร้าง QR Code บ้านผู้ป่วยอัตโนมัติ */}
        {/* ============================================================== */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 mb-4 gap-2">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                ระบบพิกัด GPS & สร้าง QR Code นำทางบ้านผู้ป่วยอัตโนมัติ
              </h3>
              <p className="text-xs text-slate-500">
                ทำงานแบบ Offline 100% สแกนด้วยกล้องมือถือเพื่อเปิด Google Maps นำทาง
              </p>
            </div>

            <button
              type="button"
              onClick={handleFetchGps}
              disabled={isGpsLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {isGpsLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  กำลังค้นหาพิกัด...
                </>
              ) : (
                <>
                  <MapPin className="w-3.5 h-3.5" />
                  📡 ดึงพิกัดปัจจุบันผ่าน GPS
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Coordinates & Landmark notes */}
            <div className="md:col-span-8 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ละติจูด (Latitude)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude ?? ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      latitude: e.target.value ? parseFloat(e.target.value) : null,
                    })}
                    placeholder="13.xxxxxx"
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ลองจิจูด (Longitude)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude ?? ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      longitude: e.target.value ? parseFloat(e.target.value) : null,
                    })}
                    placeholder="100.xxxxxx"
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              {formData.locationAccuracy && (
                <div className="text-[11px] text-emerald-700 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  ความแม่นยำของตำแหน่ง GPS: ±{formData.locationAccuracy} เมตร
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  จุดสังเกตและเส้นทางเข้าบ้าน (Landmark & Directions) *
                </label>
                <textarea
                  rows={2}
                  value={formData.landmarkNote}
                  onChange={(e) => setFormData({ ...formData, landmarkNote: e.target.value })}
                  placeholder="เช่น เข้าซอยวัดด่าน 24 ประมาณ 100 เมตร ข้ามสะพานไม้ริมคลอง บ้านไม้สีฟ้าติดริมน้ำ"
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {formData.googleMapsUrl && (
                <div className="flex items-center gap-2">
                  <a
                    href={formData.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    ทดสอบเปิดแผนที่ Google Maps ในแท็บใหม่
                  </a>
                </div>
              )}
            </div>

            {/* Offline Pure JS QR Code Box */}
            <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
              {formData.qrCodeDataUrl ? (
                <>
                  <img
                    src={formData.qrCodeDataUrl}
                    alt="QR Code พิกัดบ้านผู้ป่วย"
                    className="w-36 h-36 object-contain bg-white p-2 rounded-lg border border-slate-300 shadow-xs"
                  />
                  <div className="text-center mt-2">
                    <span className="text-[11px] font-bold text-slate-800 block">
                      QR Code พิกัดบ้าน (Google Maps)
                    </span>
                    <span className="text-[10px] text-emerald-600 font-medium">
                      ✓ สร้างสำเร็จแบบ Pure JS Offline
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-36 h-36 border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400 text-center p-2 rounded-lg">
                  ระบุพิกัดหรือกดดึง GPS เพื่อสร้าง QR Code
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 4. อาการเจ็บป่วย & สุขภาพ */}
        {/* ============================================================== */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">4</span>
              ข้อมูลการเจ็บป่วย & สภาพร่างกาย
            </h3>
            <span className="text-xs text-slate-400">ประเมิน ADL</span>
          </div>

          <div className="space-y-4">
            {/* Mobility Level Radio Cards */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                ระดับการเจ็บป่วยและการเคลื่อนไหว *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  formData.mobilityLevel === 'bedridden'
                    ? 'bg-red-50 border-red-500 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="mobilityLevel"
                    value="bedridden"
                    checked={formData.mobilityLevel === 'bedridden'}
                    onChange={() => setFormData({ ...formData, mobilityLevel: 'bedridden' })}
                    className="mt-1 text-red-600 focus:ring-red-500"
                  />
                  <div>
                    <div className="font-bold text-sm text-red-900">ติดเตียง 100%</div>
                    <div className="text-xs text-red-700 mt-0.5">นอนติดเตียงตลอดเวลา ช่วยเหลือตัวเองไม่ได้</div>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  formData.mobilityLevel === 'semi_bedridden'
                    ? 'bg-amber-50 border-amber-500 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="mobilityLevel"
                    value="semi_bedridden"
                    checked={formData.mobilityLevel === 'semi_bedridden'}
                    onChange={() => setFormData({ ...formData, mobilityLevel: 'semi_bedridden' })}
                    className="mt-1 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <div className="font-bold text-sm text-amber-900">กึ่งติดเตียง</div>
                    <div className="text-xs text-amber-700 mt-0.5">ลุกนั่งหรือขยับตัวได้บ้าง ต้องมีคนพยุงดูแลใกล้ชิด</div>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  formData.mobilityLevel === 'can_walk'
                    ? 'bg-emerald-50 border-emerald-500 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="mobilityLevel"
                    value="can_walk"
                    checked={formData.mobilityLevel === 'can_walk'}
                    onChange={() => setFormData({ ...formData, mobilityLevel: 'can_walk' })}
                    className="mt-1 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="font-bold text-sm text-emerald-900">พอเดินได้</div>
                    <div className="text-xs text-emerald-700 mt-0.5">เดินได้ช้าๆ หรือใช้อุปกรณ์ช่วยเดิน (ไม้เท้า/วอล์คเกอร์)</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Chronic diseases */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  โรคประจำตัว *
                </label>
                <input
                  type="text"
                  required
                  value={formData.chronicDiseases}
                  onChange={(e) => setFormData({ ...formData, chronicDiseases: e.target.value })}
                  placeholder="เช่น อัมพฤกษ์/อัมพาต, เบาหวาน, ความดัน, ไตวาย"
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  อาการเจ็บป่วยและรายละเอียดแผล
                </label>
                <input
                  type="text"
                  value={formData.symptomsDetail}
                  onChange={(e) => setFormData({ ...formData, symptomsDetail: e.target.value })}
                  placeholder="เช่น มีแผลกดทับที่ก้นกบ 3 ซม., กลั้นปัสสาวะไม่ได้"
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Disability Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.disabilityCard.hasCard}
                    onChange={(e) => setFormData({
                      ...formData,
                      disabilityCard: { ...formData.disabilityCard, hasCard: e.target.checked },
                    })}
                    className="w-4 h-4 text-blue-600 rounded-sm"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    มีบัตรประจำตัวผู้พิการ
                  </span>
                </label>
              </div>

              {formData.disabilityCard.hasCard && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      ประเภทความพิการ
                    </label>
                    <select
                      value={formData.disabilityCard.type}
                      onChange={(e) => setFormData({
                        ...formData,
                        disabilityCard: { ...formData.disabilityCard, type: e.target.value },
                      })}
                      className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                    >
                      {DISABILITY_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      เลขที่บัตรประจำตัวคนพิการ
                    </label>
                    <input
                      type="text"
                      value={formData.disabilityCard.cardNumber}
                      onChange={(e) => setFormData({
                        ...formData,
                        disabilityCard: { ...formData.disabilityCard, cardNumber: e.target.value },
                      })}
                      placeholder="ระบุเลขที่บัตรคนพิการ"
                      className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 5. สภาพเศรษฐกิจครอบครัว & คำนวณรายได้สุทธิ */}
        {/* ============================================================== */}
        <div id="sec-5" className="scroll-mt-28 bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">5</span>
              สภาพเศรษฐกิจครอบครัว & การเงิน (คำนวณสุทธิอัตโนมัติ)
            </h3>
            <span className="text-xs text-slate-400">หน่วย: บาท/เดือน</span>
          </div>

          <div className="space-y-4">
            {/* Family Members */}
            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">สมาชิกในบ้านทั้งหมด (คน)</label>
                <input
                  type="number"
                  min="1"
                  value={formData.familyMembersTotal}
                  onChange={(e) => setFormData({ ...formData, familyMembersTotal: parseInt(e.target.value) || 1 })}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">ชาย (คน)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.familyMembersMale}
                  onChange={(e) => setFormData({ ...formData, familyMembersMale: parseInt(e.target.value) || 0 })}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">หญิง (คน)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.familyMembersFemale}
                  onChange={(e) => setFormData({ ...formData, familyMembersFemale: parseInt(e.target.value) || 0 })}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                />
              </div>
            </div>

            {/* Income breakdown table */}
            <div>
              <div className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>แหล่งที่มาของรายได้ครอบครัว (บาท/เดือน)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">รายได้ครอบครัว</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.incomeSalary}
                    onChange={(e) => setFormData({ ...formData, incomeSalary: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">เบี้ยผู้พิการ</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.incomeDisability}
                    onChange={(e) => setFormData({ ...formData, incomeDisability: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">เบี้ยชราภาพ</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.incomeElderly}
                    onChange={(e) => setFormData({ ...formData, incomeElderly: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">บัตรสวัสดิการแห่งรัฐ</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.incomeStateWelfare}
                    onChange={(e) => setFormData({ ...formData, incomeStateWelfare: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">รายได้อื่นๆ</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.incomeOther}
                    onChange={(e) => setFormData({ ...formData, incomeOther: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                  />
                </div>
              </div>
            </div>

            {/* Expense Survey breakdown table (ตามที่ผู้ใช้สั่ง) */}
            <div className="bg-red-50/40 border border-red-200/80 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-red-950 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span>สำรวจค่าใช้จ่ายผู้ป่วย & ภาระหนี้สิน (บาท/เดือน)</span>
                </div>
                <div className="text-[11px] font-bold text-red-700">
                  รวมค่าใช้จ่าย: {formatCurrency(formData.monthlyExpense)} บาท
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-700 font-medium mb-1">ค่าเช่าบ้าน</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.expenseRentHouse || 0}
                    onChange={(e) => setFormData({ ...formData, expenseRentHouse: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-red-200 rounded-md focus:ring-2 focus:ring-red-400"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-700 font-medium mb-1">ค่าเช่าที่ดิน</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.expenseRentLand || 0}
                    onChange={(e) => setFormData({ ...formData, expenseRentLand: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-red-200 rounded-md focus:ring-2 focus:ring-red-400"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-700 font-medium mb-1">ค่าดำรงชีพ/อาหาร</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.expenseLiving || 0}
                    onChange={(e) => setFormData({ ...formData, expenseLiving: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-red-200 rounded-md focus:ring-2 focus:ring-red-400"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-700 font-medium mb-1">ค่าเดินทาง(แพทย์นัด)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.expenseMedicalTravel || 0}
                    onChange={(e) => setFormData({ ...formData, expenseMedicalTravel: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-red-200 rounded-md focus:ring-2 focus:ring-red-400"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-700 font-medium mb-1">หนี้สิน/ภาระหนี้</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.expenseDebt || 0}
                    onChange={(e) => setFormData({ ...formData, expenseDebt: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-red-200 rounded-md focus:ring-2 focus:ring-red-400"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-700 font-medium mb-1">ค่าใช้จ่ายอื่นๆ</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.expenseOther || 0}
                    onChange={(e) => setFormData({ ...formData, expenseOther: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-red-200 rounded-md focus:ring-2 focus:ring-red-400"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Net Income Display Card */}
            <div className={`p-4 rounded-xl border flex items-center justify-between ${
              formData.netIncome < 0
                ? 'bg-red-50 border-red-300 text-red-950'
                : 'bg-emerald-50 border-emerald-300 text-emerald-950'
            }`}>
              <div>
                <div className="text-xs font-bold">
                  รายได้สุทธิประจำเดือน (คำนวณอัตโนมัติ: รายได้รวม - ค่าใช้จ่าย)
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  {formData.netIncome < 0 ? '⚠️ สภาพเศรษฐกิจติดลบ ขาดสภาพคล่องอย่างหนัก' : 'รายได้เพียงพอค่าครองชีพพื้นฐาน'}
                </div>
              </div>
              <div className="text-xl font-black">
                {formatCurrency(formData.netIncome)} บาท
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                หมายเหตุสภาพเศรษฐกิจและหนี้สิน
              </label>
              <input
                type="text"
                value={formData.economicNote}
                onChange={(e) => setFormData({ ...formData, economicNote: e.target.value })}
                placeholder="เช่น ผู้ดูแลไม่ได้ทำงานประจำ มีภาระค่ายาและค่าเช่าบ้าน"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 6. รายการการให้ความช่วยเหลือ มูลนิธิร่วมกุศลสมุทรปราการ */}
        {/* ============================================================== */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">6</span>
              รายการการให้ความช่วยเหลือตามระเบียบมูลนิธิร่วมกุศลสมุทรปราการ
            </h3>
            <span className="text-xs text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md">
              เกณฑ์ สค.04
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* 1. เงินสด 1,000 บาท/เดือน */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-800">
                <input
                  type="checkbox"
                  checked={formData.helpCashEnabled}
                  onChange={(e) => setFormData({ ...formData, helpCashEnabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded-sm"
                />
                1. เงินสดช่วยเหลือ
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  disabled={!formData.helpCashEnabled}
                  value={formData.helpCashAmount}
                  onChange={(e) => setFormData({ ...formData, helpCashAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-bold text-slate-900"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">บาท/เดือน</span>
              </div>
            </div>

            {/* 2. ผ้าอ้อมผู้ใหญ่ */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="font-bold text-xs text-slate-800">
                2. ผ้าอ้อมผู้ใหญ่
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">ขนาดไซส์</label>
                  <select
                    value={formData.helpDiaperSize}
                    onChange={(e) => setFormData({ ...formData, helpDiaperSize: e.target.value as DiaperSize })}
                    className="w-full text-xs px-2 py-1.5 bg-white border border-slate-300 rounded-md font-bold text-blue-900"
                  >
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                    <option value="NONE">ไม่รับ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">จำนวน (ห่อ/เดือน)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={formData.helpDiaperPacks}
                    onChange={(e) => setFormData({ ...formData, helpDiaperPacks: parseInt(e.target.value) || 0 })}
                    className="w-full text-xs px-2 py-1.5 bg-white border border-slate-300 rounded-md font-bold"
                  />
                </div>
              </div>
            </div>

            {/* 3. ข้าวสาร 5 กก. */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="font-bold text-xs text-slate-800">
                3. ข้าวสารถุงละ 5 กก.
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={formData.helpRicePacks}
                  onChange={(e) => setFormData({ ...formData, helpRicePacks: parseInt(e.target.value) || 0 })}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-bold text-slate-900"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">ถุง/เดือน</span>
              </div>
            </div>

            {/* 4. น้ำดื่มสิงห์ (ขนาด 600 ML. แพ็ค 12 ขวด / ขนาด 1.5L แพ็ค 6 ขวด) */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="font-bold text-xs text-slate-800 flex items-center justify-between">
                <span>4. น้ำดื่มสิงห์</span>
                <span className="text-[10px] text-blue-800 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/50">
                  {formData.helpWaterSize === '600ML'
                    ? '600 ML. (12 ขวด)'
                    : formData.helpWaterSize === 'NONE'
                    ? 'ไม่รับ'
                    : '1.5L (6 ขวด)'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">ขนาดน้ำสิงห์</label>
                  <select
                    value={formData.helpWaterSize || '1.5L'}
                    onChange={(e) => setFormData({ ...formData, helpWaterSize: e.target.value as WaterSize })}
                    className="w-full text-xs px-2 py-1.5 bg-white border border-slate-300 rounded-md font-bold text-blue-900 cursor-pointer"
                  >
                    <option value="1.5L">ขนาด 1.5L (แพ็ค 6 ขวด)</option>
                    <option value="600ML">ขนาด 600 ML. (แพ็ค 12 ขวด)</option>
                    <option value="NONE">ไม่รับ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">จำนวน (แพ็ค/เดือน)</label>
                  <input
                    type="number"
                    min="0"
                    disabled={formData.helpWaterSize === 'NONE'}
                    value={formData.helpWaterSize === 'NONE' ? 0 : formData.helpWaterPacks}
                    onChange={(e) => setFormData({ ...formData, helpWaterPacks: parseInt(e.target.value) || 0 })}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-bold text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>
              <div className="text-[9.5px] text-slate-500">
                * ขนาด 600 ML. (แพ็ค 12 ขวด) หรือ 1.5L (แพ็ค 6 ขวด)
              </div>
            </div>

            {/* 5. อุปกรณ์พิเศษอื่นๆ */}
            <div className="col-span-1 sm:col-span-2 md:col-span-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                5. สิ่งของพิเศษอื่นๆ (เช่น แผ่นรองซับ, ที่นอนลม, ไม้เท้า, รถเข็นวีลแชร์)
              </label>
              <input
                type="text"
                value={formData.helpOtherSupplies}
                onChange={(e) => setFormData({ ...formData, helpOtherSupplies: e.target.value })}
                placeholder="ระบุสิ่งของพิเศษเพิ่มเติม"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 7. ระบบผู้ช่วยสัมภาษณ์และประเมินสรุปรายงานอัตโนมัติ (AI Assistant) */}
        {/* ============================================================== */}
        {/* ============================================================== */}
        {/* 7. ระบบผู้ช่วยสัมภาษณ์และประเมินสรุปรายงานอัตโนมัติ (AI Assistant) */}
        {/* ============================================================== */}
        <div id="sec-7" className="scroll-mt-28 bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/80 rounded-xl border-2 border-indigo-200 shadow-sm p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between border-b border-indigo-100 pb-3 mb-4 gap-2">
            <div>
              <h3 className="font-bold text-indigo-950 text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">7</span>
                <Sparkles className="w-5 h-5 text-indigo-600" />
                ระบบประเมินความเปราะบาง 4 มิติ & AI Assistant (แบบ สค.04)
              </h3>
              <p className="text-xs text-indigo-700 mt-0.5">
                คำนวณคะแนนดัชนีความเปราะบาง (Vulnerability Index 0-100) ถูกต้องตามผลรวม 4 มิติเชิงลึก พร้อมร่างความเห็นนักสังคมสงเคราะห์
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRecalculateAssessment}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                title="คำนวณคะแนนใหม่ตามข้อมูลที่กรอกในข้อ 1-6"
              >
                <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                <span>คำนวณคะแนนตามข้อมูลจริง</span>
              </button>

              <button
                type="button"
                onClick={handleRunAiEvaluation}
                disabled={isAiLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {isAiLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>กำลังประเมินด้วย AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>🤖 ให้ AI สรุปรายงานและประเมินเชิงลึก</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {aiResultNotice && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs flex items-center gap-2 shadow-2xs">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{aiResultNotice}</span>
            </div>
          )}

          {/* Mathematical Formula Banner */}
          <div className="mb-4 p-2.5 bg-indigo-100/60 border border-indigo-200 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2 text-indigo-950 font-medium">
            <div className="flex items-center gap-1.5">
              <span className="font-bold">สูตรคำนวณคะแนน:</span>
              <span>มิติที่ 1 ({formData.dimensionScores?.mobilityScore ?? 0})</span>
              <span>+</span>
              <span>มิติที่ 2 ({formData.dimensionScores?.complicationsScore ?? 0})</span>
              <span>+</span>
              <span>มิติที่ 3 ({formData.dimensionScores?.economicScore ?? 0})</span>
              <span>+</span>
              <span>มิติที่ 4 ({formData.dimensionScores?.caregiverScore ?? 0})</span>
            </div>
            <div className="font-bold text-indigo-900 bg-white px-2.5 py-0.5 rounded border border-indigo-200 font-mono">
              = รวม {formData.vulnerabilityScore} / 100 คะแนน
            </div>
          </div>

          {/* Vulnerability Score Card & Dimensions */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
            {/* Left: Overall Score Card */}
            <div className="md:col-span-4 bg-white p-4 rounded-xl border border-indigo-200 shadow-xs flex flex-col items-center justify-center text-center">
              <div className="text-xs font-bold text-slate-600 mb-1">
                ดัชนีคะแนนความเปราะบาง (Vulnerability Score)
              </div>
              <div className="text-4xl font-black text-indigo-600 my-1 font-mono">
                {formData.vulnerabilityScore}
                <span className="text-base font-normal text-slate-400">/100</span>
              </div>
              <div className="mt-1">
                <span className={`inline-block text-xs px-3 py-1 rounded-full font-bold shadow-2xs ${
                  formData.vulnerabilityScore >= 80 ? 'bg-red-100 text-red-800 border border-red-200' :
                  formData.vulnerabilityScore >= 50 ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                  'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {formData.vulnerabilityLevel || 'เปราะบางปานกลาง'}
                </span>
              </div>
              <div className="mt-3 text-[10px] text-slate-500 space-y-0.5 border-t border-slate-100 pt-2 w-full text-left">
                <div className="flex justify-between"><span>🔴 วิกฤต (ช่วยเหลือเร่งด่วน):</span> <span className="font-mono font-bold">80 - 100</span></div>
                <div className="flex justify-between"><span>🟡 ปานกลาง (เฝ้าระวัง):</span> <span className="font-mono font-bold">50 - 79</span></div>
                <div className="flex justify-between"><span>🟢 เริ่มต้น (ติดตาม):</span> <span className="font-mono font-bold">0 - 49</span></div>
              </div>
            </div>

            {/* Right: 4 Dimensions Grid with interactive sliders */}
            <div className="md:col-span-8 bg-white p-4 rounded-xl border border-indigo-200 shadow-xs space-y-3">
              <div className="text-xs font-bold text-slate-700 flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span>คะแนนรายมิติเชิงลึก (ปรับแต่งได้มิติละ 0 - 25 คะแนน):</span>
                <span className="text-[11px] text-indigo-600 font-semibold font-mono">
                  รวม: {(formData.dimensionScores?.mobilityScore ?? 0) + (formData.dimensionScores?.complicationsScore ?? 0) + (formData.dimensionScores?.economicScore ?? 0) + (formData.dimensionScores?.caregiverScore ?? 0)} / 100
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Dim 1: Mobility */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">1. การเคลื่อนไหว & ADL</span>
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {formData.dimensionScores?.mobilityScore ?? 22} / 25
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    สภาพ: {formData.mobilityLevel === 'bedridden' ? 'ติดเตียง 100%' : formData.mobilityLevel === 'semi_bedridden' ? 'กึ่งติดเตียง' : 'พอเดินได้'}
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    value={formData.dimensionScores?.mobilityScore ?? 22}
                    onChange={(e) => updateDimensionScore('mobilityScore', parseInt(e.target.value) || 0)}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>

                {/* Dim 2: Complications */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">2. ภาวะแทรกซ้อน & อาการ</span>
                    <span className="font-mono font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                      {formData.dimensionScores?.complicationsScore ?? 15} / 25
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    โรค: {formData.chronicDiseases || 'ไม่มีระบุ'}
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    value={formData.dimensionScores?.complicationsScore ?? 15}
                    onChange={(e) => updateDimensionScore('complicationsScore', parseInt(e.target.value) || 0)}
                    className="w-full accent-red-600 cursor-pointer"
                  />
                </div>

                {/* Dim 3: Economics */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">3. ความยากไร้ & เศรษฐกิจ</span>
                    <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {formData.dimensionScores?.economicScore ?? 20} / 25
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    รายได้สุทธิ: <strong className={formData.netIncome < 0 ? 'text-red-600' : 'text-slate-700'}>{formatCurrency(formData.netIncome)} บ./เดือน</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    value={formData.dimensionScores?.economicScore ?? 20}
                    onChange={(e) => updateDimensionScore('economicScore', parseInt(e.target.value) || 0)}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                </div>

                {/* Dim 4: Caregiver */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">4. สภาพผู้ดูแล & สังคม</span>
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {formData.dimensionScores?.caregiverScore ?? 14} / 25
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    ผู้ดูแล: {formData.caregiverName || '-'} ({formData.caregiverRelation || '-'})
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    value={formData.dimensionScores?.caregiverScore ?? 14}
                    onChange={(e) => updateDimensionScore('caregiverScore', parseInt(e.target.value) || 0)}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Social Worker Official Opinion */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              ความเห็นของเจ้าหน้าที่สังคมสงเคราะห์ (ลงในแบบ สค.04):
            </label>
            <textarea
              rows={3}
              value={formData.socialWorkerOpinion}
              onChange={(e) => setFormData({ ...formData, socialWorkerOpinion: e.target.value })}
              placeholder="ความเห็นสรุปของเจ้าหน้าที่ฝ่ายสังคมสงเคราะห์..."
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg leading-relaxed focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {formData.aiSuggestions && (
            <div className="mt-2 text-xs text-indigo-800 bg-indigo-50 p-2.5 rounded-lg border border-indigo-200">
              <span className="font-bold">คำแนะนำเพิ่มเติมจาก AI:</span> {formData.aiSuggestions}
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* 8. กล้องถ่ายภาพสด & จัดการภาพถ่าย */}
        {/* ============================================================== */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 mb-4 gap-2">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">8</span>
                ถ่ายภาพอาการผู้ป่วยแบบเรียลไทม์ (Live Camera & อัปโหลด)
              </h3>
              <p className="text-xs text-slate-500">
                รองรับการเปิดกล้องสดบนมือถือ/แท็บเล็ต/คอมพิวเตอร์ และเลือกภาพจากเครื่องได้ไม่จำกัด
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition">
                <Upload className="w-3.5 h-3.5" />
                อัปโหลดรูปภาพ
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                เปิดกล้องถ่ายสด
              </button>
            </div>
          </div>

          {/* Photo Gallery Grid */}
          {formData.photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {formData.photos.map((photo) => (
                <div key={photo.id} className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-50 shadow-xs">
                  <div className="h-32 bg-slate-200 flex items-center justify-center overflow-hidden">
                    <img
                      src={photo.dataUrl}
                      alt={photo.caption || 'ภาพถ่าย'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="p-2 text-xs">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mb-1 ${
                      photo.category === 'patient' ? 'bg-blue-100 text-blue-800' :
                      photo.category === 'wound' ? 'bg-red-100 text-red-800' :
                      photo.category === 'house' ? 'bg-amber-100 text-amber-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {photo.category === 'patient' ? 'ภาพผู้ป่วย' :
                       photo.category === 'wound' ? 'แผลกดทับ/อาการ' :
                       photo.category === 'house' ? 'สภาพบ้าน' : 'ลงพื้นที่'}
                    </span>
                    <p className="text-slate-600 truncate text-[11px]">{photo.caption || '-'}</p>
                  </div>

                  {/* Remove Photo button */}
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      photos: formData.photos.filter((p) => p.id !== photo.id),
                    })}
                    className="absolute top-1.5 right-1.5 p-1 bg-red-600/80 hover:bg-red-600 text-white rounded-full transition cursor-pointer"
                    title="ลบภาพนี้"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
              <Camera className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p>ยังไม่มีภาพถ่าย กด "เปิดกล้องถ่ายสด" หรือ "อัปโหลดรูปภาพ"</p>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* 9. ระบบแนบเอกสาร (PDF, JPG, PNG) */}
        {/* ============================================================== */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">9</span>
                ระบบแนบเอกสารประกอบ (PDF, JPG, PNG)
              </h3>
              <p className="text-xs text-slate-500">
                แนบเอกสารราชการเพื่อประกอบแฟ้ม สค.04 หน้าที่ 3
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* 1. สำเนาบัตร ปชช */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
              <div>
                <div className="font-bold text-xs text-slate-800 mb-1">
                  1. สำเนาบัตรประชาชน
                </div>
                {formData.documents.find((d) => d.category === 'id_card') ? (
                  <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mb-2">
                    <Check className="w-3.5 h-3.5" />
                    แนบไฟล์แล้ว ({formData.documents.find((d) => d.category === 'id_card')?.fileName})
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 mb-2">ยังไม่ได้แนบเอกสาร</div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <label className="flex-1 py-1.5 px-2 bg-white border border-slate-300 hover:bg-slate-100 text-center text-xs font-medium rounded-lg cursor-pointer">
                  แนบไฟล์
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => handleDocumentUpload(e, 'id_card', 'สำเนาบัตรประจำตัวประชาชน')}
                    className="hidden"
                  />
                </label>
                {formData.documents.find((d) => d.category === 'id_card') && (
                  <button
                    type="button"
                    onClick={() => setViewingDoc(formData.documents.find((d) => d.category === 'id_card')!)}
                    className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                    title="ดูตัวอย่าง"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. ทะเบียนบ้าน */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
              <div>
                <div className="font-bold text-xs text-slate-800 mb-1">
                  2. สำเนาทะเบียนบ้าน
                </div>
                {formData.documents.find((d) => d.category === 'house_reg') ? (
                  <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mb-2">
                    <Check className="w-3.5 h-3.5" />
                    แนบไฟล์แล้ว ({formData.documents.find((d) => d.category === 'house_reg')?.fileName})
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 mb-2">ยังไม่ได้แนบเอกสาร</div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <label className="flex-1 py-1.5 px-2 bg-white border border-slate-300 hover:bg-slate-100 text-center text-xs font-medium rounded-lg cursor-pointer">
                  แนบไฟล์
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => handleDocumentUpload(e, 'house_reg', 'สำเนาทะเบียนบ้าน')}
                    className="hidden"
                  />
                </label>
                {formData.documents.find((d) => d.category === 'house_reg') && (
                  <button
                    type="button"
                    onClick={() => setViewingDoc(formData.documents.find((d) => d.category === 'house_reg')!)}
                    className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                    title="ดูตัวอย่าง"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 3. บัตรคนพิการ */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
              <div>
                <div className="font-bold text-xs text-slate-800 mb-1">
                  3. บัตรคนพิการ
                </div>
                {formData.documents.find((d) => d.category === 'disability_card') ? (
                  <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mb-2">
                    <Check className="w-3.5 h-3.5" />
                    แนบไฟล์แล้ว ({formData.documents.find((d) => d.category === 'disability_card')?.fileName})
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 mb-2">ยังไม่ได้แนบเอกสาร</div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <label className="flex-1 py-1.5 px-2 bg-white border border-slate-300 hover:bg-slate-100 text-center text-xs font-medium rounded-lg cursor-pointer">
                  แนบไฟล์
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => handleDocumentUpload(e, 'disability_card', 'สำเนาบัตรประจำตัวคนพิการ')}
                    className="hidden"
                  />
                </label>
                {formData.documents.find((d) => d.category === 'disability_card') && (
                  <button
                    type="button"
                    onClick={() => setViewingDoc(formData.documents.find((d) => d.category === 'disability_card')!)}
                    className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                    title="ดูตัวอย่าง"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 4. ใบรับรองแพทย์ */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
              <div>
                <div className="font-bold text-xs text-slate-800 mb-1">
                  4. ใบรับรองแพทย์
                </div>
                {formData.documents.find((d) => d.category === 'medical_cert') ? (
                  <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mb-2">
                    <Check className="w-3.5 h-3.5" />
                    แนบไฟล์แล้ว ({formData.documents.find((d) => d.category === 'medical_cert')?.fileName})
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 mb-2">ยังไม่ได้แนบเอกสาร</div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <label className="flex-1 py-1.5 px-2 bg-white border border-slate-300 hover:bg-slate-100 text-center text-xs font-medium rounded-lg cursor-pointer">
                  แนบไฟล์
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => handleDocumentUpload(e, 'medical_cert', 'ใบรับรองแพทย์/ประวัติการรักษา')}
                    className="hidden"
                  />
                </label>
                {formData.documents.find((d) => d.category === 'medical_cert') && (
                  <button
                    type="button"
                    onClick={() => setViewingDoc(formData.documents.find((d) => d.category === 'medical_cert')!)}
                    className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                    title="ดูตัวอย่าง"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 10. เจ้าหน้าที่และคณะกรรมการลงนาม */}
        {/* ============================================================== */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">10</span>
              รายนามเจ้าหน้าที่และคณะกรรมการลงนาม (Admin Signatures)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Interviewer */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <label className="block text-slate-500 mb-1 font-semibold">เจ้าหน้าที่สัมภาษณ์และลงพื้นที่:</label>
              <input
                type="text"
                value={formData.interviewerName}
                onChange={(e) => setFormData({ ...formData, interviewerName: e.target.value })}
                className="w-full font-bold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1 mb-1"
              />
              <input
                type="text"
                value={formData.interviewerPosition}
                onChange={(e) => setFormData({ ...formData, interviewerPosition: e.target.value })}
                className="w-full text-[11px] text-slate-600 bg-white border border-slate-200 rounded px-2 py-0.5"
              />
            </div>

            {/* Approver */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <label className="block text-slate-500 mb-1 font-semibold">ผู้พิจารณาอนุมัติ:</label>
              <input
                type="text"
                value={formData.approverName}
                onChange={(e) => setFormData({ ...formData, approverName: e.target.value })}
                className="w-full font-bold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1 mb-1"
              />
              <input
                type="text"
                value={formData.approverPosition}
                onChange={(e) => setFormData({ ...formData, approverPosition: e.target.value })}
                className="w-full text-[11px] text-slate-600 bg-white border border-slate-200 rounded px-2 py-0.5"
              />
            </div>

            {/* President */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <label className="block text-slate-500 mb-1 font-semibold">ประธานโครงการ/ผู้อนุมัติ:</label>
              <input
                type="text"
                value={formData.presidentName}
                onChange={(e) => setFormData({ ...formData, presidentName: e.target.value })}
                className="w-full font-bold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1 mb-1"
              />
              <input
                type="text"
                value={formData.presidentPosition}
                onChange={(e) => setFormData({ ...formData, presidentPosition: e.target.value })}
                className="w-full text-[11px] text-slate-600 bg-white border border-slate-200 rounded px-2 py-0.5"
              />
            </div>
          </div>
        </div>

        {/* Bottom Save Action */}
        <div className="flex items-center justify-between pt-4 pb-12">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-semibold transition cursor-pointer"
          >
            ยกเลิก
          </button>

          <button
            type="submit"
            className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-bold shadow-lg hover:shadow-xl transition cursor-pointer"
          >
            <Save className="w-5 h-5" />
            บันทึกข้อมูลผู้ป่วย (สค.04)
          </button>
        </div>

      </form>

      {/* Modals */}
      <LiveCameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handlePhotoCaptured}
      />

      <DocumentViewerModal
        isOpen={!!viewingDoc}
        onClose={() => setViewingDoc(null)}
        document={viewingDoc}
      />

      {showPrintLabel && (
        <PrintHouseQrLabel
          patient={formData}
          onClose={() => setShowPrintLabel(false)}
        />
      )}

      {showPrintForm && (
        <PrintFormSK04
          patient={formData}
          onClose={() => setShowPrintForm(false)}
        />
      )}
    </div>
  );
};
