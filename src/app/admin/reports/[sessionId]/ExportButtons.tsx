"use client";

import { useState } from "react";

interface DimensionScore {
  name: string;
  code: string;
  category: string;
  score: number;
  percentile: number;
}

interface Response {
  id: string;
  scenario: { sequenceOrder: number; narrativeText: string } | null;
  option: { optionCode: string; optionText: string } | null;
  timeSpentMs: number;
}

interface ExportButtonsProps {
  candidateName: string;
  candidateEmail: string;
  targetRole: string;
  packageName: string;
  overallScore: number;
  sessionId: string;
  status?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  candidateNotes?: string | null;
  dimensionScores: DimensionScore[];
  responses: Response[];
}

export default function ExportButtons({
  candidateName,
  candidateEmail,
  targetRole,
  packageName,
  overallScore,
  sessionId,
  status,
  startedAt,
  completedAt,
  candidateNotes,
  dimensionScores,
  responses,
}: ExportButtonsProps) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);

  /* ─── PDF ─────────────────────────────────────────────────── */
  async function downloadPDF() {
    setPdfLoading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 18;

      // ── Header bar ──────────────────────────────────────────
      doc.setFillColor(30, 58, 138); // blue-900
      doc.rect(0, 0, pageW, 40, "F");

      // Logo / Brand
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("Compass", margin, 20);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(191, 219, 254); // blue-200
      doc.text("EXECUTIVE ASSESSMENT INTELLIGENCE", margin, 26);

      // Report Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("CANDIDATE REPORT", pageW - margin, 20, { align: "right" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`, pageW - margin, 26, { align: "right" });

      // ── Candidate info Box ──────────────────────────────────────
      let y = 50;
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(margin, y, pageW - (margin * 2), 34, 3, 3, "FD");

      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(candidateName, margin + 6, y + 10);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(candidateEmail, margin + 6, y + 16);

      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.text("Target Role:", margin + 6, y + 23);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(targetRole || 'Not specified', margin + 28, y + 23);

      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.text("Package:", margin + 6, y + 28);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);

      // Truncate package name if it's very long
      let safePackageName = packageName;
      if (safePackageName.length > 50) safePackageName = safePackageName.substring(0, 47) + '...';
      doc.text(safePackageName, margin + 28, y + 28);

      // ── Overall score box (Top Right of Info Box) ───────────────────────────────────
      doc.setFillColor(37, 99, 235); // blue-600
      doc.roundedRect(pageW - margin - 35, y + 6, 30, 22, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text(String(overallScore), pageW - margin - 20, y + 19, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("OVERALL SCORE", pageW - margin - 20, y + 24, { align: "center" });

      y += 48;

      // ── Dimension Scores table ──────────────────────────────
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Cognitive Dimension Breakdown", margin, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["Dimension", "Category", "Score", "Rating"]],
        body: dimensionScores.map((d) => [
          d.name,
          d.category,
          `${d.score} / 100`,
          d.score >= 80 ? "Excellent" : d.score >= 60 ? "Good" : d.score >= 40 ? "Average" : "Needs Work",
        ]),
        theme: 'grid',
        headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 9, fontStyle: "bold", lineColor: [226, 232, 240], lineWidth: 0.1 },
        bodyStyles: { fontSize: 9, textColor: [51, 65, 85], lineColor: [226, 232, 240], lineWidth: 0.1 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 70 },
          2: { halign: "center", cellWidth: 25 },
          3: { halign: "center", cellWidth: 30, fontStyle: "bold" },
        },
        willDrawCell: (data) => {
          if (data.section === "body" && data.column.index === 3) {
            const score = dimensionScores[data.row.index]?.score ?? 0;
            if (score >= 80) data.cell.styles.textColor = [21, 128, 61]; // green-700
            else if (score >= 60) data.cell.styles.textColor = [29, 78, 216]; // blue-700
            else if (score >= 40) data.cell.styles.textColor = [180, 83, 9]; // amber-700
            else data.cell.styles.textColor = [185, 28, 28]; // red-700
          }
        },
      });

      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 15;

      // ── Response Log table ──────────────────────────────────
      if (responses.length > 0) {
        if (y > pageH - 40) { doc.addPage(); y = 20; }
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Candidate Response Log", margin, y);
        y += 6;

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["#", "Scenario Excerpt", "Selected Choice", "Time"]],
          body: responses.map((r) => [
            r.scenario?.sequenceOrder ?? "—",
            (r.scenario?.narrativeText ?? "—").substring(0, 80) + "…",
            `${r.option?.optionCode ?? "—"}: ${(r.option?.optionText ?? "").substring(0, 40)}…`,
            r.timeSpentMs ? `${Math.round(r.timeSpentMs / 1000)}s` : "—",
          ]),
          theme: 'grid',
          headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 8, fontStyle: "bold", lineColor: [226, 232, 240], lineWidth: 0.1 },
          bodyStyles: { fontSize: 8, textColor: [71, 85, 105], lineColor: [226, 232, 240], lineWidth: 0.1 },
          columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            1: { cellWidth: 80 },
            2: { cellWidth: 65 },
            3: { cellWidth: 15, halign: "center" },
          },
        });
      }

      // ── Footer on all pages ──────────────────────────────────
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Compass Platform  |  Page ${i} of ${totalPages}`, pageW / 2, pageH - 8, { align: "center" });
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
      }

      doc.save(`report-${candidateName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } catch (e) {
      console.error("PDF error", e);
      alert("PDF export failed. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  }

  async function downloadExcel() {
    setExcelLoading(true);
    try {
      const ExcelJSModule = await import('exceljs');
      const ExcelJS = ExcelJSModule.default || ExcelJSModule;
      
      // @ts-ignore
      const fileSaverModule = await import('file-saver');
      const saveAs = fileSaverModule.saveAs || (fileSaverModule as any).default?.saveAs || (fileSaverModule as any).default;

      // @ts-ignore
      const wb = new ExcelJS.Workbook();
      wb.creator = "Compass Intelligence";
      wb.created = new Date();

      // Style constants
      const navyHeaderFill: any = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // blue-900
      const subHeaderFill: any = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // navy-900
      const labelBgFill: any = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; // slate-50

      const borderThin: any = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };

      // ════════════════════════════════════════════════════════════════════
      // ── TAB 1: Assessment Summary & Dimension Scores ────────────────────
      // ════════════════════════════════════════════════════════════════════
      const wsSummary = wb.addWorksheet("Assessment Summary", {
        views: [{ showGridLines: true }]
      });

      wsSummary.columns = [
        { header: '', key: 'c1', width: 6 },
        { header: '', key: 'c2', width: 24 }, // wide enough for CONFLICT_RESOLUTION
        { header: '', key: 'c3', width: 34 },
        { header: '', key: 'c4', width: 26 },
        { header: '', key: 'c5', width: 18 },
        { header: '', key: 'c6', width: 18 },
        { header: '', key: 'c7', width: 26 }
      ];

      // Top Title Banner
      const titleRow = wsSummary.addRow(["COMPASS EXECUTIVE ASSESSMENT REPORT"]);
      titleRow.height = 28;
      wsSummary.mergeCells('A1:G1');
      titleRow.getCell(1).fill = navyHeaderFill;
      titleRow.getCell(1).font = { name: 'Segoe UI', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
      titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

      const subRow = wsSummary.addRow([`Executive Candidate Evaluation  |  Report Date: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`]);
      subRow.height = 18;
      wsSummary.mergeCells('A2:G2');
      // subRow background fill removed for clean appearance
      subRow.getCell(1).font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FFFFFFFF' } };
      subRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

      wsSummary.addRow([]); // Blank spacer

      // Profile Information Box (2 Columns of Key-Values across A-G)
      const addProfileHeader = wsSummary.addRow(["1. CANDIDATE PROFILE & ASSESSMENT OVERVIEW"]);
      addProfileHeader.height = 20;
      wsSummary.mergeCells(`A${addProfileHeader.number}:G${addProfileHeader.number}`);
      addProfileHeader.getCell(1).fill = subHeaderFill;
      addProfileHeader.getCell(1).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      addProfileHeader.getCell(1).border = borderThin;

      const addGridRow = (l1: string, v1: any, l2: string, v2: any, isScore = false) => {
        // Place text in the LEFTMOST cell of the intended merge range so it isn't erased during merge
        const row = wsSummary.addRow([l1, "", v1, "", l2, "", v2]);
        row.height = 20;

        // Merge labels and values
        wsSummary.mergeCells(`A${row.number}:B${row.number}`); // Label 1
        wsSummary.mergeCells(`C${row.number}:D${row.number}`); // Value 1
        wsSummary.mergeCells(`E${row.number}:F${row.number}`); // Label 2
        // G is single column for Value 2

        const cellL1 = row.getCell(1);
        const cellV1 = row.getCell(3);
        const cellL2 = row.getCell(5);
        const cellV2 = row.getCell(7);

        cellL1.fill = labelBgFill;
        cellL2.fill = labelBgFill;
        cellL1.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF475569' } };
        cellL2.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF475569' } };

        cellV1.font = isScore
          ? { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF2563EB' } }
          : { name: 'Segoe UI', size: 9.5, color: { argb: 'FF0F172A' } };
        cellV2.font = isScore
          ? { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF2563EB' } }
          : { name: 'Segoe UI', size: 9.5, color: { argb: 'FF0F172A' } };

        for (let i = 1; i <= 7; i++) {
          const cell = row.getCell(i);
          cell.border = borderThin;
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        }

        if (isScore) {
          cellV1.alignment = { vertical: 'middle', horizontal: 'left' };
          cellV2.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      };

      addGridRow("Candidate Name", candidateName, "Assessment Status", status || "COMPLETED");
      addGridRow("Email Address", candidateEmail, "Target Role", targetRole || "Not specified");
      addGridRow("Assessment Package", packageName, "Total Scenarios Completed", `${responses.length} Scenarios`);
      addGridRow(
        "Overall Cognitive Score",
        `${overallScore} / 100`,
        "Performance Band",
        overallScore >= 80 ? "Tier 1 - Executive Ready (Excellent)" : overallScore >= 60 ? "Tier 2 - Strong Contender (Good)" : overallScore >= 40 ? "Tier 3 - Developing (Average)" : "Tier 4 - Needs Work",
        true
      );
      if (candidateNotes) {
        addGridRow("Candidate Notes", candidateNotes, "Report Generated At", new Date().toLocaleString());
      }

      wsSummary.addRow([]); // Blank spacer

      // Dimension Scores Table Section
      const addDimHeader = wsSummary.addRow(["2. COGNITIVE DIMENSION BREAKDOWN (11-DIMENSION PROFILE)"]);
      addDimHeader.height = 20;
      wsSummary.mergeCells(`A${addDimHeader.number}:G${addDimHeader.number}`);
      addDimHeader.getCell(1).fill = subHeaderFill;
      addDimHeader.getCell(1).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      addDimHeader.getCell(1).border = borderThin;

      const dimTableHead = wsSummary.addRow(["#", "Code", "Dimension Name", "Category", "Score (/100)", "Percentile", "Rating"]);
      dimTableHead.height = 22;
      dimTableHead.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      dimTableHead.eachCell((cell, colNum) => {
        cell.fill = navyHeaderFill;
        cell.border = borderThin;
        cell.alignment = { vertical: 'middle', horizontal: (colNum === 1 || colNum === 2 || colNum >= 5) ? 'center' : 'left' };
      });

      dimensionScores.forEach((d, idx) => {
        const rating = d.score >= 80 ? "Excellent" : d.score >= 60 ? "Good" : d.score >= 40 ? "Average" : "Needs Work";
        const row = wsSummary.addRow([
          idx + 1,
          d.code,
          d.name,
          d.category,
          `${d.score} / 100`,
          `${d.percentile}%`,
          rating
        ]);
        row.height = 19;

        row.eachCell((cell, colNum) => {
          cell.border = borderThin;
          cell.alignment = { vertical: 'middle', horizontal: (colNum === 1 || colNum === 2 || colNum >= 5) ? 'center' : 'left' };

          if (colNum === 3) {
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1E293B' } };
          } else if (colNum === 5) {
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF0F172A' } };
          } else if (colNum === 7) {
            cell.font = { name: 'Segoe UI', size: 9, bold: true };
            if (d.score >= 80) cell.font.color = { argb: 'FF15803D' }; // Green
            else if (d.score >= 60) cell.font.color = { argb: 'FF1D4ED8' }; // Blue
            else if (d.score >= 40) cell.font.color = { argb: 'FFB45309' }; // Amber
            else cell.font.color = { argb: 'FFB91C1C' }; // Red
          } else {
            cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF334155' } };
          }
        });
      });

      // Average Dimension Score Summary Row
      const dimSummaryRow = wsSummary.addRow([
        "",
        "",
        "Average Cognitive Score",
        "Overall Dimension Mean",
        `${overallScore} / 100`,
        "—",
        overallScore >= 80 ? "Excellent" : overallScore >= 60 ? "Good" : overallScore >= 40 ? "Average" : "Needs Work"
      ]);
      dimSummaryRow.height = 21;
      dimSummaryRow.eachCell((cell, colNum) => {
        cell.border = borderThin;
        cell.fill = subHeaderFill;
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
        if (colNum === 1 || colNum === 2 || colNum >= 5) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      wsSummary.addRow([]); // Blank spacer

      // ════════════════════════════════════════════════════════════════════
      // ── TAB 2: Scenario Responses (Full Questions & Answers) ───────────
      // ════════════════════════════════════════════════════════════════════
      if (responses.length > 0) {
        const wsResp = wb.addWorksheet("Scenario Responses", {
          views: [{ showGridLines: true }]
        });

        wsResp.columns = [
          { header: "Scenario #", key: "num", width: 12 },
          { header: "Sequence", key: "seq", width: 12 },
          { header: "Crisis Scenario Narrative Context", key: "scen", width: 75 },
          { header: "Selected Choice", key: "code", width: 16 },
          { header: "Selected Decision Action", key: "ans", width: 55 },
          { header: "Decision Time (s)", key: "time", width: 18 },
          { header: "Decision Pace", key: "pace", width: 22 }
        ];

        const respHeadRow = wsResp.getRow(1);
        respHeadRow.height = 24;
        respHeadRow.fill = navyHeaderFill;
        respHeadRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        respHeadRow.alignment = { vertical: 'middle', horizontal: 'center' };

        responses.forEach((r, idx) => {
          const seconds = r.timeSpentMs ? Math.round(r.timeSpentMs / 1000) : 0;
          const speedPace = seconds === 0 ? "—" : seconds < 20 ? "Fast / Decisive (<20s)" : seconds <= 60 ? "Standard Pace (20-60s)" : "Deliberate (>60s)";

          const row = wsResp.addRow([
            idx + 1,
            r.scenario?.sequenceOrder ?? idx + 1,
            r.scenario?.narrativeText ?? "—",
            r.option?.optionCode ?? "—",
            r.option?.optionText ?? "—",
            seconds > 0 ? `${seconds}s` : "—",
            speedPace
          ]);

          row.eachCell((cell, colNum) => {
            cell.border = borderThin;
            cell.alignment = {
              vertical: 'top',
              horizontal: (colNum === 1 || colNum === 2 || colNum === 4 || colNum === 6 || colNum === 7) ? 'center' : 'left',
              wrapText: colNum === 3 || colNum === 5
            };

            if (colNum === 4) {
              cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF2563EB' } };
            } else if (colNum === 6) {
              cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
            } else {
              cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF334155' } };
            }
          });
        });

        // Summary Total Row
        const totalSec = Math.round(responses.reduce((a, b) => a + (b.timeSpentMs || 0), 0) / 1000);
        const avgSec = Math.round(totalSec / (responses.length || 1));
        const totalRow = wsResp.addRow([
          "",
          "",
          "Total Assessment Time Across Scenarios",
          "",
          `Average decision pace: ${avgSec} seconds per scenario`,
          `${totalSec}s`,
          "—"
        ]);
        totalRow.height = 22;
        totalRow.eachCell((cell, colNum) => {
          cell.border = borderThin;
          cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = subHeaderFill;
          if (colNum === 6) cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `report-${candidateName.replace(/\s+/g, "-").toLowerCase()}.xlsx`);
    } catch (e) {
      console.error("Excel error", e);
      alert("Excel export failed. Please try again.");
    } finally {
      setExcelLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* PDF Button */}
      <button
        onClick={downloadPDF}
        disabled={pdfLoading}
        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 transition-all hover:bg-red-100 hover:border-red-300 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pdfLoading ? (
          <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        )}
        {pdfLoading ? "Generating…" : "Export PDF"}
      </button>

      {/* Excel Button */}
      <button
        onClick={downloadExcel}
        disabled={excelLoading}
        className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-100 hover:border-emerald-300 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {excelLoading ? (
          <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
        {excelLoading ? "Generating…" : "Export Excel"}
      </button>
    </div>
  );
}
