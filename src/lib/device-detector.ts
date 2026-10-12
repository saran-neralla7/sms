/**
 * Device and IP detector utility.
 * Extracts client IP address, device type, OS, and browser from incoming HTTP headers.
 */

export interface DeviceInfo {
    ip: string;
    deviceType: string;  // Mobile, Tablet, Desktop, Bot, or Unknown
    deviceModel?: string; // e.g. "iPhone", "SM-S918B", "Redmi Note 12", etc.
    os: string;          // e.g. "Android 14", "iOS 17.5", "Windows 10/11", "macOS", "Linux"
    browser: string;     // e.g. "Chrome 128", "Safari 17", "Firefox 129", "Edge 128"
    userAgent: string;
}

export function parseDeviceFromHeaders(headersList: any): DeviceInfo {
    const getHeader = (name: string): string => {
        if (!headersList) return "";
        if (typeof headersList.get === "function") {
            return headersList.get(name) || "";
        }
        const val = headersList[name.toLowerCase()] ?? headersList[name];
        if (Array.isArray(val)) return val[0] || "";
        return typeof val === "string" ? val : "";
    };

    // 1. IP extraction
    const forwardedFor = getHeader("x-forwarded-for");
    const realIp = getHeader("x-real-ip");
    const cfConnectingIp = getHeader("cf-connecting-ip");
    let ip = "127.0.0.1";

    if (forwardedFor) {
        ip = forwardedFor.split(",")[0].trim();
    } else if (cfConnectingIp) {
        ip = cfConnectingIp.trim();
    } else if (realIp) {
        ip = realIp.trim();
    }

    if (ip.startsWith("::ffff:")) {
        ip = ip.replace("::ffff:", "");
    }

    // 2. User Agent & Client Hints
    const ua = getHeader("user-agent") || "";
    const chModel = getHeader("sec-ch-ua-model")?.replace(/"/g, "").trim();
    const chPlatform = getHeader("sec-ch-ua-platform")?.replace(/"/g, "").trim();
    const chMobile = getHeader("sec-ch-ua-mobile");

    let deviceType = "Desktop";
    let deviceModel = chModel || "";
    let os = chPlatform || "Unknown OS";
    let browser = "Unknown Browser";

    const uaLower = ua.toLowerCase();

    if (/tablet|ipad|playbook|silk/i.test(ua)) {
        deviceType = "Tablet";
    } else if (/mobile|iphone|ipod|android.*mobile|blackberry|iemobile|opera mini/i.test(ua) || chMobile === "?1") {
        deviceType = "Mobile";
    } else if (/bot|crawler|spider|curl|postman/i.test(ua)) {
        deviceType = "Bot";
    } else {
        deviceType = "Desktop";
    }

    if (uaLower.includes("windows nt 10.0")) os = "Windows 10/11";
    else if (uaLower.includes("windows nt 6.3")) os = "Windows 8.1";
    else if (uaLower.includes("windows nt 6.1")) os = "Windows 7";
    else if (uaLower.includes("macintosh") || uaLower.includes("mac os x")) {
        const match = ua.match(/Mac OS X ([0-9_]+)/);
        os = match ? `macOS ${match[1].replace(/_/g, ".")}` : "macOS";
    } else if (uaLower.includes("android")) {
        const match = ua.match(/Android\s+([0-9.]+)/i);
        os = match ? `Android ${match[1]}` : "Android";
        
        if (!deviceModel) {
            const modelMatch = ua.match(/Android[^;]+;\s*([^;)]+)\s*(?:Build|[;)])/i);
            if (modelMatch && modelMatch[1]) {
                const rawModel = modelMatch[1].trim();
                if (!rawModel.toLowerCase().includes("wv") && !rawModel.toLowerCase().includes("k")) {
                    deviceModel = rawModel;
                }
            }
        }
    } else if (uaLower.includes("iphone")) {
        os = "iOS";
        deviceModel = "iPhone";
        const match = ua.match(/OS\s+([0-9_]+)/i);
        if (match) os = `iOS ${match[1].replace(/_/g, ".")}`;
    } else if (uaLower.includes("ipad")) {
        os = "iPadOS";
        deviceModel = "iPad";
    } else if (uaLower.includes("linux")) {
        os = "Linux";
    }

    if (uaLower.includes("edg/")) {
        const match = ua.match(/Edg\/([0-9.]+)/);
        browser = match ? `Edge ${match[1].split(".")[0]}` : "Edge";
    } else if (uaLower.includes("chrome/") && !uaLower.includes("chromium/")) {
        const match = ua.match(/Chrome\/([0-9.]+)/);
        browser = match ? `Chrome ${match[1].split(".")[0]}` : "Chrome";
    } else if (uaLower.includes("safari/") && !uaLower.includes("chrome/")) {
        const match = ua.match(/Version\/([0-9.]+)/);
        browser = match ? `Safari ${match[1].split(".")[0]}` : "Safari";
    } else if (uaLower.includes("firefox/")) {
        const match = ua.match(/Firefox\/([0-9.]+)/);
        browser = match ? `Firefox ${match[1].split(".")[0]}` : "Firefox";
    } else if (uaLower.includes("opera") || uaLower.includes("opr/")) {
        browser = "Opera";
    }

    return {
        ip,
        deviceType,
        deviceModel: deviceModel || undefined,
        os,
        browser,
        userAgent: ua
    };
}
