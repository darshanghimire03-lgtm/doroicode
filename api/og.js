import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

const DB = "https://darshang-8f99d-default-rtdb.firebaseio.com";
const LIME = "#A3E635";

async function getJson(path) {
  try {
    const r = await fetch(DB + path + ".json");
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  }
}

function sniff(b) {
  if (b.length > 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 3 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  return null;
}

function toBase64(bytes) {
  let bin = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + size));
  }
  return btoa(bin);
}

async function logoData(src, origin) {
  if (!src) return null;
  try {
    const abs = new URL(src, origin + "/").toString();
    const r = await fetch(abs);
    if (!r.ok) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length > 4 * 1024 * 1024) return null;
    const type = sniff(bytes);
    if (!type) return null;
    return "data:" + type + ";base64," + toBase64(bytes);
  } catch (e) {
    return null;
  }
}

async function loadFont() {
  try {
    const r = await fetch("https://cdn.jsdelivr.net/fontsource/fonts/inter@5.0.8/latin-800-normal.woff");
    if (!r.ok) return null;
    return await r.arrayBuffer();
  } catch (e) {
    return null;
  }
}

function box(style, children) {
  return { type: "div", props: { style: Object.assign({ display: "flex" }, style), children } };
}

function teamBlock(name, logo, size) {
  const LOGO = size || 300;
  const nameSize = LOGO >= 300 ? 44 : 34;
  const letter = name ? name.charAt(0).toUpperCase() : "?";
  const shown = name.length > 24 ? name.slice(0, 23) + "..." : name;

  const logoNode = logo
    ? box(
        {
          width: LOGO,
          height: LOGO,
          borderRadius: Math.round(LOGO * 0.23),
          overflow: "hidden",
          background: "#0C0F0D",
          border: "4px solid rgba(163,230,53,0.55)"
        },
        { type: "img", props: { src: logo, width: LOGO, height: LOGO, style: { width: LOGO, height: LOGO, objectFit: "cover" } } }
      )
    : box(
        {
          alignItems: "center",
          justifyContent: "center",
          width: LOGO,
          height: LOGO,
          borderRadius: Math.round(LOGO * 0.23),
          background: "#151A17",
          border: "4px solid rgba(163,230,53,0.55)",
          color: LIME,
          fontSize: Math.round(LOGO * 0.43),
          fontWeight: 800
        },
        letter
      );

  return box(
    { flexDirection: "column", alignItems: "center", width: LOGO >= 300 ? 420 : 340 },
    [
      logoNode,
      box(
        {
          justifyContent: "center",
          textAlign: "center",
          marginTop: LOGO >= 300 ? 26 : 16,
          maxWidth: LOGO >= 300 ? 420 : 340,
          color: "#F4F6F4",
          fontSize: nameSize,
          fontWeight: 800,
          lineHeight: 1.15
        },
        shown
      )
    ]
  );
}

export default async function handler(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const origin = url.origin;
  const host = new URL(origin).host.toUpperCase();

  let title = "";
  let n1 = "";
  let n2 = "";
  let l1 = null;
  let l2 = null;
  let found = false;

  const fontPromise = loadFont();

  if (id) {
    const m = await getJson("/matches/" + encodeURIComponent(id));
    if (m && m.team1 && m.team2) {
      const [t1, t2] = await Promise.all([
        getJson("/teams/" + encodeURIComponent(m.team1)),
        getJson("/teams/" + encodeURIComponent(m.team2))
      ]);
      title = m.title ? String(m.title) : "";
      n1 = t1 && t1.name ? t1.name : "TBD";
      n2 = t2 && t2.name ? t2.name : "TBD";
      const logos = await Promise.all([
        logoData(t1 && t1.logourl, origin),
        logoData(t2 && t2.logourl, origin)
      ]);
      l1 = logos[0];
      l2 = logos[1];
      found = true;
    }
  }

  const brand = box(
    { alignItems: "center", fontSize: 42, fontWeight: 800, color: "#F4F6F4" },
    [box({}, "NPL"), box({ color: LIME }, "code")]
  );

  const compact = title.length > 0;
  const logoSize = compact ? 180 : 300;
  const shownTitle = title.length > 60 ? title.slice(0, 59) + "..." : title;
  const titleNode = shownTitle
    ? box(
        {
          justifyContent: "center",
          textAlign: "center",
          maxWidth: 1060,
          color: LIME,
          fontSize: shownTitle.length > 36 ? 66 : 84,
          fontWeight: 800,
          lineHeight: 1.05,
          letterSpacing: -2
        },
        shownTitle
      )
    : null;
  const teamsRow = found
    ? box(
        { alignItems: "center", justifyContent: "center", width: "100%" },
        [
          teamBlock(n1, l1, logoSize),
          box(
            {
              alignItems: "center",
              justifyContent: "center",
              width: compact ? 110 : 150,
              height: compact ? 110 : 150,
              borderRadius: 75,
              margin: compact ? "0 30px 50px" : "0 30px 80px",
              background: LIME,
              color: "#0C0F0D",
              fontSize: compact ? 44 : 58,
              fontWeight: 800,
              boxShadow: "0 0 70px rgba(163,230,53,0.55)"
            },
            "VS"
          ),
          teamBlock(n2, l2, logoSize)
        ]
      )
    : box(
        { alignItems: "center", justifyContent: "center", flex: 1, color: "#F4F6F4", fontSize: 72, fontWeight: 800 },
        "Live matches & watch links"
      );

  const body = found && titleNode
    ? box({ flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, width: "100%" }, [titleNode, teamsRow])
    : found
      ? box({ alignItems: "center", justifyContent: "center", flex: 1, width: "100%" }, [teamsRow])
      : teamsRow;

  const footer = box(
    {
      alignItems: "center",
      justifyContent: "center",
      color: "#0C0F0D",
      background: LIME,
      fontSize: 28,
      fontWeight: 800,
      padding: "12px 34px",
      borderRadius: 999
    },
    found ? "WATCH LIVE ON " + host : host
  );

  const tree = box(
    {
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      height: "100%",
      padding: "40px 60px",
      background: "linear-gradient(160deg, #1C231F 0%, #0C0F0D 65%)"
    },
    [brand, body, footer]
  );

  const font = await fontPromise;
  const options = {
    width: 1200,
    height: 630,
    headers: {
      "cache-control": found
        ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
        : "public, max-age=300, s-maxage=300"
    }
  };
  if (font) {
    options.fonts = [{ name: "Inter", data: font, weight: 800, style: "normal" }];
  }

  return new ImageResponse(tree, options);
}