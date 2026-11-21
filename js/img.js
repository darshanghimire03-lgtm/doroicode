export function normalizeImgUrl(u) {
  if (typeof u !== "string") return "";
  let s = u.trim();
  if (!s) return "";
  if (s.startsWith("//")) s = "https:" + s;
  if (!/^https?:\/\//i.test(s) && /^[\w-]+(\.[\w-]+)+\//.test(s)) s = "https://" + s;
  s = s.replace(/^http:\/\//i, "https://");
  if (!/^https:\/\//i.test(s)) return "";
  return s;
}

export function proxyImgUrl(u) {
  const s = normalizeImgUrl(u);
  if (!s) return "";
  return "/api/img?u=" + encodeURIComponent(s);
}

function escAttr(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function logoImg(url, letter, lazy) {
  const direct = normalizeImgUrl(url);
  const l = letter || "?";
  if (!direct) return escAttr(l);
  return `<img src="${escAttr(proxyImgUrl(direct))}" data-direct="${escAttr(direct)}" alt="" referrerpolicy="no-referrer" decoding="async"${lazy ? ' loading="lazy"' : ""} data-i="${escAttr(l)}" data-img-fallback>`;
}

if (typeof document !== "undefined" && !window.__imgFallbackBound) {
  window.__imgFallbackBound = true;
  document.addEventListener(
    "error",
    (e) => {
      const el = e.target;
      if (!el || el.tagName !== "IMG" || !el.hasAttribute("data-img-fallback")) return;
      const direct = el.getAttribute("data-direct");
      if (direct && !el.hasAttribute("data-tried")) {
        el.setAttribute("data-tried", "1");
        el.setAttribute("referrerpolicy", "no-referrer");
        el.src = direct;
        return;
      }
      el.replaceWith(document.createTextNode(el.getAttribute("data-i") || "?"));
    },
    true
  );
}