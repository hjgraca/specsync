import { describe, it, expect } from "vitest";
import { isAllowedCallbackUrl } from "../../src/server/url-validator.js";

// ---------------------------------------------------------------------------
// Blocked: private / internal IP addresses
// ---------------------------------------------------------------------------

describe("isAllowedCallbackUrl - private IPs", () => {
  it.each([
    ["http://127.0.0.1/callback", "loopback (127.0.0.1)"],
    ["http://127.0.0.255/callback", "loopback range (127.0.0.255)"],
    ["http://10.0.0.1/callback", "class A private (10.0.0.1)"],
    ["http://10.255.255.255/callback", "class A private upper (10.255.255.255)"],
    ["http://172.16.0.1/callback", "class B private lower (172.16.0.1)"],
    ["http://172.31.255.255/callback", "class B private upper (172.31.255.255)"],
    ["http://192.168.1.1/callback", "class C private (192.168.1.1)"],
    ["http://192.168.0.0/callback", "class C private lower (192.168.0.0)"],
    ["http://192.168.255.255/callback", "class C private upper (192.168.255.255)"],
    ["http://169.254.169.254/latest/meta-data", "link-local / cloud metadata (169.254.169.254)"],
    ["http://169.254.0.1/callback", "link-local lower (169.254.0.1)"],
    ["http://0.0.0.0/callback", "unspecified (0.0.0.0)"],
  ])("blocks %s  (%s)", (url) => {
    expect(isAllowedCallbackUrl(url)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Blocked: localhost and IPv6 loopback
// ---------------------------------------------------------------------------

describe("isAllowedCallbackUrl - localhost and IPv6 loopback", () => {
  it("blocks http://localhost", () => {
    expect(isAllowedCallbackUrl("http://localhost")).toBe(false);
  });

  it("blocks http://localhost:3000/webhook", () => {
    expect(isAllowedCallbackUrl("http://localhost:3000/webhook")).toBe(false);
  });

  it("blocks https://localhost/path", () => {
    expect(isAllowedCallbackUrl("https://localhost/path")).toBe(false);
  });

  it("blocks http://[::1]", () => {
    expect(isAllowedCallbackUrl("http://[::1]")).toBe(false);
  });

  it("blocks http://[::1]:8080/callback", () => {
    expect(isAllowedCallbackUrl("http://[::1]:8080/callback")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Blocked: non-HTTP protocols
// ---------------------------------------------------------------------------

describe("isAllowedCallbackUrl - non-http protocols", () => {
  it("blocks ftp:// protocol", () => {
    expect(isAllowedCallbackUrl("ftp://example.com/file")).toBe(false);
  });

  it("blocks file:// protocol", () => {
    expect(isAllowedCallbackUrl("file:///etc/passwd")).toBe(false);
  });

  it("blocks javascript: protocol", () => {
    expect(isAllowedCallbackUrl("javascript:alert(1)")).toBe(false);
  });

  it("blocks data: protocol", () => {
    expect(isAllowedCallbackUrl("data:text/html,<h1>hi</h1>")).toBe(false);
  });

  it("blocks ssh:// protocol", () => {
    expect(isAllowedCallbackUrl("ssh://user@host")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Blocked: invalid / malformed URLs
// ---------------------------------------------------------------------------

describe("isAllowedCallbackUrl - invalid URLs", () => {
  it("blocks empty string", () => {
    expect(isAllowedCallbackUrl("")).toBe(false);
  });

  it("blocks plain text that is not a URL", () => {
    expect(isAllowedCallbackUrl("not a url")).toBe(false);
  });

  it("blocks URL missing protocol", () => {
    expect(isAllowedCallbackUrl("example.com/callback")).toBe(false);
  });

  it("blocks a bare protocol with no host", () => {
    expect(isAllowedCallbackUrl("http://")).toBe(false);
  });

  it("blocks random garbage", () => {
    expect(isAllowedCallbackUrl("://broken")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Allowed: valid external URLs
// ---------------------------------------------------------------------------

describe("isAllowedCallbackUrl - allowed URLs", () => {
  it("allows https://example.com", () => {
    expect(isAllowedCallbackUrl("https://example.com")).toBe(true);
  });

  it("allows http://api.external.com:8080/callback", () => {
    expect(isAllowedCallbackUrl("http://api.external.com:8080/callback")).toBe(true);
  });

  it("allows https://hooks.slack.com/services/xxx", () => {
    expect(isAllowedCallbackUrl("https://hooks.slack.com/services/xxx")).toBe(true);
  });

  it("allows https with path and query string", () => {
    expect(isAllowedCallbackUrl("https://webhook.site/abc?key=val")).toBe(true);
  });

  it("allows http (non-TLS) to an external domain", () => {
    expect(isAllowedCallbackUrl("http://webhook.example.org/post")).toBe(true);
  });

  it("allows a URL with a non-private IP that is publicly routable", () => {
    expect(isAllowedCallbackUrl("https://8.8.8.8/dns")).toBe(true);
  });

  it("allows https with a port", () => {
    expect(isAllowedCallbackUrl("https://example.com:443/hook")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("isAllowedCallbackUrl - edge cases", () => {
  it("allows 172.15.255.255 (just below private range)", () => {
    // 172.15.x.x is NOT in the 172.16-172.31 private range
    expect(isAllowedCallbackUrl("http://172.15.255.255/callback")).toBe(true);
  });

  it("blocks 172.16.0.0 (lower bound of private range)", () => {
    expect(isAllowedCallbackUrl("http://172.16.0.0/callback")).toBe(false);
  });

  it("blocks 172.31.255.255 (upper bound of private range)", () => {
    expect(isAllowedCallbackUrl("http://172.31.255.255/callback")).toBe(false);
  });

  it("allows 172.32.0.0 (just above private range)", () => {
    expect(isAllowedCallbackUrl("http://172.32.0.0/callback")).toBe(true);
  });

  it("allows 11.0.0.1 (just above 10.x.x.x range)", () => {
    expect(isAllowedCallbackUrl("http://11.0.0.1/callback")).toBe(true);
  });

  it("allows 192.167.255.255 (just below 192.168.x.x range)", () => {
    expect(isAllowedCallbackUrl("http://192.167.255.255/callback")).toBe(true);
  });

  it("allows 192.169.0.0 (just above 192.168.x.x range)", () => {
    expect(isAllowedCallbackUrl("http://192.169.0.0/callback")).toBe(true);
  });
});
