
import { jwtVerify } from 'jose';
import { parse } from 'cookie';

function getAllowedOrigin(request, env) {
    const requestOrigin = request.headers.get('Origin');
    if (!requestOrigin) return null;

    const allowed = (env.ALLOWED_ORIGIN || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    if (allowed.includes('*')) return requestOrigin;
    if (allowed.includes(requestOrigin)) return requestOrigin;
    return null;
}

function getTokenFromRequest(request, url) {
    const tokenFromQuery = url.searchParams.get('token');
    if (tokenFromQuery) return tokenFromQuery;

    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;

    const cookies = parse(cookieHeader);
    return cookies.token || null;
}

function getFolderPrefixForPath(videoPath) {
    if (!videoPath) return null;
    const idx = videoPath.lastIndexOf('/');
    if (idx === -1) return '';
    return videoPath.slice(0, idx + 1);
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const key = url.pathname.slice(1); // Remove leading slash

        const allowedOrigin = getAllowedOrigin(request, env);

        // 1. Handle CORS Preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
                    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Credentials': 'true',
                },
            });
        }

        // 2. Serve thumbnails publicly (no auth required)
        if (key.startsWith('thumbnails/')) {
            if (request.method !== 'GET' && request.method !== 'HEAD') {
                return new Response('Method Not Allowed', { status: 405 });
            }
            const object = await env.R2_BUCKET.get(key);
            if (object === null) {
                return new Response('Object Not Found', { status: 404 });
            }
            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);
            headers.set('Cache-Control', 'public, max-age=3600');
            if (allowedOrigin) {
                headers.set('Access-Control-Allow-Origin', allowedOrigin);
            }
            return new Response(object.body, { headers });
        }

        // 3. Validate Token (cookie or query param)
        const token = getTokenFromRequest(request, url);
        if (!token) {
            return new Response('Unauthorized: No token', { status: 401 });
        }

        try {
            const secret = new TextEncoder().encode(env.JWT_SECRET);
            const { payload } = await jwtVerify(token, secret);

            // Enforce token scope:
            // - Token is minted for the master playlist key (e.g., playlistId/jobId/master.m3u8)
            // - Player will then request sibling files under the same folder (segments + variant playlists)
            // So we allow any key under that folder prefix.
            const videoPath = typeof payload.videoPath === 'string' ? payload.videoPath : null;
            const folderPrefix = getFolderPrefixForPath(videoPath);

            if (!videoPath || folderPrefix === null) {
                return new Response('Forbidden: Invalid token scope', { status: 403 });
            }

            if (!(key === videoPath || key.startsWith(folderPrefix))) {
                return new Response('Forbidden: Token not valid for this resource', { status: 403 });
            }

        } catch (error) {
            return new Response('Forbidden: Invalid token', { status: 403 });
        }

        // 3. Fetch from R2
        if (request.method === 'GET' || request.method === 'HEAD') {
            const object = await env.R2_BUCKET.get(key);

            if (object === null) {
                return new Response('Object Not Found', { status: 404 });
            }

            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);
            if (allowedOrigin) {
                headers.set('Access-Control-Allow-Origin', allowedOrigin);
                headers.set('Access-Control-Allow-Credentials', 'true');
            }

            // Set Auth Cookie if provided in query (for subsequent segments)
            const tokenFromQuery = url.searchParams.get('token');
            if (tokenFromQuery) {
                headers.append('Set-Cookie', `token=${tokenFromQuery}; Path=/; Secure; SameSite=None; HttpOnly`);
            }

            return new Response(object.body, {
                headers,
            });
        }

        return new Response('Method Not Allowed', { status: 405 });
    },
};
