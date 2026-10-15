/** Copies to the clipboard, falling back to the old selection trick where the
 *  async API is missing or refused (an insecure origin, a sandboxed frame). */
export function copyText(text: string): Promise<boolean> {
  function fallback(): boolean {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => fallback(),
    );
  }
  return Promise.resolve(fallback());
}
