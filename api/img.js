export const config = { runtime: "edge" };

const MAX_BYTES = 6 * 1024 * 1024;
const PAGE_HOSTS = ["ibb.co", "ibb.co.com", "imgbb.com"];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function fail(status, text) {
  return new Response(text, { status, headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" } });
}

function parseTarget(raw) {
  let s = String(raw || "").trim();
  if (!s) return null;
  if (s.startsWith("//")) s = "https:" + s;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  s = s.replace(/^http:\/\//i, "https://");
  let u;
  try {
    u = new URL(s);
  } catch (e) {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return null;
  if (!h.includes(".")) return null;
  return u;
}

function isPageHost(h) {
  return PAGE_HOSTS.indexOf(h) !== -1;
}

function looksLikeImagePath(p) {
  return /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i.test(p);
}

async function resolvePage(u) {
  const res = await fetch(u.toString(), { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow" });
  if (!res.ok) return null;
  const html = await res.text();
  const a = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const b = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const found = (a && a[1]) || (b && b[1]);
  if (!found) return null;
  return parseTarget(found.replace(/&amp;/g, "&"));
}

export default async function handler(req) {
  const raw = new URL(req.url).searchParams.get("u");
  let target = parseTarget(raw);
  if (!target) return fail(400, "Bad url");

  try {
    if (isPageHost(target.hostname.toLowerCase()) && !looksLikeImagePath(target.pathname)) {
      const resolved = await resolvePage(target);
      if (!resolved) return fail(404, "Image not found");
      target = resolved;
    }

    const res = await fetch(target.toString(), {
      headers: { "user-agent": UA, accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" },
      redirect: "follow"
    });
    if (!res.ok) return fail(502, "Upstream " + res.status);

    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!type.startsWith("image/")) return fail(415, "Not an image");

    const len = parseInt(res.headers.get("content-length") || "0", 10);
    if (len && len > MAX_BYTES) return fail(413, "Too large");

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return fail(413, "Too large");

    return new Response(buf, {
      status: 200,
      headers: {
        "content-type": type,
        "cache-control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
        "access-control-allow-origin": "*",
        "x-content-type-options": "nosniff"
      }
    });
  } catch (e) {
    return fail(502, "Fetch failed");
  }
}