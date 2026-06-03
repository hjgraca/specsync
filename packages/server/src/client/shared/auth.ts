const CODE_KEY_PREFIX = "specsync_code_";

/** The join code a person entered for a given document, if any. */
export function loadJoinCode(slug: string): string {
  return localStorage.getItem(`${CODE_KEY_PREFIX}${slug}`) || "";
}

export function saveJoinCode(slug: string, code: string): void {
  localStorage.setItem(`${CODE_KEY_PREFIX}${slug}`, code.trim());
}

/**
 * Headers every authenticated document request needs: the share token plus the
 * join code (the required second factor). Kept in one place so no call site can
 * forget the code and silently 403.
 */
export function authHeaders(token: string, code: string, extra?: Record<string, string>): Record<string, string> {
  return { "x-share-token": token, "x-join-code": code, ...extra };
}
