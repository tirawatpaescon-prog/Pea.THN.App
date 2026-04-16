import React, { useMemo, useState } from 'react';
import type { IcsNotificationPayload, WorkflowRequest, UserSession } from '../types';
import { PEALogo } from './PEALogo';

interface SharedDashboardProps {
    user: UserSession;
    requests: WorkflowRequest[];
    loading: boolean;
    officeFilter: string;
    selectedOffice: string;
    searchRequestNumber: string;
    fetchMessage: string | null;
    notificationId: string;
    notificationData: IcsNotificationPayload | null;
    notificationLoading: boolean;
    notificationError: string | null;
    onNotificationIdChange: (value: string) => void;
    onFetchNotification: () => Promise<void>;
    onSearchTermChange: (value: string) => void;
    onFetchRequest: () => Promise<void>;
    onOfficeFilterChange: (office: string) => void;
    onNavigate: (lat: number, lng: number) => void;
    onUpdateRequest: (requestId: string, meterNumber: string, file?: File) => Promise<void>;
    onChangeStatus: (requestId: string, status: WorkflowRequest['status']) => Promise<void>;
    sessionExpired: boolean;
    onOpenSessionModal: () => void;
}

const officeOptions = ['กฟส.ท่าคันโท'];

export const SharedDashboard = ({
    user,
    requests,
    loading,
    officeFilter,
    searchRequestNumber,
    fetchMessage,
    selectedOffice,
    onSearchTermChange,
    onFetchRequest,
    onOfficeFilterChange,
    onNavigate,
    onUpdateRequest,
    onChangeStatus,
    sessionExpired,
    onOpenSessionModal
}: SharedDashboardProps) => {
    const isInstaller = user.role === 'installer';
    const filteredRequests = useMemo(() => {
        const normalizedFilter = officeFilter.trim().toLowerCase();
        return requests
            .filter((request) => normalizedFilter === 'all' || !normalizedFilter || request.officeCode === officeFilter)
            .sort((a, b) => {
                if (a.status === 'Pending' && b.status !== 'Pending') return -1;
                if (a.status !== 'Pending' && b.status === 'Pending') return 1;
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            });
    }, [officeFilter, requests]);

    const [meterInputs, setMeterInputs] = useState<Record<string, string>>({});
    const [fileInputs, setFileInputs] = useState<Record<string, File | undefined>>({});

    const handleMeterInput = (requestId: string, value: string) => {
        setMeterInputs((prev) => ({ ...prev, [requestId]: value }));
    };

    const handleFileInput = (requestId: string, file?: File) => {
        setFileInputs((prev) => ({ ...prev, [requestId]: file }));
    };

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <PEALogo className="w-16 h-16" />
                            <div>
                                <h1 className="text-3xl font-black text-slate-900">Dashboard สำหรับ Staff / Installer</h1>
                                <p className="text-sm text-slate-600">สวัสดีคุณ {user.displayName} ({user.role === 'installer' ? 'ผู้ติดตั้ง' : 'พนักงาน'})</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-3xl bg-white border p-5 shadow-sm">
                            <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Office filter</span>
                            <select
                                value={selectedOffice}
                                onChange={(event) => onOfficeFilterChange(event.target.value)}
                                className="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                            >
                                {officeOptions.map((Office) => (
                                    <option key={Office} value={Office}>{Office === 'all' ? 'ทุกพื้นที่' : Office}</option>
                                ))}
                            </select>
                        </div>
                        <div className="rounded-3xl bg-white border p-5 shadow-sm">
                            <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">คำร้อง Pending</span>
                            <p className="mt-3 text-3xl font-black text-slate-900">{requests.filter((request) => request.status === 'Pending').length}</p>
                        </div>
                        <div className="rounded-3xl bg-white border p-5 shadow-sm">
                            <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">คำร้องทั้งหมด</span>
                            <p className="mt-3 text-3xl font-black text-slate-900">{requests.length}</p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
                    <div className="space-y-6">
                        <section className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">Priority 1: งาน Pending</h2>
                                    <p className="text-sm text-slate-500">คำร้องจะแสดงเรียงตามสถานะ Pending ก่อนเสมอ</p>
                                </div>
                                <button
                                    onClick={onOpenSessionModal}
                                    className="rounded-3xl bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-slate-800 transition"
                                >
                                    จำลอง Session ICS หลุด
                                </button>
                            </div>
                        </section>

                        <section className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm">
                            <h3 className="text-lg font-black text-slate-900 mb-4">ค้นหาเลขที่คำร้อง</h3>
                            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                                <input
                                    type="text"
                                    value={searchRequestNumber}
                                    onChange={(event) => onSearchTermChange(event.target.value)}
                                    className="w-full rounded-3xl border border-slate-200 px-4 py-4 text-sm outline-none focus:border-violet-500"
                                    placeholder="ค้นหาด้วยเลขที่คำร้อง"
                                />
                                <button
                                    onClick={onFetchRequest}
                                    className="rounded-3xl bg-violet-700 px-6 py-4 text-white font-black text-sm hover:bg-violet-800 transition"
                                >
                                    ดึงข้อมูลจาก ICS
                                </button>
                            </div>
                            {fetchMessage && <p className="mt-4 text-sm text-slate-600">{fetchMessage}</p>}
                        </section>

                        <section className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm">
                            <div className="flex items-center justify-between gap-4 mb-5">
                                <h3 className="text-lg font-black text-slate-900">Priority 2: ปฏิบัติการผู้ติดตั้ง</h3>
                                {isInstaller ? (
                                    <span className="rounded-full bg-emerald-100 px-4 py-2 text-xs font-black text-emerald-800">เฉพาะผู้ติดตั้ง</span>
                                ) : (
                                    <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-700">Staff ดูได้</span>
                                )}
                            </div>
                            <p className="text-sm text-slate-500">หมายเหตุ: ผู้ติดตั้งสามารถอัปเดตหมายเลขมิเตอร์และอัปโหลดภาพหน้างาน</p>
                        </section>
                    </div>

                    <div className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm">
                        <h3 className="text-lg font-black text-slate-900 mb-4">Priority 3: เครื่องมือ Office</h3>
                        <p className="text-sm text-slate-500">ใช้หน้าค้นหาเพื่อดึงข้อมูลจาก ICS และกรองพื้นที่</p>
                        <div className="mt-5 grid gap-3">
                            <button
                                onClick={onFetchRequest}
                                className="rounded-3xl bg-blue-600 px-4 py-4 text-white font-black text-sm hover:bg-blue-700 transition"
                            >
                                ดึงข้อมูล ICS ใหม่
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="rounded-3xl bg-slate-100 px-4 py-4 text-slate-800 font-black text-sm hover:bg-slate-200 transition"
                            >
                                รีเฟรชข้อมูลหน้าเว็บ (ถ้าจำเป็น)
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {loading ? (
                        <div className="rounded-[2rem] bg-white border border-slate-200 p-8 text-center text-slate-500 shadow-sm">กำลังโหลดรายการคำร้อง...</div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="rounded-[2rem] bg-white border border-slate-200 p-8 text-center text-slate-500 shadow-sm">ยังไม่มีคำร้องในพื้นที่นี้</div>
                    ) : (
                        filteredRequests.map((request) => (
                            <article key={request.requestNumber} className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">{request.officeCode}</span>
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800">{request.managementType}</span>
                                            <span className={`rounded-full px-3 py-1 text-xs font-black ${request.status === 'Pending' ? 'bg-amber-100 text-amber-800' : request.status === 'Installed' ? 'bg-emerald-100 text-emerald-800' : request.status === 'Disconnected' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{request.status}</span>
                                        </div>
                                        <p className="text-sm text-slate-600">คำร้อง: <span className="font-black text-slate-900">{request.requestNumber}</span></p>
                                        <p className="text-sm text-slate-600">CA: <span className="font-bold">{request.CA}</span></p>
                                        <p className="text-sm text-slate-600">ชื่อผู้ขอ: <span className="font-bold">{request.fullName}</span></p>
                                        <p className="text-sm text-slate-600">ที่อยู่: <span className="font-bold">{request.address}</span></p>
                                        <p className="text-sm text-slate-600">ประเภทมิเตอร์: <span className="font-bold">{request.meterType}</span></p>
                                        <p className="text-sm text-slate-600">ผู้ติดตั้ง: <span className="font-bold">{request.vendorName || 'ยังไม่ระบุ'}</span></p>
                                        <p className="text-sm text-slate-600">เลขบัตรผู้ขอ: <span className="font-bold">{request.requesterIdCard || 'ไม่ระบุ'}</span></p>
                                        <p className="text-sm text-slate-600">หมายเลขมิเตอร์ PEA: <span className="font-bold">{request.meterNumber || 'รอผู้ติดตั้งกรอก'}</span></p>
                                        <p className="text-sm text-slate-600">CA Number: <span className="font-bold">{request.caNumber || 'รอผู้ติดตั้งกรอก'}</span></p>
                                        <p className="text-sm text-slate-600">ยอดเงินประกัน: <span className="font-bold">{request.depositAmount.toLocaleString()} บาท</span></p>
                                    </div>

                                    <div className="grid gap-3 sm:w-72">
                                        <button
                                            type="button"
                                            onClick={() => onNavigate(request.lat, request.lng)}
                                            className="rounded-3xl bg-slate-900 px-4 py-3 text-white font-black text-sm hover:bg-slate-800 transition"
                                        >
                                            📍 นำทางไปจุดติดตั้ง
                                        </button>
                                        <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                            <p>พิกัด: {request.lat.toFixed(6)}, {request.lng.toFixed(6)}</p>
                                        </div>
                                        <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                            <p>อัปเดตล่าสุด: {new Date(request.updatedAt).toLocaleString('th-TH')}</p>
                                        </div>
                                    </div>
                                </div>

                                {isInstaller && (
                                    <div className="mt-6 rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
                                        <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-600 mb-3">ปฏิบัติการติดตั้ง</h4>
                                        {!request.vendorName || request.vendorName === user.displayName ? (
                                            <>
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <input
                                                        type="text"
                                                        placeholder="เลขมิเตอร์ PEA"
                                                        value={meterInputs[request.requestNumber] ?? request.meterNumber ?? ''}
                                                        onChange={(event) => handleMeterInput(request.requestNumber, event.target.value)}
                                                        className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                                                    />
                                                    <label className="flex cursor-pointer items-center justify-between rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
                                                        <span>{fileInputs[request.requestNumber] ? fileInputs[request.requestNumber]?.name : 'อัปโหลดรูปภาพหน้างาน'}</span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(event) => handleFileInput(request.requestNumber, event.target.files?.[0])}
                                                        />
                                                    </label>
                                                </div>
                                                <div className="mt-4 flex flex-wrap gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => onUpdateRequest(request.requestNumber, meterInputs[request.requestNumber] ?? request.meterNumber ?? '', fileInputs[request.requestNumber])}
                                                        className="rounded-3xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700 transition"
                                                    >
                                                        อัปเดตมิเตอร์ / อัปโหลดรูป
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onChangeStatus(request.requestNumber, request.managementType === 'Disconnection' ? 'Disconnected' : 'Installed')}
                                                        className="rounded-3xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700 transition"
                                                    >
                                                        {request.managementType === 'Disconnection' ? 'บันทึกการถอด' : 'ติดตั้งสำเร็จ'}
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="rounded-3xl bg-yellow-50 px-4 py-4 text-sm text-yellow-700">
                                                งานนี้มอบหมายให้ <span className="font-black">{request.vendorName}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </article>
                        ))
                    )}
                </div>

                {sessionExpired && (
                    <div className="rounded-[2rem] bg-amber-100 border border-amber-200 p-6 text-amber-900">
                        ระบบจำลอง SESSION ICS หลุดอยู่ หากต้องการเชื่อมต่อใหม่ โปรดกดปุ่มด้านบนเพื่อเข้าสู่ระบบ ICS ใหม่โดยไม่รีเฟรชหน้าเว็บ
                    </div>
                )}
            </div>
        </div>
    );
};
