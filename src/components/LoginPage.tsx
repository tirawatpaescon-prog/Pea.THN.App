import React, { useState } from 'react';
import { PEALogo } from './PEALogo';

interface LoginPageProps {
    onStaffInstallerLogin: (role: 'staff' | 'installer', employeeCode: string, password: string) => Promise<void>;
    onCustomerLogin: (idCard: string, phone: string) => Promise<void>;
    loading: boolean;
    error?: string | null;
}

const loginTabs: Array<{ id: 'staff' | 'customer'; label: string }> = [
    { id: 'staff', label: 'พนักงาน/ผู้ติดตั้ง' },
    { id: 'customer', label: 'ลูกค้า' }
];

export const LoginPage = ({ onStaffInstallerLogin, onCustomerLogin, loading, error }: LoginPageProps) => {
    const [activeTab, setActiveTab] = useState<'staff' | 'customer'>('staff');
    const [staffRole, setStaffRole] = useState<'staff' | 'installer'>('staff');
    const [employeeCode, setEmployeeCode] = useState('');
    const [employeePassword, setEmployeePassword] = useState('');
    const [idCard, setIdCard] = useState('');
    const [phone, setPhone] = useState('');

    const submitStaffInstaller = async (e: React.FormEvent) => {
        e.preventDefault();
        await onStaffInstallerLogin(staffRole, employeeCode, employeePassword);
    };

    const submitCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        await onCustomerLogin(idCard.trim(), phone.trim());
    };

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
                <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="bg-gradient-to-br from-violet-700 via-fuchsia-700 to-indigo-700 px-8 py-10 text-white sm:px-12">
                        <div className="flex flex-col items-start gap-6">
                            <PEALogo className="w-20 h-20 border border-white/20 rounded-3xl bg-white/10 p-4" />
                            <div>
                                <p className="text-sm uppercase tracking-[0.3em] text-violet-200">PEA Explorer</p>
                                <h1 className="mt-4 text-4xl font-black tracking-tight">ระบบจัดการคำร้อง ICS</h1>
                            </div>
                            <p className="max-w-md text-sm leading-7 text-slate-200">
                                เข้าสู่ระบบด้วยบัญชี PEA ICS หรือเข้าสู่ระบบลูกค้าเพื่อดูคำร้อง เรียลไทม์ และจัดการงานติดตั้งได้ทันที.
                            </p>
                            <div className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-white/10 p-6 text-sm text-slate-100 shadow-lg shadow-black/5">
                                <div className="flex gap-3">
                                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-3xl bg-white/15 text-white">1</span>
                                    <span>ล็อกอินด้วยบัญชีพนักงานหรือผู้ติดตั้ง</span>
                                </div>
                                <div className="flex gap-3">
                                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-3xl bg-white/15 text-white">2</span>
                                    <span>ดึงคำร้องจาก ICS ได้ทันที</span>
                                </div>
                                <div className="flex gap-3">
                                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-3xl bg-white/15 text-white">3</span>
                                    <span>กรองพื้นที่ ใช้งานทุกวันได้สะดวก</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="p-8 sm:p-10">
                        <div className="mb-8 flex flex-col gap-3">
                            <h2 className="text-2xl font-black text-slate-900">เข้าสู่ระบบ</h2>
                            <p className="text-sm text-slate-500">เลือกบทบาทของคุณและเข้าสู่ระบบเพื่อเริ่มใช้งาน</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {loginTabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`rounded-full border px-5 py-3 text-sm font-black transition ${activeTab === tab.id ? 'border-violet-700 bg-violet-700 text-white shadow-lg' : 'border-slate-200 bg-slate-100 text-slate-700 hover:border-slate-300 hover:bg-slate-200'}`}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        {error && (
                            <div className="mb-5 rounded-[1.5rem] border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
                                {error}
                            </div>
                        )}
                        {activeTab === 'staff' ? (
                            <form onSubmit={submitStaffInstaller} className="space-y-5">
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setStaffRole('staff')}
                                        className={`rounded-3xl py-3 text-sm font-black transition ${staffRole === 'staff' ? 'bg-violet-700 text-white shadow-lg' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                                        พนักงาน
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStaffRole('installer')}
                                        className={`rounded-3xl py-3 text-sm font-black transition ${staffRole === 'installer' ? 'bg-violet-700 text-white shadow-lg' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                                        ผู้ติดตั้ง
                                    </button>
                                </div>

                                <div className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
                                    <div>
                                        <label className="text-sm font-bold text-slate-700">รหัสพนักงาน</label>
                                        <input
                                            type="text"
                                            autoComplete="username"
                                            value={employeeCode}
                                            onChange={(event) => setEmployeeCode(event.target.value)}
                                            className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
                                            placeholder="กรอกชื่อผู้ใช้พนักงาน"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-slate-700">รหัสผ่าน</label>
                                        <input
                                            type="password"
                                            autoComplete="current-password"
                                            value={employeePassword}
                                            onChange={(event) => setEmployeePassword(event.target.value)}
                                            className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
                                            placeholder="กรอกรหัสผ่าน"
                                            disabled={loading}
                                        />
                                    </div>
                                </div>

                                <button type="submit" disabled={loading} className="w-full rounded-3xl bg-violet-700 py-4 text-white font-black text-sm hover:bg-violet-800 transition">
                                    {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบพนักงาน'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={submitCustomer} className="space-y-5">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-700">เลขบัตรประชาชน</label>
                                    <input
                                        type="text"
                                        autoComplete="off"
                                        value={idCard}
                                        onChange={(event) => setIdCard(event.target.value)}
                                        className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none focus:border-violet-500"
                                        placeholder="เลขบัตรประชาชน 13 หลัก"
                                        disabled={loading}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-700">เบอร์โทรศัพท์</label>
                                    <input
                                        type="tel"
                                        autoComplete="tel"
                                        value={phone}
                                        onChange={(event) => setPhone(event.target.value)}
                                        className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none focus:border-violet-500"
                                        placeholder="08xxxxxxxx"
                                        disabled={loading}
                                    />
                                </div>
                                <button type="submit" disabled={loading} className="w-full rounded-3xl bg-slate-900 py-4 text-white font-black text-sm hover:bg-slate-800 transition">
                                    {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบลูกค้า'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
