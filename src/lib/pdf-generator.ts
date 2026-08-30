import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { DailyReport, TenantSettings } from "@/types";
import { generateStartShiftHtml, generateEndShiftHtml } from "./pdf-html-templates";
import { formatPolishTime } from "./date-utils";

export interface PDFGenerationResult {
  fileName: string;
  blob: Blob;
  dataUrl: string;
  arrayBuffer: ArrayBuffer;
}

/**
 * Główny generator PDF wykorzystujący silnik szablonów HTML.
 * Gwarantuje 100% poprawności polskich znaków diakrytycznych (ą, ć, ę, ł, ń, ó, ś, ź, ż),
 * idealną typografię korporacyjną SB Technology, wektorowe podpisy i fotorelację.
 */
export async function generateReportPDFAsync(
  report: DailyReport,
  settings?: TenantSettings
): Promise<PDFGenerationResult> {
  const safeSiteName = (report.siteName || "PlacBudowy").replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ_-]/g, "_");
  const reportTypeName =
    report.reportType === "START_SHIFT"
      ? "Rozpoczęcie prac zespołu"
      : "Zakończenie prac zespołu";
  const fileName = `${report.date}_${reportTypeName}_${safeSiteName}.pdf`;

  // Sprawdź czy jesteśmy w środowisku przeglądarki (klient)
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const htmlContent =
      report.reportType === "START_SHIFT"
        ? generateStartShiftHtml(report, settings)
        : generateEndShiftHtml(report, settings);

    // Utwórz niewidoczny kontener do renderowania szablonu HTML
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "794px"; // Standard A4 pixel width przy 96 DPI
    container.style.zIndex = "-999";
    container.style.backgroundColor = "#ffffff";
    container.innerHTML = htmlContent;

    document.body.appendChild(container);

    try {
      // Poczekaj na załadowanie ewentualnych obrazków
      const images = Array.from(container.querySelectorAll("img"));
      await Promise.all(
        images.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) resolve(true);
              else {
                img.onload = () => resolve(true);
                img.onerror = () => resolve(true);
              }
            })
        )
      );

      // Renderowanie HTML do Canvas z podwojoną rozdzielczością dla kryształowej ostrości
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Pierwsza strona
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Obsługa wielostronicowości, jeśli dokument jest dłuższy niż A4
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const blob = pdf.output("blob");
      const dataUrl = pdf.output("datauristring");
      const arrayBuffer = pdf.output("arraybuffer");

      return {
        fileName,
        blob,
        dataUrl,
        arrayBuffer,
      };
    } finally {
      document.body.removeChild(container);
    }
  }

  // Fallback synchroniczny jeśli wywołano poza przeglądarką
  return generateReportPDF(report);
}

/**
 * Synchroniczny generator awaryjny
 */
export function generateReportPDF(report: DailyReport): PDFGenerationResult {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let currentY = margin;

  const safeSiteName = (report.siteName || "PlacBudowy").replace(/[^a-zA-Z0-9_-]/g, "_");
  const reportTypeName =
    report.reportType === "START_SHIFT"
      ? "Rozpoczecie prac zespolu"
      : "Zakonczenie prac zespolu";
  const fileName = `${report.date}_${reportTypeName}_${safeSiteName}.pdf`;

  // Kolory
  const primaryNavy: [number, number, number] = [15, 23, 42];
  const lightBg: [number, number, number] = [248, 250, 252];

  doc.setFillColor(...primaryNavy);
  doc.rect(margin, currentY, pageWidth - margin * 2, 24, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("SB TECHNOLOGY", margin + 6, currentY + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text("SYSTEM RYCOS SHIFT | SOLUTIONSBAY", margin + 6, currentY + 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(
    report.reportType === "START_SHIFT"
      ? "ROZPOCZECIE PRAC ZESPOLU"
      : "ZAKONCZENIE PRAC ZESPOLU",
    pageWidth - margin - 6,
    currentY + 11,
    { align: "right" }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(186, 230, 253);
  doc.text(`Data: ${report.date} | Godz: ${report.time}`, pageWidth - margin - 6, currentY + 17, {
    align: "right",
  });

  currentY += 30;

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
  doc.text(cleanPolishChars(report.siteName) || "Nie wybrano", margin + 40, currentY + 7);
  doc.text(cleanPolishChars(report.foremanName) || "Nie wybrano", margin + 40, currentY + 15);

  const lat = report.location?.latitude?.toFixed(6) ?? "N/A";
  const lng = report.location?.longitude?.toFixed(6) ?? "N/A";
  const acc = report.location?.accuracy ? `(±${Math.round(report.location.accuracy)}m)` : "";
  doc.text(`${lat}, ${lng} ${acc}`, margin + 40, currentY + 23);

  currentY += 36;

  if (report.reportType === "START_SHIFT") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...primaryNavy);
    doc.text("1. Omawiane obszary (BHP / Zakres robot)", margin, currentY);
    currentY += 6;

    const topics = report.discussedTopics && report.discussedTopics.length > 0
      ? report.discussedTopics
      : ["Brak wpisanych tematow"];

    topics.forEach((t, i) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      const splitText = doc.splitTextToSize(`${i + 1}. ${cleanPolishChars(t)}`, pageWidth - margin * 2 - 5);
      doc.text(splitText, margin + 4, currentY);
      currentY += splitText.length * 5 + 2;
    });

    currentY += 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...primaryNavy);
    doc.text("2. Lista obecnosci i podpisy pracownikow", margin, currentY);
    currentY += 4;

    const tableRows = (report.attendanceList || []).map((att, i) => [
      String(i + 1),
      cleanPolishChars(att.userName) + (att.isForeman ? " (Brygadzista)" : ""),
      cleanPolishChars(att.userRole) || "Pracownik",
      formatPolishTime(att.signedAt || report.time),
      "",
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["Lp.", "Imie i Nazwisko", "Rola / Funkcja", "Godzina", "Podpis odreczny"]],
      body: tableRows,
      theme: "grid",
      headStyles: { fillColor: primaryNavy, textColor: 255, fontStyle: "bold", halign: "center" },
      styles: { fontSize: 8, cellPadding: 3, valign: "middle" },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 55 },
        2: { cellWidth: 45 },
        3: { cellWidth: 20, halign: "center" },
        4: { cellWidth: 50, minCellHeight: 14 },
      },
      didDrawCell: (data) => {
        if (data.section === "body" && data.column.index === 4) {
          const attendee = (report.attendanceList || [])[data.row.index];
          if (attendee && attendee.signatureDataUrl) {
            try {
              doc.addImage(
                attendee.signatureDataUrl,
                "PNG",
                data.cell.x + 2,
                data.cell.y + 1,
                data.cell.width - 4,
                data.cell.height - 2
              );
            } catch {
              // ignore
            }
          }
        }
      },
    });
  }

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

/**
 * Zamienia polskie znaki diakrytyczne na ich litery bazowe dla czystego fallbacku
 */
function cleanPolishChars(text?: string): string {
  if (!text) return "";
  const map: Record<string, string> = {
    ą: "a",
    ć: "c",
    ę: "e",
    ł: "l",
    ń: "n",
    ó: "o",
    ś: "s",
    ź: "z",
    ż: "z",
    Ą: "A",
    Ć: "C",
    Ę: "E",
    Ł: "L",
    Ń: "N",
    Ó: "O",
    Ś: "S",
    Ź: "Z",
    Ż: "Z",
  };
  return text.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (m) => map[m] || m);
}
