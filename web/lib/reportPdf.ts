/**
 * Genera y descarga el informe de coaching como PDF en tema claro:
 * fondo blanco, títulos en oscuro con línea turquesa, cuerpo en gris oscuro. Texto vectorial,
 * viñetas, paginado y fecha. Solo se usa en el cliente: jsPDF se importa
 * dinámicamente dentro de la función.
 */

import type { CoachMeta } from "./types";

type Segment = { text: string; bold: boolean };
type RGB = [number, number, number];

const C: Record<string, RGB> = {
  text: [39, 39, 42], // gris casi negro (cuerpo)
  primary: [76, 215, 179], // #4CD7B3 (turquesa)
  secondary: [184, 122, 179], // #B87AB3 (malva)
  accent: [76, 215, 179], // primario (líneas/viñetas)
  label: [184, 122, 179], // secundario (etiquetas)
  muted: [115, 115, 122], // gris (metadatos)
  rule: [214, 214, 219], // gris claro (divisores)
};

/** jsPDF usa la codificación WinAnsi (Latin-1): normalizamos lo que no entra. */
function toLatin1(s: string): string {
  return s
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/→/g, "->")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x00-\xFF]/g, "");
}

/** Divide una línea en segmentos según `**negrita**`. */
function tokenizeInline(text: string): Segment[] {
  const out: Segment[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last)
      out.push({ text: text.slice(last, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false });
  return out;
}

function fmtDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtShortDate(iso: string | null): string {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}

export async function downloadReportPdf({
  report,
  model,
  meta = null,
  generatedAt = new Date(),
}: {
  report: string;
  model: string | null;
  meta?: CoachMeta | null;
  generatedAt?: Date;
}): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  /** Texto con segmentos en negrita/normal (color actual), wrap y salto de página. */
  const drawRich = (
    segments: Segment[],
    x: number,
    width: number,
    fontSize: number,
    lineHeight: number,
  ) => {
    doc.setFontSize(fontSize);
    const words: Segment[] = [];
    for (const seg of segments) {
      for (const part of toLatin1(seg.text).split(/(\s+)/)) {
        if (part.length) words.push({ text: part, bold: seg.bold });
      }
    }

    let line: Segment[] = [];
    let lineWidth = 0;
    const flush = () => {
      ensureSpace(lineHeight);
      let cx = x;
      for (const w of line) {
        doc.setFont("helvetica", w.bold ? "bold" : "normal");
        doc.text(w.text, cx, y);
        cx += doc.getTextWidth(w.text);
      }
      y += lineHeight;
      line = [];
      lineWidth = 0;
    };

    for (const w of words) {
      doc.setFont("helvetica", w.bold ? "bold" : "normal");
      const ww = doc.getTextWidth(w.text);
      if (lineWidth + ww > width && line.length) {
        flush();
        if (/^\s+$/.test(w.text)) continue;
      }
      line.push(w);
      lineWidth += ww;
    }
    if (line.length) flush();
  };

  /** Línea "Etiqueta: valor" con etiqueta en verde y valor en gris oscuro. */
  const drawKeyValue = (label: string, value: string) => {
    ensureSpace(5);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.label);
    doc.text(label, margin, y);
    const lw = doc.getTextWidth(label);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.text);
    doc.text(toLatin1(value), margin + lw, y);
    y += 5;
  };

  // ---- Encabezado ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...C.text);
  doc.text("ward-eye", margin, y + 1);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...C.muted);
  doc.text("Informe de coaching", margin, y);
  y += 4;

  // Acento turquesa bajo el título
  doc.setDrawColor(...C.accent);
  doc.setLineWidth(0.9);
  doc.line(margin, y, margin + 30, y);
  y += 7;

  // ---- Datos del jugador ----
  if (meta) {
    if (meta.player) {
      drawKeyValue(
        "Jugador:  ",
        meta.region ? `${meta.player}   ·   ${meta.region}` : meta.player,
      );
    }
    const profile: string[] = [];
    if (meta.mainRole) profile.push(`Rol principal: ${meta.mainRole}`);
    if (meta.winratePct != null) profile.push(`Winrate: ${meta.winratePct}%`);
    if (profile.length) drawKeyValue("Perfil:  ", profile.join("   ·   "));

    const total =
      meta.totalGames != null ? ` (de ${meta.totalGames} totales)` : "";
    drawKeyValue(
      "Partidas analizadas:  ",
      `${meta.analyzedGames}${total}   ·   ${fmtShortDate(meta.dateFrom)} a ${fmtShortDate(meta.dateTo)}`,
    );
    y += 1;
  }

  // Generado / modelo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.muted);
  doc.text(
    `Generado: ${fmtDate(generatedAt)}${model ? `    Modelo: ${toLatin1(model)}` : ""}`,
    margin,
    y,
  );
  y += 4;

  // Divisor
  doc.setDrawColor(...C.rule);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ---- Cuerpo (parseo del Markdown) ----
  for (const raw of report.split("\n")) {
    const line = raw.trimEnd();

    if (/^#{1,3}\s/.test(line)) {
      const heading = toLatin1(line.replace(/^#{1,3}\s/, ""));
      y += 5;
      ensureSpace(9);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...C.text); // título en oscuro
      doc.text(heading, margin, y);
      const tw = doc.getTextWidth(heading);
      y += 1.8;
      // línea turquesa debajo del título (igual que en el encabezado)
      doc.setDrawColor(...C.primary);
      doc.setLineWidth(0.7);
      doc.line(margin, y, margin + tw, y);
      y += 5;
    } else if (/^\s*[-*]\s/.test(line)) {
      const content = line.replace(/^\s*[-*]\s/, "");
      ensureSpace(5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...C.accent);
      doc.text("•", margin, y); // viñeta turquesa
      doc.setTextColor(...C.text);
      drawRich(tokenizeInline(content), margin + 5, maxW - 5, 10.5, 5);
    } else if (line === "") {
      y += 2.5;
    } else {
      doc.setTextColor(...C.text);
      drawRich(tokenizeInline(line), margin, maxW, 10.5, 5);
    }
  }

  // ---- Pie con número de página ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.rule);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text("ward-eye · analytics & coaching", margin, pageH - 8);
    doc.text(`página ${i}/${pages}`, pageW - margin, pageH - 8, {
      align: "right",
    });
  }

  const fileDate = generatedAt.toISOString().slice(0, 10);
  doc.save(`ward-eye-coaching-${fileDate}.pdf`);
}
