// --- PDF Generation Utility ---
// Centralizes PDF creation logic and adds a crucial safety check.
// jsPDF e' ora una dipendenza npm (bundle locale, niente CDN): l'app desktop
// genera i PDF anche completamente offline.
import { jsPDF } from 'jspdf';

const getPdfInstance = () => new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

// Generic PDF generation function that can be used for any document type.
// It abstracts the boilerplate code for creating a PDF and handling text wrapping.
export const generatePdf = (
    fileName: string, 
    title: string, 
    buildContent: (context: {
        addWrappedText: (text: string, options?: { isListItem?: boolean; size?: number; color?: number[]; marginBottom?: number; }) => void;
        addSeparator: (options?: { marginBottom?: number; marginTop?: number; }) => void;
    }) => void
): void => {
    const pdf = getPdfInstance();
    const margin = 15;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let y = margin;

    const checkAndAddPage = (neededHeight: number = 0) => {
        if (y + neededHeight > pageHeight - margin) {
            pdf.addPage();
            y = margin;
            return true;
        }
        return false;
    };

    // --- Header ---
    pdf.setFontSize(22);
    pdf.setTextColor(40);
    const titleLines = pdf.splitTextToSize(title, pageWidth - margin * 2);
    checkAndAddPage(titleLines.length * 10);
    pdf.text(titleLines, pageWidth / 2, y, { align: 'center' });
    y += titleLines.length * 10;

    const addWrappedText = (
        text: string, 
        options: { isListItem?: boolean, size?: number, color?: number[], marginBottom?: number } = {}
    ) => {
        // Reduced default bottom margin for a tighter layout.
        const { isListItem = false, size = 11, color = [80], marginBottom = 2 } = options;
        const textToRender = String(text || '');
        if (!textToRender.trim()) return;

        const textWidth = pageWidth - margin * 2 - (isListItem ? 5 : 0);
        
        pdf.setFontSize(size);
        {
            // setTextColor richiede 3 argomenti fissi: spacchettiamo con default.
            const [r = 80, g = 80, b = 80] = color ?? [];
            pdf.setTextColor(r, g, b);
        }

        const lines = pdf.splitTextToSize(textToRender, textWidth);
        // Correctly calculate line height in the document's units (mm).
        const lineHeight = pdf.getLineHeight() / pdf.internal.scaleFactor;

        // --- CORE FIX: Process text line-by-line to handle page breaks within a single text block ---
        lines.forEach((line: string) => {
            // Check if the current line fits, if not, create a new page.
            if (y + lineHeight > pageHeight - margin) {
                pdf.addPage();
                y = margin;
            }
            pdf.text(line, isListItem ? margin + 5 : margin, y);
            y += lineHeight;
        });

        // Add the specified margin after the entire text block has been rendered.
        y += marginBottom;
    };

    const addSeparator = (options: { marginBottom?: number, marginTop?: number } = {}) => {
        // Reduced default margins for a tighter layout.
        const { marginBottom = 2, marginTop = 2 } = options;
        y += marginTop;
        const separatorHeight = 1;
        checkAndAddPage(separatorHeight + marginBottom);
        pdf.setDrawColor(220);
        pdf.line(margin, y, pageWidth - margin, y);
        y += marginBottom;
    };

    // --- Build Dynamic Content ---
    buildContent({ addWrappedText, addSeparator });
    
    // --- Save ---
    pdf.save(fileName);
};