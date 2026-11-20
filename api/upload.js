export const config = { runtime: "edge" };

const IMGBB_URL = "https://api.imgbb.com/1/upload";
const MAX_BYTES = 4 * 1024 * 1024;

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const key = process.env.IMBB_API_KEY;
  if (!key) return json({ error: "IMBB_API_KEY is not set" }, 500);

  let file;
  try {
    const form = await req.formData();
    file = form.get("image");
  } catch (e) {
    return json({ error: "Invalid upload" }, 400);
  }

  if (!file || typeof file === "string") return json({ error: "No image provided" }, 400);
  if (!file.type || !file.type.startsWith("image/")) return json({ error: "Choose an image file" }, 400);
  if (file.size > MAX_BYTES) return json({ error: "Image is larger than 4 MB" }, 413);

  const body = new FormData();
  body.append("key", key);
  body.append("image", file, file.name || "logo");

  let data;
  try {
    const res = await fetch(IMGBB_URL, { method: "POST", body });
    data = await res.json();
  } catch (e) {
    return json({ error: "Upload service unreachable" }, 502);
  }

  if (!data || !data.success || !data.data || !data.data.url) {
    return json({ error: data && data.error && data.error.message ? data.error.message : "Upload failed" }, 502);
  }

  return json({ url: data.data.url });
}