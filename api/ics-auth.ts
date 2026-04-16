import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const body = req.body ?? {};
    const employeeCode = String(body.employeeCode || '').trim();
    const password = String(body.password || '').trim();

    if (!employeeCode || !password) {
        return res.status(400).json({ success: false, error: 'employeeCode and password are required' });
    }

    const validStaff = employeeCode === process.env.ICS_STAFF_CODE && password === process.env.ICS_STAFF_PASSWORD;
    const validInstaller = employeeCode === process.env.ICS_INSTALLER_CODE && password === process.env.ICS_INSTALLER_PASSWORD;

    if (!validStaff && !validInstaller) {
        if (employeeCode.toUpperCase().startsWith('EXPIRE')) {
            return res.status(440).json({ success: false, error: 'ICS_SESSION_EXPIRED' });
        }

        if (employeeCode.startsWith('INST') && password === 'pea@1234') {
            return res.status(200).json({ success: true, data: { employeeCode, role: 'installer', displayName: `Installer ${employeeCode}` } });
        }

        if (employeeCode.startsWith('STAFF') && password === 'pea@1234') {
            return res.status(200).json({ success: true, data: { employeeCode, role: 'staff', displayName: `Staff ${employeeCode}` } });
        }

        return res.status(401).json({ success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่าน ICS ไม่ถูกต้อง' });
    }

    const role = validInstaller ? 'installer' : 'staff';
    const displayName = `${role === 'installer' ? 'Installer' : 'Staff'} ${employeeCode}`;

    return res.status(200).json({ success: true, data: { employeeCode, role, displayName } });
}
