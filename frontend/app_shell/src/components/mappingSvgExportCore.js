import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";
import { resolveExportDpi } from "./mappingExportCore";

export const SVG_NS = "http://www.w3.org/2000/svg";

export function resolveSvgViewBoxSize(svgElement) {
  const viewBox = svgElement.viewBox?.baseVal;

  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return {
      width: viewBox.width,
      height: viewBox.height
    };
  }

  return {
    width: 240,
    height: 240
  };
}

export function resolveSvgDisplaySize(svgElement) {
  const bounds = svgElement.getBoundingClientRect();

  if (bounds.width > 0 && bounds.height > 0) {
    return {
      width: Math.round(bounds.width),
      height: Math.round(bounds.height)
    };
  }

  return resolveSvgViewBoxSize(svgElement);
}

export function parseCssNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveSvgExportDimensions(svgElement, settings, format) {
  const displaySize = resolveSvgDisplaySize(svgElement);

  if (format === "pdf") {
    return displaySize;
  }

  const dpi = resolveExportDpi(settings.dpi);
  const scale = dpi / 96;

  return {
    width: Math.max(1, Math.round(displaySize.width * scale)),
    height: Math.max(1, Math.round(displaySize.height * scale))
  };
}

function inlineSvgComputedStyles(sourceSvg, cloneSvg) {
  const sourceNodes = [sourceSvg, ...sourceSvg.querySelectorAll("*")];
  const cloneNodes = [cloneSvg, ...cloneSvg.querySelectorAll("*")];
  const styleProperties = [
    "fill",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-dasharray",
    "opacity",
    "font-size",
    "font-family",
    "font-weight",
    "font-style",
    "letter-spacing",
    "text-anchor",
    "alignment-baseline",
    "dominant-baseline"
  ];

  sourceNodes.forEach((sourceNode, index) => {
    const cloneNode = cloneNodes[index];

    if (!cloneNode) {
      return;
    }

    const computedStyle = window.getComputedStyle(sourceNode);

    styleProperties.forEach((property) => {
      const value = computedStyle.getPropertyValue(property);

      if (value) {
        cloneNode.setAttribute(property, value);
      }
    });
  });
}

export function cloneSvgForExport(svgElement, width, height) {
  const clone = svgElement.cloneNode(true);
  const background = document.createElementNS(SVG_NS, "rect");
  const viewBoxSize = resolveSvgViewBoxSize(svgElement);

  inlineSvgComputedStyles(svgElement, clone);
  clone.setAttribute("xmlns", SVG_NS);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute(
    "viewBox",
    svgElement.getAttribute("viewBox") || `0 0 ${viewBoxSize.width} ${viewBoxSize.height}`
  );
  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", String(viewBoxSize.width));
  background.setAttribute("height", String(viewBoxSize.height));
  background.setAttribute("fill", "#ffffff");
  clone.insertBefore(background, clone.firstChild);
  clone.querySelectorAll(".mapping-chart__segment").forEach((segment) => {
    segment.classList.remove("is-active");
    segment.style.setProperty("--segment-offset-x", "0px");
    segment.style.setProperty("--segment-offset-y", "0px");
  });

  return clone;
}

export async function renderSvgMarkupToPngBlob(svgMarkup, width, height) {
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const imageUrl = URL.createObjectURL(svgBlob);
  const image = new Image();

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = imageUrl;
    });

    const canvas = document.createElement("canvas");
    const outputWidth = Math.max(1, Math.round(width));
    const outputHeight = Math.max(1, Math.round(height));

    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, outputWidth, outputHeight);
    context.drawImage(image, 0, 0, outputWidth, outputHeight);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("PNG export blob creation failed."));
          return;
        }

        resolve(blob);
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export async function renderSvgCloneToPdfBlob(clone, width, height) {
  const pdf = new jsPDF({
    orientation: width >= height ? "landscape" : "portrait",
    unit: "px",
    format: [width, height],
    compress: true
  });

  pdf.setFont("helvetica", "normal");
  await svg2pdf(clone, pdf, { xOffset: 0, yOffset: 0, scale: 1 });

  return pdf.output("blob");
}
