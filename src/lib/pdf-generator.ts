import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DailyReport } from "@/types";

export interface PDFGenerationResult {
  fileName: string;
  blob: Blob;
  dataUrl: string;
  arrayBuffer: ArrayBuffer;
}

export function generateReportPDF(report: DailyReport): PDFGenerationResult {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let currentY = margin;

  // Kolory firmowe SB Technology / SolutionsBay
  const primaryNavy: [number, number, number] = [15, 23, 42]; // #0f172a
  const accentTeal: [number, number, number] = [14, 165, 233]; // #0ea5e9
  const slateGray: [number, number, number] = [100, 116, 139]; // #64748b
  const lightBg: [number, number, number] = [248, 250, 252]; // #f8fafc

  // --- NAGŁÓWEK DOKUMENTU ---
  // Pasek boczny akcentu
  doc.setFillColor(...primaryNavy);
  doc.rect(margin, currentY, pageWidth - margin * 2, 24, "F");

  // Logo / Tekst Firmowy "SB Technology"
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("SB TECHNOLOGY", margin + 6, currentY + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text("SYSTEM RYCOS SHIFT | SOLUTIONSBAY", margin + 6, currentY + 16);

  // Tytuł raportu po prawej stronie nagłówka
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  const reportTypeName =
    report.reportType === "START_SHIFT"
      ? "ROZPOCZĘCIE PRAC ZESPOŁU"
      : "ZAKOŃCZENIE PRAC ZESPOŁU";
  doc.text(reportTypeName, pageWidth - margin - 6, currentY + 11, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(186, 230, 253);
  doc.text(`Data: ${report.date} | Godz: ${report.time}`, pageWidth - margin - 6, currentY + 17, {
    align: "right",
  });

  currentY += 30;

  // --- KARTA INFORMACJI O PLACU I BRYGADZIE ---
  doc.setFillColor(...lightBg);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 2, 2, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...primaryNavy);
  doc.text("Plac Budowy:", margin + 5, currentY + 7);
  doc.text("Brygadzista:", margin + 5, currentY + 15);
  doc.text("Lokalizacja GPS:", margin + 5, currentY + 23);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(report.siteName || "Nie wybrano", margin + 40, currentY + 7);
  doc.text(report.foremanName || "Nie wybrano", margin + 40, currentY + 15);

  const lat = report.location?.latitude?.toFixed(6) ?? "N/A";
  const lng = report.location?.longitude?.toFixed(6) ?? "N/A";
  const acc = report.location?.accuracy ? `(±${Math.round(report.location.accuracy)}m)` : "";
  const gpsText = `${lat}, ${lng} ${acc}`;
  doc.text(gpsText, margin + 40, currentY + 23);

  // Znacznik GPS / status
  doc.setFillColor(14, 165, 233);
  doc.circle(pageWidth - margin - 10, currentY + 14, 3, "F");
  doc.setFontSize(7);
  doc.setTextColor(...slateGray);
  doc.text("GPS OK", pageWidth - margin - 10, currentY + 21, { align: "center" });

  currentY += 36;

  // --- SEKCJA W ZALEŻNOŚCI OD TYPU RAPORTU ---

  if (report.reportType === "START_SHIFT") {
    // 1. OMAWIANE OBSZARY
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...primaryNavy);
    doc.text("1. Omawiane obszary (BHP / Zakres robót)", margin, currentY);
    currentY += 6;

    const topics = report.discussedTopics || [];
    if (topics.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...slateGray);
      doc.text("- Brak wprowadzonych obszarów", margin + 5, currentY);
      currentY += 8;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);

      topics.forEach((topic, idx) => {
        // Kontrola podziału linii
        const lines = doc.splitTextToSize(`${idx + 1}. ${topic}`, pageWidth - margin * 2 - 10);
        doc.text(lines, margin + 5, currentY);
        currentY += lines.length * 4.5 + 2;
      });
      currentY += 4;
    }

    // 2. LISTA OBECNOŚCI Z PODPISAMI
    currentY += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...primaryNavy);
    doc.text("2. Lista obecności i podpisy pracowników", margin, currentY);
    currentY += 4;

    const attendees = report.attendanceList || [];
    const tableBody = attendees.map((att, index) => [
      index + 1,
      att.userName + (att.isForeman ? " (Brygadzista)" : ""),
      att.userRole || "-",
      att.signedAt ? att.signedAt.slice(11, 16) : "-",
      "", // Kolumna na podpis graficzny
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["Lp.", "Imię i Nazwisko", "Rola / Funkcja", "Godzina", "Podpis odręczny"]],
      body: tableBody,
      theme: "grid",
      headStyles: {
        fillColor: primaryNavy,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "left",
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: 30,
        minCellHeight: 14,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 55 },
        2: { cellWidth: 40 },
        3: { cellWidth: 20, halign: "center" },
        4: { cellWidth: 55, halign: "center" },
      },
      didDrawCell: (data) => {
        // Rysowanie grafiki podpisu w 5 kolumnie (index 4)
        if (data.section === "body" && data.column.index === 4) {
          const attendee = attendees[data.row.index];
          if (attendee && attendee.signatureDataUrl) {
            try {
              const cell = data.cell;
              const imgPadding = 1.5;
              const imgW = cell.width - imgPadding * 2;
              const imgH = cell.height - imgPadding * 2;
              doc.addImage(
                attendee.signatureDataUrl,
                "PNG",
                cell.x + imgPadding,
                cell.y + imgPadding,
                imgW,
                imgH,
                undefined,
                "FAST"
              );
            } catch {
              // Fallback jeśli obrazek podpisu jest uszkodzony
              doc.setFontSize(7);
              doc.setTextColor(100);
              doc.text("[Podpisano cyfrowo]", data.cell.x + 5, data.cell.y + 7);
            }
          }
        }
      },
      margin: { left: margin, right: margin },
    });

    const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    currentY = lastTable ? lastTable.finalY + 12 : currentY + 40;

  } else {
    // --- RAPORT ZAKOŃCZENIA PRAC (DOKUMENTACJA ZDJĘCIOWA) ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...primaryNavy);
    doc.text("1. Dokumentacja fotograficzna wykonanych robót", margin, currentY);
    currentY += 8;

    const photos = report.photoDocumentation || [];
    if (photos.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...slateGray);
      doc.text("- Brak załączonych fotografii", margin + 5, currentY);
      currentY += 12;
    } else {
      // Układ zdjęć (2 w rzędzie lub 1 duże)
      const photoWidth = (pageWidth - margin * 2 - 10) / 2;
      const photoHeight = 52;

      for (let i = 0; i < photos.length; i += 2) {
        // Sprawdź czy mieści się na stronie
        if (currentY + photoHeight + 25 > pageHeight - 25) {
          doc.addPage();
          currentY = margin + 10;
        }

        // Zdjęcie 1 (po lewej)
        const p1 = photos[i];
        try {
          doc.addImage(p1.photoDataUrl, "JPEG", margin, currentY, photoWidth, photoHeight, undefined, "FAST");
        } catch {
          doc.setFillColor(241, 245, 249);
          doc.rect(margin, currentY, photoWidth, photoHeight, "F");
          doc.text("[Zdjęcie]", margin + photoWidth / 2 - 10, currentY + photoHeight / 2);
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...primaryNavy);
        doc.text(`Zdjęcie ${i + 1}:`, margin, currentY + photoHeight + 4);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(51, 65, 85);
        const desc1Lines = doc.splitTextToSize(p1.description || "Brak opisu", photoWidth);
        doc.text(desc1Lines, margin, currentY + photoHeight + 8);

        // Zdjęcie 2 (po prawej, jeśli istnieje)
        if (i + 1 < photos.length) {
          const p2 = photos[i + 1];
          const rightX = margin + photoWidth + 10;
          try {
            doc.addImage(p2.photoDataUrl, "JPEG", rightX, currentY, photoWidth, photoHeight, undefined, "FAST");
          } catch {
            doc.setFillColor(241, 245, 249);
            doc.rect(rightX, currentY, photoWidth, photoHeight, "F");
            doc.text("[Zdjęcie]", rightX + photoWidth / 2 - 10, currentY + photoHeight / 2);
          }

          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(...primaryNavy);
          doc.text(`Zdjęcie ${i + 2}:`, rightX, currentY + photoHeight + 4);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(51, 65, 85);
          const desc2Lines = doc.splitTextToSize(p2.description || "Brak opisu", photoWidth);
          doc.text(desc2Lines, rightX, currentY + photoHeight + 8);
        }

        const maxDescLength = Math.max(
          doc.splitTextToSize(p1.description || "", photoWidth).length,
          i + 1 < photos.length ? doc.splitTextToSize(photos[i + 1].description || "", photoWidth).length : 0
        );

        currentY += photoHeight + 10 + maxDescLength * 3.5 + 8;
      }
    }
  }

  // --- ZAKOŃCZENIE RAPORTU (WYMÓG: [Koniec raportu]) ---
  if (currentY + 20 > pageHeight - 15) {
    doc.addPage();
    currentY = margin + 10;
  }

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...primaryNavy);
  doc.text("[Koniec raportu]", pageWidth / 2, currentY, { align: "center" });

  // --- STOPKA NA KAŻDEJ STRONIE ---
  const totalPages = (doc.internal.pages.length - 1) || 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...slateGray);
    doc.text(
      `RYCOS Shift | SB Technology Poznań | Wygenerowano: ${new Date().toLocaleString("pl-PL")}`,
      margin,
      pageHeight - 8
    );
    doc.text(`Strona ${i} z ${totalPages}`, pageWidth - margin, pageHeight - 8, {
      align: "right",
    });
  }

  // Generowanie nazwy pliku wg standardu: RRRR.MM.DD_Rozpoczęcie prac zespołu_nazwa placu budowy.pdf
  const dateFormatted = report.date.replace(/-/g, ".");
  const safeSiteName = (report.siteName || "Plac_Budowy").replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ _-]/g, "");
  const typeText =
    report.reportType === "START_SHIFT"
      ? "Rozpoczęcie prac zespołu"
      : "Zakończenie prac zespołu";
  const fileName = `${dateFormatted}_${typeText}_${safeSiteName}.pdf`;

  const blob = doc.output("blob");
  const dataUrl = doc.output("datauristring");
  const arrayBuffer = doc.output("arraybuffer");

  return {
    fileName,
    blob,
    dataUrl,
    arrayBuffer,
  };
}
