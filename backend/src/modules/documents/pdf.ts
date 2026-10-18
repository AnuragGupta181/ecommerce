import PDFDocument from "pdfkit";

/** PDF building blocks. The built-in fonts have no ₹ glyph, so amounts print as "Rs. 1,234.50". */

export const rs = (paise: number) => `Rs. ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type Column = { label: string; width: number; align?: "left" | "right" };

export class PdfWriter {
  readonly doc = new PDFDocument({ size: "A4", margin: 48 });
  private readonly left = 48;
  private readonly right = 547;

  heading(title: string, subtitle: string, meta: [string, string][]) {
    const { doc } = this;
    doc.rect(0, 0, 595, 70).fill("#FFC727");
    doc.fillColor("#1C1A14").font("Helvetica-Bold").fontSize(20).text(title, this.left, 24);
    doc.font("Helvetica").fontSize(10).text(subtitle, this.left, 48);
    doc.moveDown(2.5);
    const top = doc.y;
    meta.forEach(([label, value], index) => {
      const x = index % 2 === 0 ? this.left : 320;
      const y = top + Math.floor(index / 2) * 16;
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#7A7465").text(label, x, y, { continued: true }).font("Helvetica").fillColor("#1C1A14").text(`  ${value}`);
    });
    doc.moveDown(1.5);
    return this;
  }

  block(title: string, lines: (string | null | undefined)[]) {
    const { doc } = this;
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1C1A14").text(title, this.left);
    doc.font("Helvetica").fontSize(9).fillColor("#3F3B2F");
    for (const line of lines) if (line) doc.text(line, this.left);
    doc.moveDown(0.8);
    return this;
  }

  table(columns: Column[], rows: string[][]) {
    const { doc } = this;
    const drawRow = (cells: string[], bold: boolean) => {
      if (doc.y > 760) doc.addPage();
      const y = doc.y;
      let x = this.left;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor("#1C1A14");
      cells.forEach((cell, index) => {
        const column = columns[index]!;
        doc.text(cell, x, y, { width: column.width - 6, align: column.align ?? "left" });
        x += column.width;
      });
      doc.y = Math.max(doc.y, y + 14);
      doc.moveTo(this.left, doc.y).lineTo(this.right, doc.y).strokeColor("#ECE8DC").lineWidth(0.5).stroke();
      doc.y += 4;
    };
    drawRow(columns.map((column) => column.label), true);
    rows.forEach((row) => drawRow(row, false));
    doc.moveDown(0.5);
    return this;
  }

  totals(rows: [string, string, boolean?][]) {
    const { doc } = this;
    for (const [label, value, strong] of rows) {
      const y = doc.y;
      doc.font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(strong ? 11 : 9).fillColor("#1C1A14");
      doc.text(label, 320, y, { width: 140 });
      doc.text(value, 460, y, { width: 87, align: "right" });
      doc.y = y + (strong ? 18 : 14);
    }
    doc.moveDown(1);
    return this;
  }

  note(text: string) {
    this.doc.font("Helvetica").fontSize(8).fillColor("#7A7465").text(text, this.left, undefined, { width: this.right - this.left });
    return this;
  }

  /** Resolves with the whole file; documents are small enough to buffer. */
  toBuffer(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      this.doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      this.doc.on("end", () => resolve(Buffer.concat(chunks)));
      this.doc.on("error", reject);
      this.doc.end();
    });
  }
}

export const dateText = (date: Date | string | null | undefined) =>
  date ? new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "-";
