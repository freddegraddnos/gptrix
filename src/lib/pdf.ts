import { jsPDF } from "jspdf";
import type { SavedProject } from "@/hooks/useProjects";

const INK = "#0A0A0B";
const ACCENT = "#8A5BF2";
const MUTED = "#8A8F98";
const LINE = "#22262E";

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } catch {
    return null;
  }
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Generates a premium A4 PDF brief for a saved project and triggers download. */
export async function exportProjectPdf(project: SavedProject) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;

  // Background ink
  doc.setFillColor(INK);
  doc.rect(0, 0, W, H, "F");

  // Header band
  doc.setFillColor("#111318");
  doc.rect(0, 0, W, 28, "F");
  doc.setDrawColor(ACCENT);
  doc.setLineWidth(0.4);
  doc.line(16, 28, W - 16, 28);

  // Logo mark
  doc.setFillColor(ACCENT);
  doc.circle(22, 14, 3.2, "F");
  doc.setFillColor(INK);
  doc.circle(22, 14, 1.4, "F");

  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("INKSIMULATOR", 30, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text("Tattoo brief · 1:1 kalibrerad AR-placering", 30, 20);

  doc.setTextColor(MUTED);
  doc.setFontSize(8);
  doc.text(fmtDate(project.created_at), W - 16, 15, { align: "right" });
  doc.text(`ID · ${project.id.slice(0, 8).toUpperCase()}`, W - 16, 20, {
    align: "right",
  });

  // Title
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(project.name, 16, 46);

  if (project.tattoo_name) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(ACCENT);
    doc.text(project.tattoo_name.toUpperCase(), 16, 53);
  }

  // Preview
  const imgY = 62;
  const imgH = 130;
  doc.setDrawColor(LINE);
  doc.setFillColor("#0F1116");
  doc.roundedRect(16, imgY, W - 32, imgH, 3, 3, "FD");

  if (project.preview_url) {
    const img = await loadImage(project.preview_url);
    if (img) {
      const ratio = img.width / img.height;
      let w = W - 40;
      let h = w / ratio;
      if (h > imgH - 8) {
        h = imgH - 8;
        w = h * ratio;
      }
      const x = (W - w) / 2;
      const y = imgY + (imgH - h) / 2;
      doc.addImage(img, "PNG", x, y, w, h);
    }
  } else {
    doc.setTextColor(MUTED);
    doc.setFontSize(10);
    doc.text("Ingen preview", W / 2, imgY + imgH / 2, { align: "center" });
  }

  // Spec grid
  const specsY = imgY + imgH + 14;
  const specs = [
    { label: "Bredd", value: project.width_cm ? `${project.width_cm} cm` : "—" },
    { label: "Kroppsdel", value: project.body_part ?? "—" },
    { label: "Skala", value: "1:1 (kalibrerad)" },
    { label: "Format", value: "AR preview" },
  ];
  const colW = (W - 32) / specs.length;
  specs.forEach((s, i) => {
    const x = 16 + colW * i;
    doc.setTextColor(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(s.label.toUpperCase(), x, specsY);
    doc.setTextColor("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(s.value, x, specsY + 6);
  });

  doc.setDrawColor(LINE);
  doc.line(16, specsY + 12, W - 16, specsY + 12);

  // Notes
  const notesY = specsY + 22;
  doc.setTextColor(MUTED);
  doc.setFontSize(7);
  doc.text("BRIEF FOR THE TATTOOER", 16, notesY);
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const notes = [
    `Placering: ${project.body_part ?? "—"}.`,
    `Size: ${project.width_cm ? project.width_cm + " cm wide" : "to be confirmed"}.`,
    "Preview captured in AR mode with a calibrated coin reference for 1:1 scale.",
    "Use the image as a placement reference — proportions and position match the skin.",
  ];
  notes.forEach((t, i) => doc.text(t, 16, notesY + 6 + i * 5));

  // Footer
  doc.setDrawColor(LINE);
  doc.line(16, H - 22, W - 16, H - 22);
  doc.setTextColor(MUTED);
  doc.setFontSize(7);
  doc.text("Created with InkSimulator · inksimulator.com", 16, H - 14);
  doc.text("Confidential · for the tattooer only", W - 16, H - 14, {
    align: "right",
  });

  doc.save(`${project.name.replace(/[^a-z0-9-_ ]/gi, "").trim() || "inkvision"}.pdf`);
}

/** Lightweight brief for a booking (no full project required). */
export async function generateTattooPDF(input: {
  title: string;
  motifName?: string;
  widthCm?: number;
  bodyPart?: string;
  previewUrl?: string;
  studio?: string;
  note?: string;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  doc.setFillColor(INK);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor("#111318");
  doc.rect(0, 0, W, 28, "F");
  doc.setDrawColor(ACCENT);
  doc.setLineWidth(0.4);
  doc.line(16, 28, W - 16, 28);
  doc.setFillColor(ACCENT);
  doc.circle(22, 14, 3.2, "F");
  doc.setFillColor(INK);
  doc.circle(22, 14, 1.4, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("INKSIMULATOR", 30, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text("Booking brief · till din tatuerare", 30, 20);
  doc.text(fmtDate(new Date().toISOString()), W - 16, 15, { align: "right" });

  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(input.title, 16, 46);
  if (input.motifName) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(ACCENT);
    doc.text(input.motifName.toUpperCase(), 16, 53);
  }

  const imgY = 62;
  const imgH = 120;
  doc.setDrawColor(LINE);
  doc.setFillColor("#0F1116");
  doc.roundedRect(16, imgY, W - 32, imgH, 3, 3, "FD");
  if (input.previewUrl) {
    const img = await loadImage(input.previewUrl);
    if (img) {
      const ratio = img.width / img.height;
      let w = W - 40;
      let h = w / ratio;
      if (h > imgH - 8) {
        h = imgH - 8;
        w = h * ratio;
      }
      doc.addImage(img, "PNG", (W - w) / 2, imgY + (imgH - h) / 2, w, h);
    }
  } else {
    doc.setTextColor(MUTED);
    doc.setFontSize(10);
    doc.text("Ingen preview", W / 2, imgY + imgH / 2, { align: "center" });
  }

  const specsY = imgY + imgH + 14;
  const specs = [
    { label: "Bredd", value: input.widthCm ? `${input.widthCm} cm` : "—" },
    { label: "Kroppsdel", value: input.bodyPart ?? "—" },
    { label: "Studio", value: input.studio ? "Bokad" : "—" },
  ];
  const colW = (W - 32) / specs.length;
  specs.forEach((s, i) => {
    const x = 16 + colW * i;
    doc.setTextColor(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(s.label.toUpperCase(), x, specsY);
    doc.setTextColor("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(s.value, x, specsY + 6);
  });
  doc.setDrawColor(LINE);
  doc.line(16, specsY + 12, W - 16, specsY + 12);

  if (input.studio) {
    doc.setTextColor(MUTED);
    doc.setFontSize(7);
    doc.text("STUDIO", 16, specsY + 22);
    doc.setTextColor("#FFFFFF");
    doc.setFontSize(10);
    doc.text(input.studio, 16, specsY + 28);
  }
  if (input.note) {
    doc.setTextColor(MUTED);
    doc.setFontSize(7);
    doc.text("NOTERINGAR", 16, specsY + 40);
    doc.setTextColor("#FFFFFF");
    doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(input.note, W - 32);
    doc.text(wrapped, 16, specsY + 46);
  }

  doc.setDrawColor(LINE);
  doc.line(16, H - 22, W - 16, H - 22);
  doc.setTextColor(MUTED);
  doc.setFontSize(7);
  doc.text("Created with InkSimulator · inksimulator.com", 16, H - 14);

  doc.save(`booking-${Date.now()}.pdf`);
}

/** Full projektdossier: metadata, anteckningar, referens- och kroppsbilder. */
export async function exportProjectDossierPdf(input: {
  name: string;
  createdAt: string;
  bodyPart?: string | null;
  widthCm?: number | null;
  placementNote?: string | null;
  notes?: string | null;
  artistName?: string | null;
  bookingStatus?: string | null;
  coverUrl?: string | null;
  assets: { kind: string; title: string | null; image_url: string }[];
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;

  const page = () => {
    doc.setFillColor(INK);
    doc.rect(0, 0, W, H, "F");
    doc.setFillColor("#111318");
    doc.rect(0, 0, W, 24, "F");
    doc.setDrawColor(ACCENT);
    doc.setLineWidth(0.4);
    doc.line(16, 24, W - 16, 24);
    doc.setFillColor(ACCENT);
    doc.circle(22, 12, 3, "F");
    doc.setTextColor("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("INKSIMULATOR", 30, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    doc.text("Projektdossier", 30, 18);
  };

  page();
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(input.name, 16, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text(`Skapat ${fmtDate(input.createdAt)}`, 16, 49);

  const cover = input.coverUrl ? await loadImage(input.coverUrl) : null;
  let y = 58;
  if (cover) {
    const w = W - 32;
    const h = Math.min(110, (cover.height / cover.width) * w);
    doc.addImage(cover, "PNG", 16, y, w, h);
    y += h + 8;
  }

  const rows: [string, string][] = [
    ["Kroppsdel", input.bodyPart || "—"],
    ["Storlek", input.widthCm ? `${Number(input.widthCm).toFixed(1)} cm` : "—"],
    ["Placering", input.placementNote || "—"],
    ["Artist", input.artistName || "—"],
    ["Bokningsstatus", input.bookingStatus || "—"],
  ];
  rows.forEach(([k, v]) => {
    doc.setTextColor(MUTED);
    doc.setFontSize(7);
    doc.text(k.toUpperCase(), 16, y);
    doc.setTextColor("#FFFFFF");
    doc.setFontSize(10);
    doc.text(String(v), 70, y);
    doc.setDrawColor(LINE);
    doc.line(16, y + 3, W - 16, y + 3);
    y += 11;
  });

  if (input.notes) {
    y += 4;
    doc.setTextColor(MUTED);
    doc.setFontSize(7);
    doc.text("ANTECKNINGAR", 16, y);
    doc.setTextColor("#FFFFFF");
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(input.notes, W - 32), 16, y + 6);
  }

  const images = input.assets.slice(0, 12);
  if (images.length) {
    doc.addPage();
    page();
    doc.setTextColor("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Bilagor", 16, 40);
    doc.setFont("helvetica", "normal");
    let gx = 16;
    let gy = 48;
    const cw = (W - 32 - 8) / 2;
    for (const a of images) {
      const img = await loadImage(a.image_url);
      if (!img) continue;
      const ih = Math.min(60, (img.height / img.width) * cw);
      if (gy + ih > H - 26) {
        doc.addPage();
        page();
        gx = 16;
        gy = 40;
      }
      doc.addImage(img, "PNG", gx, gy, cw, ih);
      doc.setTextColor(MUTED);
      doc.setFontSize(7);
      doc.text(a.title || a.kind, gx, gy + ih + 4);
      if (gx === 16) {
        gx = 16 + cw + 8;
      } else {
        gx = 16;
        gy += ih + 12;
      }
    }
  }

  doc.save(
    `${input.name.replace(/[^a-z0-9-_ ]/gi, "").trim() || "inkvision"}-projekt.pdf`,
  );
}
