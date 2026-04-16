import React, { useState } from 'react';

interface SessionExpireModalProps {
    open: boolean;
    userRole: 'staff' | 'installer';
    error?: string | null;
    onSubmit: () => Promise<void>;
    onClose: () => void;
}

export const SessionExpireModal = ({ open, userRole, error, onSubmit, onClose }: SessionExpireModalProps) => {
    const [loading, setLoading] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setLocalError(null);
        setLoading(true);
        try {
            await onSubmit();
        } catch (err) {
            setLocalError(err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อ ICS ได้');
        } finally {
            setLoading(false);
        }
    };

    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
            <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 shadow-2xl border border-slate-200">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">Session ICS หลุด</h2>
                        <p className="mt-2 text-sm text-slate-600">ระบบจะให้คุณกลับไปยังหน้าล็อกอินพนักงาน เพื่อยืนยันตัวตนและรับ token ใหม่</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
                        ปิด
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                    {(localError || error) && (
                        <div className="rounded-3xl bg-red-50 border border-red-200 p-4 text-sm font-bold text-red-700">
                            {localError || error}
                        </div>
                    )}
                    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
                        session หมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่ด้วยรหัสพนักงาน (บทบาท: {userRole === 'installer' ? 'ผู้ติดตั้ง' : 'พนักงาน'})
                    </div>
                    <button type="submit" disabled={loading} className="w-full rounded-3xl bg-violet-700 py-4 text-white font-black hover:bg-violet-800 transition">
                        {loading ? 'กำลังดำเนินการ...' : 'กลับไปหน้าล็อกอิน'}
                    </button>
                </form>
            </div>
        </div>
    );
};
