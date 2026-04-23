import * as opentype from "opentype.js";
import openSansRegularUrl from "@fontsource/open-sans/files/open-sans-latin-400-normal.woff";
import openSansBoldUrl from "@fontsource/open-sans/files/open-sans-latin-700-normal.woff";
import { SVG_NS } from "./mappingSvgExportCore";

export const SYSTEM_FONT_STACK =
  "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";

const fontCache = new Map();

async function loadFont(url) {
  if (!fontCache.has(url)) {
    fontCache.set(
      url,
      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load font: ${url}`);
          }

          return response.arrayBuffer();
        })
        .then((buffer) => opentype.parse(buffer))
    );
  }

  return fontCache.get(url);
}

export function loadBoldFont() {
  return loadFont(openSansBoldUrl);
}

function normalizeFontWeight(fontWeight) {
  const value = String(fontWeight || "").trim().toLowerCase();

  if (value === "bold" || value === "bolder") {
    return "bold";
  }

  const numericWeight = Number.parseInt(value, 10);

  return Number.isFinite(numericWeight) && numericWeight >= 600 ? "bold" : "normal";
}

async function resolveFontForText(textNode) {
  const fontWeight =
    textNode.getAttribute("font-weight") || textNode.style.fontWeight || "400";

  return normalizeFontWeight(fontWeight) === "bold"
    ? loadFont(openSansBoldUrl)
    : loadFont(openSansRegularUrl);
}

function parseNumericAttribute(node, name, fallback) {
  const value =
    node.getAttribute(name) ||
    node.style?.[name] ||
    node.style?.getPropertyValue?.(name) ||
    fallback;
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseSvgLength(value, fontSize, fallback = 0) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseFloat(rawValue);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (/em$/i.test(rawValue)) {
    return parsed * fontSize;
  }

  return parsed;
}

function parseLengthAttribute(node, name, fontSize, fallback = 0) {
  const value =
    node.getAttribute(name) ||
    node.style?.[name] ||
    node.style?.getPropertyValue?.(name) ||
    "";

  return parseSvgLength(value, fontSize, fallback);
}

function resolveTextAnchor(textNode) {
  const anchor = (
    textNode.getAttribute("text-anchor") ||
    textNode.style.textAnchor ||
    "start"
  )
    .trim()
    .toLowerCase();

  return anchor === "middle" || anchor === "end" ? anchor : "start";
}

function resolveDominantBaselineShift(textNode, fontSize) {
  const baseline = (
    textNode.getAttribute("dominant-baseline") ||
    textNode.style.dominantBaseline ||
    textNode.style.getPropertyValue?.("dominant-baseline") ||
    ""
  )
    .trim()
    .toLowerCase();

  if (baseline === "middle" || baseline === "central") {
    return fontSize * 0.35;
  }

  if (baseline === "hanging" || baseline === "text-before-edge") {
    return fontSize * 0.82;
  }

  if (baseline === "text-after-edge") {
    return -fontSize * 0.18;
  }

  return 0;
}

function parseStyleAttribute(styleText) {
  return String(styleText || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((accumulator, entry) => {
      const splitIndex = entry.indexOf(":");

      if (splitIndex === -1) {
        return accumulator;
      }

      accumulator[entry.slice(0, splitIndex).trim()] = entry.slice(splitIndex + 1).trim();
      return accumulator;
    }, {});
}

function serializeStyleAttribute(styleMap) {
  return Object.entries(styleMap)
    .filter(([, value]) => value != null && String(value).trim() !== "")
    .map(([name, value]) => `${name}: ${value}`)
    .join("; ");
}

function resolvePdfTextFontFamily(value) {
  const family = String(value || "").toLowerCase();

  if (
    !family ||
    family === "inherit" ||
    family.includes("sans-serif") ||
    family.includes("system-ui") ||
    family.includes("segoe ui") ||
    family.includes("arial") ||
    family.includes("helvetica") ||
    family.includes("var(")
  ) {
    return "sans-serif";
  }

  return value || "sans-serif";
}

function normalizePdfTextFontWeight(value) {
  const normalized = String(value || "400").trim().toLowerCase();

  if (normalized === "bold" || normalized === "bolder") {
    return "700";
  }

  const numeric = Number.parseInt(normalized, 10);

  return Number.isFinite(numeric) && numeric >= 600 ? "700" : "400";
}

export function normalizePdfTextNodes(svgNode) {
  svgNode.querySelectorAll("text").forEach((node) => {
    const fontFamily = resolvePdfTextFontFamily(
      node.getAttribute("font-family") || node.style.fontFamily
    );
    const fontWeight = normalizePdfTextFontWeight(
      node.getAttribute("font-weight") || node.style.fontWeight
    );
    const styleMap = parseStyleAttribute(node.getAttribute("style"));

    node.setAttribute("font-family", fontFamily);
    node.setAttribute("font-weight", fontWeight);
    node.setAttribute("font-style", "normal");
    node.textContent = String(node.textContent || "").replace(/[\u2212\u2010\u2011\u2012\u2013\u2014]/g, "-");
    styleMap["font-family"] = fontFamily;
    styleMap["font-weight"] = fontWeight;
    styleMap["font-style"] = "normal";
    node.setAttribute("style", serializeStyleAttribute(styleMap));
  });
}

function copyTextPresentation(textNode, pathNode) {
  const fill =
    textNode.getAttribute("fill") ||
    textNode.style.fill ||
    textNode.style.getPropertyValue?.("fill") ||
    "#262d24";
  const opacity =
    textNode.getAttribute("opacity") ||
    textNode.style.opacity ||
    textNode.style.getPropertyValue?.("opacity") ||
    "";
  const transform =
    textNode.getAttribute("transform") ||
    textNode.style.transform ||
    textNode.style.getPropertyValue?.("transform") ||
    "";

  pathNode.setAttribute("fill", fill === "none" ? "#262d24" : fill);

  if (opacity) {
    pathNode.setAttribute("opacity", opacity);
  }

  if (transform && transform !== "none") {
    pathNode.setAttribute("transform", transform);
  }
}

async function convertTextNodeToPath(textNode) {
  const text = textNode.textContent || "";

  if (!text.trim()) {
    return;
  }

  const font = await resolveFontForText(textNode);
  const fontSize = parseNumericAttribute(textNode, "font-size", 16);
  const baseX =
    parseNumericAttribute(textNode, "x", 0) + parseLengthAttribute(textNode, "dx", fontSize, 0);
  const baseY =
    parseNumericAttribute(textNode, "y", 0) +
    parseLengthAttribute(textNode, "dy", fontSize, 0) +
    resolveDominantBaselineShift(textNode, fontSize);
  const anchor = resolveTextAnchor(textNode);
  const textWidth = font.getAdvanceWidth(text, fontSize);
  let drawX = baseX;

  if (anchor === "middle") {
    drawX -= textWidth / 2;
  } else if (anchor === "end") {
    drawX -= textWidth;
  }

  const path = font.getPath(text, drawX, baseY, fontSize);
  const pathNode = document.createElementNS(SVG_NS, "path");

  pathNode.setAttribute("d", path.toPathData(2));
  copyTextPresentation(textNode, pathNode);
  textNode.replaceWith(pathNode);
}

export async function convertSvgTextToPaths(svgNode) {
  const textNodes = [...svgNode.querySelectorAll("text")];

  for (const textNode of textNodes) {
    await convertTextNodeToPath(textNode);
  }
}

export function fitLegendFontSize(label, font, baseFontSize, maxWidth) {
  if (!font || !label) {
    return baseFontSize;
  }

  const targetWidth = Math.max(maxWidth, 24);
  const baseWidth = font.getAdvanceWidth(label, baseFontSize);

  if (baseWidth <= targetWidth) {
    return baseFontSize;
  }

  const scaledSize = (targetWidth / baseWidth) * baseFontSize;

  return Math.max(8.5, Math.min(baseFontSize, scaledSize));
}
