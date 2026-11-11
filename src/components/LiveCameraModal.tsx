import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, X, Check, FlipHorizontal, AlertCircle } from 'lucide-react';
import { PatientPhoto } from '../types';
import { formatThaiDateShort } from '../utils/idCard';

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (photo: PatientPhoto) => void;
}

export const LiveCameraModal: React.FC<LiveCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [category, setCategory] = useState<'patient' | 'wound' | 'house' | 'visit'>('patient');
  const [caption, setCaption] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Check available cameras
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setHasMultipleCameras(videoDevices.length > 1);
    });
  }, []);

  // Start / restart camera
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    stopCamera();
    setErrorMsg(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setErrorMsg('ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตสิทธิ์การใช้กล้อง หรือใช้วิธีอัปโหลดภาพจากเครื่อง');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedDataUrl(dataUrl);
  };

  const retakePhoto = () => {
    setCapturedDataUrl(null);
  };

  const handleSave = () => {
    if (!capturedDataUrl) return;
    const now = new Date();
    const isoDate = now.toISOString().slice(0, 10);
    const timestamp = `${formatThaiDateShort(isoDate)} ${now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;

    onCapture({
      id: 'photo_' + Date.now(),
      category,
      dataUrl: capturedDataUrl,
      caption: caption.trim() || undefined,
      timestamp,
    });

    setCapturedDataUrl(null);
    setCaption('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-red-500" />
            <h3 className="font-semibold text-base">กล้องถ่ายภาพอาการสด (Live Camera)</h3>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder / Preview */}
        <div className="relative bg-black flex items-center justify-center min-h-[300px] overflow-hidden">
          {errorMsg ? (
            <div className="p-6 text-center text-slate-300 max-w-xs">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-2" />
              <p className="text-sm">{errorMsg}</p>
            </div>
          ) : capturedDataUrl ? (
            <img
              src={capturedDataUrl}
              alt="ภาพที่ถ่าย"
              className="max-h-[380px] w-full object-contain"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="max-h-[380px] w-full object-cover"
              />
              {/* Camera Switch button overlay */}
              <button
                type="button"
                onClick={toggleCameraFacing}
                className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2.5 rounded-full backdrop-blur-md transition cursor-pointer"
                title="สลับกล้องหน้า/หลัง"
              >
                <FlipHorizontal className="w-5 h-5" />
              </button>
            </>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Form Details */}
        <div className="p-4 space-y-3 bg-slate-50 flex-1 overflow-y-auto">
          {capturedDataUrl ? (
            <>
              {/* Category selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หมวดหมู่ภาพถ่าย *
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setCategory('patient')}
                    className={`py-2 px-3 rounded-lg border font-medium text-center transition cursor-pointer ${
                      category === 'patient'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    👤 ภาพถ่ายผู้ป่วย
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory('wound')}
                    className={`py-2 px-3 rounded-lg border font-medium text-center transition cursor-pointer ${
                      category === 'wound'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🩹 แผลกดทับ / อาการ
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory('house')}
                    className={`py-2 px-3 rounded-lg border font-medium text-center transition cursor-pointer ${
                      category === 'house'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🏠 สภาพบ้าน / ทางเข้า
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory('visit')}
                    className={`py-2 px-3 rounded-lg border font-medium text-center transition cursor-pointer ${
                      category === 'visit'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🤝 ขณะลงพื้นที่มอบของ
                  </button>
                </div>
              </div>

              {/* Caption */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  คำอธิบายภาพ (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="เช่น แผลกดทับที่สะโพกด้านขวา ขนาด 3 ซม."
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500 text-center">
              จัดมุมกล้องให้เห็นอาการหรือสภาพบ้านให้ชัดเจน แล้วกดปุ่มถ่ายภาพ
            </p>
          )}
        </div>

        {/* Action Controls */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          {capturedDataUrl ? (
            <>
              <button
                type="button"
                onClick={retakePhoto}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-medium transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                ถ่ายใหม่
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                บันทึกภาพลงในประวัติ
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={!!errorMsg}
                onClick={takePhoto}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm shadow-md transition cursor-pointer"
              >
                <Camera className="w-5 h-5" />
                กดถ่ายภาพ (Capture)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
