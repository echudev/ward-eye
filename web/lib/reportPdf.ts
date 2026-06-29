/**
 * Genera y descarga el informe de coaching como PDF (texto vectorial,
 * títulos, viñetas, paginado y fecha). Solo se usa del lado del cliente:
 * jsPDF se importa dinámicamente dentro de la función.
 */

import type { CoachMeta } from "./types";

type Segment = { text: string; bold: boolean };

const RIOT_RED: [number, number, number] = [209, 54, 57]; // #D13639

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
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false });
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

  /** Texto con segmentos en negrita/normal, con wrap y salto de página. */
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
        if (/^\s+$/.test(w.text)) continue; // no arrancar línea con espacio
      }
      line.push(w);
      lineWidth += ww;
    }
    if (line.length) flush();
  };

  // ---- Encabezado ----
  doc.setTextColor(24, 24, 27);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("ward-eye", margin, y);
  y += 7;
  doc.setFontSize(13);
  doc.setTextColor(63, 63, 70);
  doc.text("Informe de coaching", margin, y);
  y += 4;

  // Acento Riot red bajo el título
  doc.setDrawColor(...RIOT_RED);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + 28, y);
  y += 7;

  // ---- Datos del jugador ----
  if (meta) {
    doc.setTextColor(39, 39, 42);
    if (meta.player) {
      drawRich(
        [
          { text: "Jugador: ", bold: true },
          {
            text: meta.region ? `${meta.player}  ·  ${meta.region}` : meta.player,
            bold: false,
          },
        ],
        margin,
        maxW,
        10,
        5,
      );
    }

    const profile: string[] = [];
    if (meta.mainRole) profile.push(`Rol principal: ${meta.mainRole}`);
    if (meta.winratePct != null) profile.push(`Winrate: ${meta.winratePct}%`);
    if (profile.length) {
      drawRich(
        [
          { text: "Perfil: ", bold: true },
          { text: profile.join("  ·  "), bold: false },
        ],
        margin,
        maxW,
        10,
        5,
      );
    }

    const total = meta.totalGames != null ? ` (de ${meta.totalGames} totales)` : "";
    drawRich(
      [
        { text: "Partidas analizadas: ", bold: true },
        {
          text: `${meta.analyzedGames}${total}  ·  ${fmtShortDate(meta.dateFrom)} a ${fmtShortDate(meta.dateTo)}`,
          bold: false,
        },
      ],
      margin,
      maxW,
      10,
      5,
    );
    y += 1;
  }

  // Generado / modelo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(120, 120, 128);
  doc.text(
    `Generado: ${fmtDate(generatedAt)}${model ? `    Modelo: ${toLatin1(model)}` : ""}`,
    margin,
    y,
  );
  y += 4;
  doc.setDrawColor(212, 212, 216);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ---- Cuerpo (parseo del Markdown) ----
  for (const raw of report.split("\n")) {
    const line = raw.trimEnd();

    if (/^#{1,3}\s/.test(line)) {
      const heading = line.replace(/^#{1,3}\s/, "");
      y += 3;
      ensureSpace(8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...RIOT_RED); // Riot red
      doc.text(toLatin1(heading), margin, y);
      y += 6;
      doc.setTextColor(39, 39, 42); // gris oscuro para el cuerpo
    } else if (/^\s*[-*]\s/.test(line)) {
      const content = line.replace(/^\s*[-*]\s/, "");
      ensureSpace(5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(39, 39, 42);
      doc.text("•", margin, y); // viñeta
      drawRich(tokenizeInline(content), margin + 5, maxW - 5, 10.5, 5);
    } else if (line === "") {
      y += 2.5;
    } else {
      doc.setTextColor(39, 39, 42);
      drawRich(tokenizeInline(line), margin, maxW, 10.5, 5);
    }
  }

  // ---- Pie con número de página ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 168);
    doc.text(`ward-eye · página ${i}/${pages}`, pageW - margin, pageH - 8, {
      align: "right",
    });
  }

  const fileDate = generatedAt.toISOString().slice(0, 10);
  doc.save(`ward-eye-coaching-${fileDate}.pdf`);
}
