import React, { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  Lock,
  User,
  Key,
  ShieldCheck,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
  Cloud,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { ADMIN_USERS, AdminUser } from '../types';
import { isSuperAdminUser } from '../firebase';

interface LoginModalProps {
  currentAdmin: AdminUser;
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (admin: AdminUser) => void;
  firebaseUser?: FirebaseUser | null;
  cloudStatus?: 'disconnected' | 'syncing' | 'synced' | 'error';
  onCloudSignIn?: () => void;
  onCloudSignOut?: () => void;
  onManualCloudSync?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  currentAdmin,
  isOpen,
  onClose,
  onLoginSuccess,
  firebaseUser = null,
  cloudStatus = 'disconnected',
  onCloudSignIn,
  onCloudSignOut,
  onManualCloudSync,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedUser = username.trim().toLowerCase();
    const foundAdmin = ADMIN_USERS.find(
      (u) => u.username.toLowerCase() === trimmedUser && u.password === password
    );

    if (foundAdmin) {
      setSuccessMsg(`ยินดีต้อนรับ ${foundAdmin.name}`);
      setTimeout(() => {
        onLoginSuccess(foundAdmin);
        onClose();
      }, 400);
    } else {
      setErrorMsg('ชื่อผู้ใช้งาน (Username) หรือรหัสผ่าน (Password) ไม่ถูกต้อง');
    }
  };

  const handleQuickSelect = (admin: AdminUser) => {
    setUsername(admin.username);
    setPassword(admin.password || '');
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">เข้าสู่ระบบเจ้าหน้าที่ & Cloud Firestore</h3>
              <p className="text-xs text-slate-300">
                มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Firebase Cloud Sync Card */}
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-blue-600" />
                <span>ฐานข้อมูลถาวร Cloud Firestore (bd-care-6176a)</span>
              </span>
              {firebaseUser && isSuperAdminUser(firebaseUser) && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                  Super Admin
                </span>
              )}
            </div>

            {firebaseUser ? (
              <div className="space-y-2">
                <div className="text-xs text-slate-700 bg-white border border-blue-100 rounded-lg p-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">
                      {firebaseUser.displayName || 'ผู้ใช้งานระบบ'}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{firebaseUser.email}</div>
                  </div>
                  <span
                    className={`text-[10.5px] font-bold px-2 py-0.5 rounded shrink-0 ${
                      cloudStatus === 'syncing'
                        ? 'bg-blue-100 text-blue-800'
                        : cloudStatus === 'error'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {cloudStatus === 'syncing'
                      ? 'กำลังซิงค์'
                      : cloudStatus === 'error'
                      ? 'ผิดพลาด'
                      : 'เชื่อมต่อแล้ว'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onManualCloudSync}
                    className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${cloudStatus === 'syncing' ? 'animate-spin' : ''}`} />
                    <span>ซิงค์ข้อมูลขึ้น Cloud ทันที</span>
                  </button>
                  <button
                    type="button"
                    onClick={onCloudSignOut}
                    className="py-1.5 px-3 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>ออก</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11.5px] text-slate-600 leading-relaxed">
                  เชื่อมต่อด้วยบัญชี Google เพื่อสำรองและซิงค์ข้อมูลผู้ป่วย คำร้องเผาศพ และสิ่งของบริจาคทั้งหมดแบบเรียลไทม์ ป้องกันข้อมูลสูญหายเมื่ออัปเดตแอป
                </p>
                <button
                  type="button"
                  onClick={onCloudSignIn}
                  className="w-full py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 rounded-lg text-xs font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Cloud className="w-4 h-4 text-blue-600" />
                  <span>เข้าสู่ระบบด้วย Google เพื่อเชื่อมต่อ Cloud</span>
                </button>
              </div>
            )}
          </div>

          {/* Currently logged-in status badge */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${currentAdmin.avatarColor}`} />
              <div>
                <span className="text-slate-500">เจ้าหน้าที่ผู้ปฏิบัติงานปัจจุบัน:</span>{' '}
                <span className="font-bold text-slate-900">{currentAdmin.name}</span>
              </div>
            </div>
            <span className="bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded text-[11px]">
              {currentAdmin.roleTitle}
            </span>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-3.5">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ชื่อผู้ใช้งานเจ้าหน้าที่ (Username)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="เช่น gritpipat, aleena, muanruethai, sataporn"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  required
                  className="w-full pl-9 pr-10 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>สลับบัญชีเจ้าหน้าที่</span>
            </button>
          </form>

          {/* Quick Click Staff Credentials Reference */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>รายชื่อเจ้าหน้าที่รับคำร้อง & ผู้อนุมัติ (คลิกเพื่อเลือกทันที)</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {ADMIN_USERS.map((admin) => (
                <button
                  key={admin.id}
                  type="button"
                  onClick={() => handleQuickSelect(admin)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2 ${
                    username.toLowerCase() === admin.username.toLowerCase()
                      ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${admin.avatarColor}`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 truncate">{admin.name}</div>
                    <div className="text-[11px] text-blue-700 font-medium truncate">{admin.roleTitle}</div>
                    <div className="text-[10.5px] font-mono text-slate-500 mt-1 flex items-center gap-2">
                      <span>User: <strong className="text-slate-800">{admin.username}</strong></span>
                      <span>Pass: <strong className="text-slate-800">{admin.password}</strong></span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
