import sharp from "sharp";
import fs from "fs";
import path from "path";

const OUT = path.resolve("public");
const LOGO_SVG = fs.readFileSync(path.resolve("public/logo.svg"), "utf-8");

// Brand colors
const CREAM = "#FCF8EC";
const BLUE = "#5071FE";
const INK = "#1a1a1a";
const INK_LIGHT = "#666";

// OG image size
const W = 1200;
const H = 630;

// Scattered photo card placeholders (the "cards on table" feel)
function scatteredCards(colors) {
  return colors
    .map(
      (c, i) => `
    <rect
      x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}"
      rx="16" ry="16"
      fill="${c.fill}"
      transform="rotate(${c.rot} ${c.x + c.w / 2} ${c.y + c.h / 2})"
      opacity="0.9"
    />
    <rect
      x="${c.x + 4}" y="${c.y + 4}" width="${c.w - 8}" height="${c.h - 8}"
      rx="12" ry="12"
      fill="${CREAM}"
      transform="rotate(${c.rot} ${c.x + c.w / 2} ${c.y + c.h / 2})"
      opacity="0.15"
    />`
    )
    .join("");
}

const defaultCards = [
  { x: 40, y: 60, w: 160, h: 200, rot: -8, fill: "#E8B4A0" },
  { x: 170, y: 140, w: 140, h: 175, rot: 5, fill: "#9DB4C0" },
  { x: 50, y: 280, w: 130, h: 165, rot: 3, fill: "#C4A882" },
  { x: 200, y: 350, w: 150, h: 185, rot: -4, fill: "#B8C9A3" },
  { x: 880, y: 50, w: 155, h: 190, rot: 6, fill: "#D4A574" },
  { x: 1000, y: 180, w: 140, h: 175, rot: -5, fill: "#A8B8D0" },
  { x: 920, y: 370, w: 145, h: 180, rot: 4, fill: "#C9B8A0" },
  { x: 1050, y: 30, w: 120, h: 150, rot: -3, fill: "#D0C4B0" },
];

// Extract logo paths from the SVG (just the icon + text paths)
// We'll embed the logo SVG directly, scaled and positioned
function logoSvg(x, y, scale) {
  return `<g transform="translate(${x}, ${y}) scale(${scale})">${LOGO_SVG.replace(/<\?xml[^?]*\?>/, "")
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<title>[^<]*<\/title>/, "")
    .replace(/<desc>[^<]*<\/desc>/, "")
    .replace(/<defs><\/defs>/, "")}</g>`;
}

function makeSvg({ subtitle, cards = defaultCards } = {}) {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${CREAM}" />

  ${scatteredCards(cards)}

  <!-- Logo centered -->
  ${logoSvg(W / 2 - 170, subtitle ? 80 : 115, 1)}

  ${
    subtitle
      ? `<text x="${W / 2}" y="440" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="32" font-weight="500" fill="${INK}">${subtitle}</text>
         <text x="${W / 2}" y="485" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="20" fill="${INK_LIGHT}">www.rvkfoodie.is</text>`
      : `<text x="${W / 2}" y="460" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="22" fill="${INK_LIGHT}">Insider food guides for Reykjavík</text>
         <text x="${W / 2}" y="495" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="18" fill="${INK_LIGHT}">www.rvkfoodie.is</text>`
  }
</svg>`;
}

const variants = [
  { name: "og-default.jpg", subtitle: null },
  { name: "og-food-guide.jpg", subtitle: "Reykjavík Food Guide — $15" },
  { name: "og-bar-crawl.jpg", subtitle: "Reykjavík Bar Crawl — $5" },
  { name: "og-golden-circle.jpg", subtitle: "Golden Circle Food Guide — $12" },
];

for (const { name, subtitle } of variants) {
  const svg = makeSvg({ subtitle });
  await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(path.join(OUT, name));
  console.log(`✓ ${name}`);
}
