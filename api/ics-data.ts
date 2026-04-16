import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const requestNumber = String(req.query.requestNumber || '').trim();
    if (!requestNumber) {
        return res.status(400).json({ success: false, error: 'requestNumber is required' });
    }

    if (requestNumber.toUpperCase() === 'EXPIRE') {
        return res.status(440).json({ success: false, error: 'ICS_SESSION_EXPIRED' });
    }

    try {
        const icsUrl = `https://ics.pea.co.th/api/requests/${encodeURIComponent(requestNumber)}`;
        let icsData: any;

        try {
            const response = await fetch(icsUrl, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`ICS responded with status ${response.status}`);
            }
            icsData = await response.json();
        } catch (_error) {
            // Fallback mock data for development and demo mode
            icsData = {
                requestNumber,
                CA: `CA${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
                firstName: 'สมชาย',
                lastName: 'ใจดี',
                address: '123 หมู่ 4 ตำบลท่าคันโท อำเภอท่าคันโท จังหวัดกาฬสินธุ์',
                depositAmount: 900,
                meterType: requestNumber.endsWith('5') ? 8115 : 8114,
                officeCode: requestNumber.endsWith('1') ? 'กฟส.ท่าคันโท' : requestNumber.endsWith('2') ? 'กฟส.หนองกรุงศรี' : 'กฟส.ห้วยเม็ก',
                managementType: 'New Installation',
                lat: 16.5345,
                lng: 103.6534
            };
        }

        const payload = {
            requestNumber,
            CA: String(icsData.CA || icsData.caNumber || icsData.CA || `CA-${requestNumber}`),
            fullName: `${String(icsData.firstName || icsData.fullName || 'ไม่ระบุ').trim()} ${String(icsData.lastName || '').trim()}`.trim(),
            address: String(icsData.address || icsData.siteAddress || 'ไม่ระบุ'),
            depositAmount: Number(icsData.depositAmount ?? icsData.guaranteeAmount ?? 0),
            meterType: Number(icsData.meterType ?? icsData.meter_type ?? 0),
            officeCode: String(icsData.officeCode || icsData.officeCodeName || 'ไม่ระบุ'),
            managementType: String(icsData.managementType || icsData.management_type || 'Unknown'),
            lat: Number(icsData.lat ?? 16.5345),
            lng: Number(icsData.lng ?? 103.6534)
        };

        return res.status(200).json({ success: true, data: payload });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error?.message || 'Failed to fetch ICS data' });
    }
}
