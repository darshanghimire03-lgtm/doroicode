import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

const DB = process.env.FIREBASE_DATABASE_URL;
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
    const abs = origin + "/api/img?u=" + encodeURIComponent(String(src).trim());
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

async function loadFont(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.arrayBuffer();
  } catch (e) {
    return null;
  }
}

function box(style, children) {
  return { type: "div", props: { style: Object.assign({ display: "flex" }, style), children } };
}

function abs(style, children) {
  return box(Object.assign({ position: "absolute" }, style), children);
}

function bgHalf(logo, side) {
  const left = side === "left";
  const rgb = left ? "163,230,53" : "34,211,238";
  const kids = [];

  if (logo) {
    kids.push({
      type: "img",
      props: {
        src: logo,
        width: 900,
        height: 900,
        style: {
          position: "absolute",
          left: -60,
          top: -135,
          width: 900,
          height: 900,
          objectFit: "cover",
          filter: "blur(40px)",
          opacity: 0.95
        }
      }
    });
  }

  kids.push(
    abs({
      left: 0,
      top: 0,
      width: 780,
      height: 630,
      background: "linear-gradient(" + (left ? "90deg" : "270deg") + ", rgba(" + rgb + ",0.30) 0%, rgba(" + rgb + ",0) 80%)"
    })
  );

  const style = {
    position: "absolute",
    top: 0,
    width: 780,
    height: 630,
    overflow: "hidden",
    background: "linear-gradient(" + (left ? "160deg" : "200deg") + ", rgba(" + rgb + ",0.25), #0C0F0D)",
    maskImage: "linear-gradient(" + (left ? "90deg" : "270deg") + ", #000 42%, rgba(0,0,0,0) 100%)"
  };
  style[left ? "left" : "right"] = 0;
  return box(style, kids);
}

function teamCol(name, logo, side, compact) {
  const left = side === "left";
  const accent = left ? LIME : "#22D3EE";
  const rgb = left ? "163,230,53" : "34,211,238";
  const size = compact ? 190 : 250;
  const letter = name ? name.charAt(0).toUpperCase() : "?";
  const shown = name.length > 22 ? name.slice(0, 21) + "..." : name;

  const logoNode = logo
    ? box(
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.24),
          overflow: "hidden",
          background: "#0C0F0D",
          border: "5px solid " + accent,
          boxShadow: "0 0 60px rgba(" + rgb + ",0.55)"
        },
        { type: "img", props: { src: logo, width: size, height: size, style: { width: size, height: size, objectFit: "cover" } } }
      )
    : box(
        {
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.24),
          background: "#151A17",
          border: "5px solid " + accent,
          boxShadow: "0 0 60px rgba(" + rgb + ",0.55)",
          color: accent,
          fontSize: Math.round(size * 0.46),
          fontWeight: 800
        },
        letter
      );

  const nameNode = box(
    {
      justifyContent: "center",
      textAlign: "center",
      marginTop: 24,
      maxWidth: 520,
      color: "#F4F6F4",
      fontSize: compact ? 38 : 46,
      fontWeight: 800,
      lineHeight: 1.12,
      textShadow: "0 4px 24px rgba(0,0,0,0.85)"
    },
    shown
  );

  return abs(
    {
      left: left ? 0 : 600,
      top: 0,
      width: 600,
      height: 630,
      flexDirection: "column",
      alignItems: "center",
      paddingTop: compact ? 182 : 140
    },
    [logoNode, nameNode]
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

  const interPromise = loadFont("https://cdn.jsdelivr.net/fontsource/fonts/inter@5.0.8/latin-800-normal.woff");
  const thunderPromise = loadFont("https://cdn.jsdelivr.net/fontsource/fonts/racing-sans-one@latest/latin-400-normal.woff");

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
    { alignItems: "center", fontSize: 40, fontWeight: 800, color: "#F4F6F4", textShadow: "0 4px 20px rgba(0,0,0,0.8)" },
    [box({}, "NPL"), box({ color: LIME }, "code")]
  );

  const footer = box(
    {
      alignItems: "center",
      justifyContent: "center",
      color: "#0C0F0D",
      background: LIME,
      fontSize: 26,
      fontWeight: 800,
      padding: "10px 32px",
      borderRadius: 999,
      boxShadow: "0 0 40px rgba(163,230,53,0.45)"
    },
    found ? "WATCH LIVE ON " + host : host
  );

  let tree;

  if (found) {
    const compact = title.length > 0;
    const shownTitle = title.length > 36 ? title.slice(0, 35) + "..." : title;

    const children = [
      bgHalf(l1, "left"),
      bgHalf(l2, "right"),
      abs({ left: 0, top: 0, width: 1200, height: 630, background: "linear-gradient(180deg, rgba(12,15,13,0.36) 0%, rgba(12,15,13,0.84) 100%)" }),
      abs({ left: 420, top: 0, width: 360, height: 630, background: "linear-gradient(90deg, rgba(12,15,13,0) 0%, rgba(12,15,13,0.5) 50%, rgba(12,15,13,0) 100%)" }),
      teamCol(n1, l1, "left", compact),
      teamCol(n2, l2, "right", compact),
      abs(
        {
          left: 0,
          top: compact ? 195 : 190,
          width: 1200,
          height: 160,
          alignItems: "center",
          justifyContent: "center"
        },
        box(
          {
            fontFamily: "Racing Sans One",
            fontSize: 160,
            fontWeight: 400,
            letterSpacing: 6,
            color: "#F6FFB8",
            transform: "skewX(-12deg)",
            textShadow: "0 0 36px rgba(163,230,53,0.95)"
          },
          "VS"
        )
      ),
      abs({ left: 0, top: 26, width: 1200, justifyContent: "center" }, brand)
    ];

    if (compact) {
      children.push(
        abs(
          { left: 90, top: 92, width: 1020, alignItems: "center", justifyContent: "center" },
          [
            box({ flex: 1, height: 4, borderRadius: 4, background: "linear-gradient(90deg, rgba(163,230,53,0), #A3E635)" }),
            box(
              {
                justifyContent: "center",
                textAlign: "center",
                margin: "0 26px",
                color: "#FFFFFF",
                fontSize: shownTitle.length > 24 ? 46 : 58,
                fontWeight: 800,
                letterSpacing: 2,
                textTransform: "uppercase",
                textShadow: "0 4px 28px rgba(0,0,0,0.9)"
              },
              shownTitle
            ),
            box({ flex: 1, height: 4, borderRadius: 4, background: "linear-gradient(270deg, rgba(34,211,238,0), #22D3EE)" })
          ]
        )
      );
    }

    children.push(abs({ left: 0, bottom: 28, width: 1200, justifyContent: "center" }, footer));

    tree = box({ position: "relative", width: 1200, height: 630, background: "#0C0F0D" }, children);
  } else {
    tree = box(
      {
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "40px 60px",
        background: "linear-gradient(160deg, #1C231F 0%, #0C0F0D 65%)"
      },
      [
        brand,
        box(
          { alignItems: "center", justifyContent: "center", flex: 1, color: "#F4F6F4", fontSize: 72, fontWeight: 800 },
          "Live matches & watch links"
        ),
        footer
      ]
    );
  }

  const fonts = await Promise.all([interPromise, thunderPromise]);
  const options = {
    width: 1200,
    height: 630,
    headers: {
      "cache-control": found
        ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
        : "public, max-age=300, s-maxage=300"
    }
  };
  const list = [];
  if (fonts[0]) list.push({ name: "Inter", data: fonts[0], weight: 800, style: "normal" });
  if (fonts[1]) list.push({ name: "Racing Sans One", data: fonts[1], weight: 400, style: "normal" });
  if (list.length) options.fonts = list;

  return new ImageResponse(tree, options);
}