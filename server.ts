import 'dotenv/config';
import express, { Request, Response as ExpressResponse } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const app = express();
const PORT = Number(process.env.PORT || 3000);

const ICS_TOKEN_URL = process.env.ICS_TOKEN_URL || 'https://sso2.pea.co.th/realms/pea-users/protocol/openid-connect/token';
const ICS_API_BASE = process.env.ICS_API_BASE || 'https://ics.pea.co.th/api';
const ICS_CLIENT_ID = process.env.ICS_CLIENT_ID || 'pea-ics';
const ICS_CLIENT_SECRET = process.env.ICS_CLIENT_SECRET;
const ICS_USERINFO_URL = process.env.ICS_USERINFO_URL || 'https://sso2.pea.co.th/realms/pea-users/protocol/openid-connect/userinfo';

const parseIcsError = async (response: globalThis.Response) => {
    const text = await response.text();
    try {
        const json = JSON.parse(text);
        return json.error_description || json.error || text;
    } catch {
        return text || response.statusText;
    }
};

const isStaffInstallerRole = (role: unknown): role is 'staff' | 'installer' => {
    return role === 'staff' || role === 'installer';
};

async function exchangePasswordGrant(employeeCode: string, password: string) {
    const body = new URLSearchParams();
    body.append('client_id', ICS_CLIENT_ID);
    body.append('grant_type', 'password');
    body.append('username', employeeCode);
    body.append('password', password);
    body.append('scope', 'openid profile email');
    if (ICS_CLIENT_SECRET) {
        body.append('client_secret', ICS_CLIENT_SECRET);
    }

    const response = await fetch(ICS_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
    });

    if (!response.ok) {
        const errorMessage = await parseIcsError(response);
        throw new Error(`ICS login failed: ${errorMessage}`);
    }

    return response.json();
}

async function exchangeRefreshToken(refreshToken: string) {
    const body = new URLSearchParams();
    body.append('client_id', ICS_CLIENT_ID);
    body.append('grant_type', 'refresh_token');
    body.append('refresh_token', refreshToken);
    if (ICS_CLIENT_SECRET) {
        body.append('client_secret', ICS_CLIENT_SECRET);
    }

    const response = await fetch(ICS_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
    });

    if (!response.ok) {
        const errorMessage = await parseIcsError(response);
        throw new Error(`ICS refresh failed: ${errorMessage}`);
    }

    return response.json();
}

async function fetchIcsUserInfo(accessToken: string) {
    const response = await fetch(ICS_USERINFO_URL, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        return null;
    }

    return response.json();
}

app.use(express.json());

app.post('/api/ics-auth', async (req: Request, res: ExpressResponse) => {
    const { employeeCode, password, role } = req.body ?? {};

    if (!employeeCode || !password) {
        return res.status(400).json({ success: false, error: 'employeeCode and password are required' });
    }

    if (!isStaffInstallerRole(role)) {
        return res.status(400).json({ success: false, error: 'role must be staff or installer' });
    }

    try {
        const tokenResponse: any = await exchangePasswordGrant(employeeCode, password);
        const accessToken = tokenResponse.access_token;
        if (!accessToken) {
            return res.status(500).json({ success: false, error: 'ไม่พบ access token จาก ICS' });
        }

        const userInfo = await fetchIcsUserInfo(accessToken);
        const displayName = userInfo?.name || userInfo?.preferred_username || employeeCode;

        return res.status(200).json({
            success: true,
            data: {
                employeeCode,
                role,
                displayName,
                accessToken,
                refreshToken: tokenResponse.refresh_token,
                expiresIn: tokenResponse.expires_in
            }
        });
    } catch (error: any) {
        return res.status(401).json({ success: false, error: error?.message || 'ไม่สามารถยืนยันพนักงานได้' });
    }
});

app.post('/api/ics-token', async (req: Request, res: ExpressResponse) => {
    const { code, codeVerifier, redirectUri } = req.body ?? {};

    if (!code || !codeVerifier || !redirectUri) {
        return res.status(400).json({ success: false, error: 'code, codeVerifier, and redirectUri are required' });
    }

    try {
        const body = new URLSearchParams();
        body.append('client_id', ICS_CLIENT_ID);
        body.append('grant_type', 'authorization_code');
        body.append('code', code);
        body.append('redirect_uri', redirectUri);
        body.append('code_verifier', codeVerifier);
        if (ICS_CLIENT_SECRET) {
            body.append('client_secret', ICS_CLIENT_SECRET);
        }

        const tokenResponse = await fetch(ICS_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body
        });

        if (!tokenResponse.ok) {
            const errorMessage = await parseIcsError(tokenResponse);
            return res.status(401).json({ success: false, error: errorMessage });
        }

        const tokenPayload: any = await tokenResponse.json();
        const accessToken = tokenPayload.access_token;
        if (!accessToken) {
            return res.status(500).json({ success: false, error: 'ไม่พบ access token จาก ICS' });
        }

        const userInfo = await fetchIcsUserInfo(accessToken);

        return res.status(200).json({
            success: true,
            data: {
                accessToken,
                refreshToken: tokenPayload.refresh_token,
                expiresIn: tokenPayload.expires_in,
                userInfo
            }
        });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error?.message || 'Failed to exchange authorization code' });
    }
});

app.post('/api/ics-refresh', async (req: Request, res: ExpressResponse) => {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) {
        return res.status(400).json({ success: false, error: 'refreshToken is required' });
    }

    try {
        const tokenResponse: any = await exchangeRefreshToken(refreshToken);
        const accessToken = tokenResponse.access_token;
        if (!accessToken) {
            return res.status(500).json({ success: false, error: 'ไม่พบ access token จาก ICS' });
        }

        return res.status(200).json({
            success: true,
            data: {
                accessToken,
                refreshToken: tokenResponse.refresh_token,
                expiresIn: tokenResponse.expires_in
            }
        });
    } catch (error: any) {
        return res.status(401).json({ success: false, error: error?.message || 'ไม่สามารถรีเฟรชโทเค็นได้' });
    }
});

app.get('/api/ics-data', async (req: Request, res: ExpressResponse) => {
    const requestNumber = String(req.query.requestNumber || '').trim();
    const authorization = String(req.headers.authorization || '');

    if (!requestNumber) {
        return res.status(400).json({ success: false, error: 'requestNumber is required' });
    }

    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    try {
        const response = await fetch(`${ICS_API_BASE}/requests/${encodeURIComponent(requestNumber)}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json'
            }
        });

        if (response.status === 401 || response.status === 403) {
            return res.status(440).json({ success: false, error: 'ICS_SESSION_EXPIRED' });
        }

        if (!response.ok) {
            const errorMessage = await parseIcsError(response);
            return res.status(response.status).json({ success: false, error: errorMessage });
        }

        const icsData = await response.json();
        return res.status(200).json({ success: true, data: icsData });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error?.message || 'Failed to fetch ICS data' });
    }
});

app.get('/api/ics-notification', async (req: Request, res: ExpressResponse) => {
    const notificationId = String(req.query.notificationId || '').trim();
    const authorization = String(req.headers.authorization || '');

    if (!notificationId) {
        return res.status(400).json({ success: false, error: 'notificationId is required' });
    }

    try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (authorization.startsWith('Bearer ')) {
            headers.Authorization = authorization;
        }

        const response = await fetch(`${ICS_API_BASE}/notification/${encodeURIComponent(notificationId)}`, {
            headers
        });

        if (!response.ok) {
            const errorMessage = await parseIcsError(response);
            return res.status(response.status).json({ success: false, error: errorMessage });
        }

        const icsNotification = await response.json();
        return res.status(200).json({ success: true, data: icsNotification });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error?.message || 'Failed to fetch ICS notification' });
    }
});

async function startDev() {
    const vite = await createViteServer({
        server: { middlewareMode: true },
        root: process.cwd(),
        configFile: path.resolve(process.cwd(), 'vite.config.ts')
    });

    app.use(vite.middlewares);

    app.listen(PORT, () => {
        // eslint-disable-next-line no-console
        console.log(`Dev server running at http://localhost:${PORT}`);
    });
}

startDev().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
});