import { jsPDF } from 'jspdf';

export function usePdfGenerator() {
  const downloadPDF = async (
    canvasImages,
    filename = 'report.pdf',
    recordId = null,
    recordType = 'report',
    pagesData = null
  ) => {
    if (!canvasImages || canvasImages.length === 0) {
      console.error('No images to print');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    canvasImages.forEach((imgData, index) => {
      if (index > 0) {
        doc.addPage();
      }
      doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
    });


    const keywords = [];
    if (recordId) keywords.push(`dynamic-id:${recordId}`);
    keywords.push(`dynamic-type:${recordType || 'report'}`);


    let subject = '';
    if (pagesData) {
      try {
        const jsonStr = JSON.stringify(pagesData);
        const base64Str = btoa(unescape(encodeURIComponent(jsonStr)));
        subject = `layout:${base64Str}`;

      } catch (e) {
        console.warn('Failed to embed layout data', e);
      }
    }

    doc.setProperties({
      title: filename.replace('.pdf', ''),
      subject: subject,
      keywords: keywords.join(' '),
      creator: 'Dynamic Report Creator System',
      producer: 'Dynamic Report Creator'
    });


    doc.save(filename);
  };

  return {
    downloadPDF
  };
}
