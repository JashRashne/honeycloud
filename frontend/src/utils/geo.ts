// src/utils/geo.ts


type GeoInfo = {
        lat?: number;
        lon?: number;
        city?: string;
        country?: string;
        locationStr: string;
};

const GEO_CACHE = new Map<string, GeoInfo>();

const MAX_CONCURRENT = 15;
const BATCH_DELAY = 600; // ms - keeps us safe on free tier

export function isPrivateIP(ip: string): boolean {
        if (ip === '127.0.0.1' || ip === '::1') return true;
        const p = ip.split('.').map(Number);
        if (p.length !== 4 || p.some(isNaN)) return true;
        if (p[0] === 10) return true;
        if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
        if (p[0] === 192 && p[1] === 168) return true;
        if (p[0] === 169 && p[1] === 254) return true;
        return false;
}

async function fetchGeoData(ip: string): Promise<GeoInfo> {
        if (GEO_CACHE.has(ip)) {
                return GEO_CACHE.get(ip)!;
        }

        try {
                const res = await fetch(`https://ipapi.co/${ip}/json/`);

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const data = await res.json();

                if (data.error) {
                        console.warn(`Geo error for ${ip}:`, data.reason || data.error);
                        const fallback = { locationStr: 'Unknown' };
                        GEO_CACHE.set(ip, fallback);
                        return fallback;
                }

                const locationStr = [data.city, data.country_name || data.country]
                        .filter(Boolean)
                        .join(', ') || 'Unknown';

                const geoInfo = {
                        lat: data.latitude,
                        lon: data.longitude,
                        city: data.city,
                        country: data.country_name || data.country,
                        locationStr,
                };

                GEO_CACHE.set(ip, geoInfo);
                return geoInfo;
        } catch (err) {
                console.warn(`Geo lookup failed for ${ip}`, err);
                const fallback: GeoInfo = { locationStr: 'Unknown' };
                GEO_CACHE.set(ip, fallback);
                return fallback;
        }
}

type GeoMap = Record<string, {
        latitude?: number;
        longitude?: number;
        city?: string;
        country_name?: string;
}>;

export async function getGeoInfo(ips: string[]): Promise<{
        locations: Record<string, string>;
        geoMap: GeoMap;
}> {
        if (!ips || ips.length === 0) {
                return { locations: {}, geoMap: {} } as const;
        }

        const publicIPs = [...new Set(ips)].filter(ip => !isPrivateIP(ip));

        const locations: Record<string, string> = {};
        const geoMap: Record<string, {
                latitude?: number;
                longitude?: number;
                city?: string;
                country_name?: string;
        }> = {};

        for (let i = 0; i < publicIPs.length; i += MAX_CONCURRENT) {
                const batch = publicIPs.slice(i, i + MAX_CONCURRENT);

                const promises = batch.map(async (ip) => {
                        const info = await fetchGeoData(ip);

                        locations[ip] = info.locationStr;
                        // Only add full geo data if coordinates exist
                        if (info.lat != null && info.lon != null) {
                                geoMap[ip] = {
                                        latitude: info.lat,
                                        longitude: info.lon,
                                        city: info.city,
                                        country_name: info.country,
                                };
                        }

                });

                await Promise.all(promises);

                // Small delay between batches to stay under rate limits
                if (i + MAX_CONCURRENT < publicIPs.length) {
                        await new Promise(r => setTimeout(r, BATCH_DELAY));
                }
        }

        return { locations, geoMap };
}