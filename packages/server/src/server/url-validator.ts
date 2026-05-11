import { isIP } from "net";

const PRIVATE_RANGES = [
  { start: "10.0.0.0", end: "10.255.255.255" },
  { start: "172.16.0.0", end: "172.31.255.255" },
  { start: "192.168.0.0", end: "192.168.255.255" },
  { start: "127.0.0.0", end: "127.255.255.255" },
  { start: "169.254.0.0", end: "169.254.255.255" },
  { start: "0.0.0.0", end: "0.255.255.255" },
];

function ipToNum(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isPrivateIP(ip: string): boolean {
  if (!isIP(ip)) return false;
  const num = ipToNum(ip);
  return PRIVATE_RANGES.some(r => num >= ipToNum(r.start) && num <= ipToNum(r.end));
}

export function isAllowedCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname;

    if (hostname === "localhost" || hostname === "[::1]") {
      return false;
    }

    if (isIP(hostname) && isPrivateIP(hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
