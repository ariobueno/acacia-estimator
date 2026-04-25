// src/generatePdf.js
// Generates a full internal estimate PDF including photos

import jsPDF from 'jspdf';
import 'jspdf-autotable';

const BRAND = {
  dark: [26, 23, 20],       // #1a1714
  gold: [200, 168, 75],     // #c8a84b
  light: [247, 245, 240],   // #f7f5f0
  gray: [138, 122, 96],     // #8a7a60
  border: [232, 226, 216],  // #e8e2d8
};

function addPageHeader(doc, pageNum, totalPages) {
  doc.setFillColor(...BRAND.dark);
  doc.rect(0, 0, 210, 18, 'F');
  doc.setTextColor(...BRAND.gold);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('ACACIA KITCHEN CABINETS', 14, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(160, 150, 130);
  doc.text(`Page ${pageNum} of ${totalPages}`, 196, 11, { align: 'right' });
}

function addPageFooter(doc) {
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.gray);
  doc.text('INTERNAL USE ONLY — ACACIA CABINETS ESTIMATE', 105, 290, { align: 'center' });
  doc.setDrawColor(...BRAND.border);
  doc.line(14, 287, 196, 287);
}

export async function generateEstimatePdf(job, clientOut, internalOut, renders) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210, marginL = 14, marginR = 196, contentW = marginR - marginL;
  let y = 26;

  // ── Cover / Header ─────────────────────────────────────────────────────────
  addPageHeader(doc, 1, '?');

  // Gold accent bar
  doc.setFillColor(...BRAND.gold);
  doc.rect(marginL, y, contentW, 1, 'F');
  y += 8;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND.dark);
  doc.text('INTERNAL ESTIMATE', marginL, y);
  y += 7;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BRAND.gray);
  doc.text(job.clientName || '—', marginL, y);
  y += 5;
  doc.setFontSize(9);
  doc.text(job.address || '—', marginL, y);
  y += 5;
  doc.text(`Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, marginL, y);
  y += 5;
  doc.text(`Job type: ${job.jobType === 'multi' ? 'Multi-unit / Developer' : 'Single Residential'}`, marginL, y);
  y += 10;

  doc.setFillColor(...BRAND.gold);
  doc.rect(marginL, y, contentW, 0.5, 'F');
  y += 8;

  // ── Internal Breakdown ────────────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND.dark);
  doc.text('COST BREAKDOWN', marginL, y);
  y += 6;

  // Split internal text into lines and render
  const lines = internalOut.split('\n');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 55, 50);

  for (const line of lines) {
    if (y > 275) {
      addPageFooter(doc);
      doc.addPage();
      addPageHeader(doc, doc.internal.getNumberOfPages(), '?');
      y = 26;
    }
    const isBold = line.startsWith('═') || line.startsWith('▶') || line.startsWith('RAW') || line.startsWith('+15') || line.startsWith('GRAND') || line.startsWith('CABINET');
    const isGold = line.startsWith('RAW') || line.startsWith('+15') || line.startsWith('GRAND') || line.startsWith('PROPOSAL');
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setTextColor(...(isGold ? BRAND.gold : isBold ? BRAND.dark : [80, 75, 68]));
    if (line.startsWith('─') || line.startsWith('═')) {
      doc.setDrawColor(...BRAND.border);
      doc.line(marginL, y - 1, marginR, y - 1);
    } else {
      doc.text(line, marginL, y, { maxWidth: contentW });
    }
    y += 4;
  }

  y += 6;

  // ── Client Proposal ───────────────────────────────────────────────────────
  if (y > 240) {
    addPageFooter(doc);
    doc.addPage();
    addPageHeader(doc, doc.internal.getNumberOfPages(), '?');
    y = 26;
  }

  doc.setFillColor(...BRAND.gold);
  doc.rect(marginL, y, contentW, 0.5, 'F');
  y += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND.dark);
  doc.text('CLIENT PROPOSAL', marginL, y);
  y += 6;

  const proposalLines = clientOut.split('\n');
  doc.setFontSize(8);
  for (const line of proposalLines) {
    if (y > 275) {
      addPageFooter(doc);
      doc.addPage();
      addPageHeader(doc, doc.internal.getNumberOfPages(), '?');
      y = 26;
    }
    const isBold = line.startsWith('TOTAL') || line.startsWith('PROPOSAL') || line.startsWith('UNIT TYPE');
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setTextColor(...(isBold ? BRAND.gold : [80, 75, 68]));
    if (line.startsWith('─')) {
      doc.setDrawColor(...BRAND.border);
      doc.line(marginL, y - 1, marginR, y - 1);
    } else {
      doc.text(line, marginL, y, { maxWidth: contentW });
    }
    y += 4;
  }

  // ── Room Photos ───────────────────────────────────────────────────────────
  const allPhotos = [];
  if (job.jobType === 'single') {
    (job.rooms || []).forEach(r => {
      (r.photos || []).forEach(p => {
        const name = r.type === 'Other' ? (r.customType || 'Room') : (r.type || 'Room');
        allPhotos.push({ roomName: name, dataUrl: p.dataUrl });
      });
    });
  } else {
    (job.units || []).forEach(u => {
      (u.rooms || []).forEach(r => {
        (r.photos || []).forEach(p => {
          const name = `${u.name || 'Unit'} – ${r.type === 'Other' ? (r.customType || 'Room') : (r.type || 'Room')}`;
          allPhotos.push({ roomName: name, dataUrl: p.dataUrl });
        });
      });
    });
  }

  if (allPhotos.length > 0) {
    addPageFooter(doc);
    doc.addPage();
    addPageHeader(doc, doc.internal.getNumberOfPages(), '?');
    y = 26;

    doc.setFillColor(...BRAND.gold);
    doc.rect(marginL, y, contentW, 0.5, 'F');
    y += 6;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND.dark);
    doc.text('SITE PHOTOS', marginL, y);
    y += 8;

    const imgW = 85, imgH = 64, gap = 8;
    let col = 0;

    for (const photo of allPhotos) {
      if (y + imgH > 275) {
        addPageFooter(doc);
        doc.addPage();
        addPageHeader(doc, doc.internal.getNumberOfPages(), '?');
        y = 26;
        col = 0;
      }

      const x = marginL + col * (imgW + gap);

      try {
        const format = photo.dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(photo.dataUrl, format, x, y, imgW, imgH, undefined, 'MEDIUM');
        doc.setDrawColor(...BRAND.border);
        doc.rect(x, y, imgW, imgH);
      } catch (e) {
        doc.setFillColor(...BRAND.light);
        doc.rect(x, y, imgW, imgH, 'F');
        doc.setFontSize(8);
        doc.setTextColor(...BRAND.gray);
        doc.text('Photo unavailable', x + imgW / 2, y + imgH / 2, { align: 'center' });
      }

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...BRAND.gray);
      doc.text(photo.roomName, x + imgW / 2, y + imgH + 4, { align: 'center', maxWidth: imgW });

      col++;
      if (col >= 2) { col = 0; y += imgH + 14; }
    }
    if (col > 0) y += imgH + 14;
  }

  // ── AI Renders ─────────────────────────────────────────────────────────────
  const validRenders = (renders || []).filter(r => r.url);
  if (validRenders.length > 0) {
    addPageFooter(doc);
    doc.addPage();
    addPageHeader(doc, doc.internal.getNumberOfPages(), '?');
    y = 26;

    doc.setFillColor(...BRAND.gold);
    doc.rect(marginL, y, contentW, 0.5, 'F');
    y += 6;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND.dark);
    doc.text('AI DESIGN RENDERS', marginL, y);
    y += 8;

    for (const render of validRenders) {
      if (y + 100 > 275) {
        addPageFooter(doc);
        doc.addPage();
        addPageHeader(doc, doc.internal.getNumberOfPages(), '?');
        y = 26;
      }
      try {
        // Fetch render image and convert to base64
        const response = await fetch(render.url);
        const blob = await response.blob();
        const b64 = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        doc.addImage(b64, 'PNG', marginL, y, contentW, 95, undefined, 'MEDIUM');
        doc.setDrawColor(...BRAND.border);
        doc.rect(marginL, y, contentW, 95);
        y += 97;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...BRAND.gray);
        doc.text(`AI render — ${render.roomName}`, marginL, y);
        y += 10;
      } catch (e) {
        doc.setFontSize(8);
        doc.setTextColor(...BRAND.gray);
        doc.text(`Render for ${render.roomName} could not be embedded.`, marginL, y);
        y += 8;
      }
    }
  }

  // Fix page numbers now we know total
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc);
    // Rewrite header with correct total
    doc.setFillColor(...BRAND.dark);
    doc.rect(0, 0, 210, 18, 'F');
    doc.setTextColor(...BRAND.gold);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('ACACIA KITCHEN CABINETS', 14, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(160, 150, 130);
    doc.text(`Page ${i} of ${totalPages}`, 196, 11, { align: 'right' });
  }

  const fileName = `Acacia_Estimate_${(job.clientName || 'Client').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  return { pdfBase64: doc.output('datauristring').split(',')[1], fileName };
}
