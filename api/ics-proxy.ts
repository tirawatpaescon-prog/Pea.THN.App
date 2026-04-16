import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // รับเลข CA จากหน้าบ้าน
  const { caNumber } = req.query; 

  try {
    const user = process.env.PEA_USER;
    const pass = process.env.PEA_PASS;
    const { notificationId } = req.query;

    let icsUrl;
    if (notificationId) {
      icsUrl = `https://ics.pea.co.th/notification/${encodeURIComponent(String(notificationId))}`;
    } else if (caNumber) {
      icsUrl = `https://ics.pea.co.th/api/getUser?ca=${encodeURIComponent(String(caNumber))}`;
    } else {
      return res.status(400).json({ success: false, error: 'caNumber หรือ notificationId ต้องถูกส่งมาด้วย' });
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (user && pass) {
      headers.Authorization = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
    }

    const response = await fetch(icsUrl, { headers });
    const contentType = response.headers.get('content-type') || '';
    const rawData = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: typeof rawData === 'string' ? rawData : JSON.stringify(rawData) });
    }

    return res.status(200).json({
      success: true,
      data: rawData
    });

  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}