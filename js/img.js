export function normalizeImgUrl(u) {
  if (typeof u !== "string") return "";
  let s = u.trim();
  if (!s) return "";
  if (s.startsWith("//")) s = "https:" + s;
  s = s.replace(/^http:\/\//i, "https://");
  if (!/^https:\/\//i.test(s)) return "";
  return s;
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
  const src = normalizeImgUrl(url);
  const l = letter || "?";
  if (!src) return escAttr(l);
  return `<img src="${escAttr(src)}" alt="" referrerpolicy="no-referrer" decoding="async"${lazy ? ' loading="lazy"' : ""} data-i="${escAttr(l)}" data-img-fallback>`;
}

if (typeof document !== "undefined" && !window.__imgFallbackBound) {
  window.__imgFallbackBound = true;
  document.addEventListener(
    "error",
    (e) => {
      const el = e.target;
      if (el && el.tagName === "IMG" && el.hasAttribute("data-img-fallback")) {
        el.replaceWith(document.createTextNode(el.getAttribute("data-i") || "?"));
      }
    },
    true
  );
}