import { CANVAS_CONSTANTS } from '../constants/canvas';

/**
 * useEditablePdf.js
 *
 * Hybrid PDF: JPEG background (pixel-perfect) + vector text (Acrobat-editable) + JSON metadata.
 *
 * FONT STRATEGY:
 *  1. Always try the user's chosen font first (it may be a Thai font like Kanit, Prompt etc.)
 *  2. Only fall back to Sarabun if the loaded font CANNOT encode Thai characters
 *  3. Only embed TTF/OTF — WOFF2 causes Acrobat crashes (Brotli not available in browser fontkit)
 */
export function useEditablePdf() {
    const PDF_W = 595.28;
    const PDF_H = 841.89;
    const CVS_W = CANVAS_CONSTANTS.PAGE_WIDTH; // 794px
    const SCALE = PDF_W / CVS_W;              // ≈ 0.7498

    /**
     * @param {string[]|object[]} canvasImagesOrPages
     *   string[] data URLs  → full hybrid (image bg + vector text)
     *   object[] pages      → metadata-only (Save Project — no image layer)
     * @param {object}  fullProjectData  project JSON with {{ }} template form for re-import
     * @param {object}  variableMap      resolves {{ key }} → value for vector text
     */
    const generateHybridPdfBlob = async (
        canvasImagesOrPages,
        fullProjectData = null,
        variableMap = {},
        recordId = null,
        recordType = 'report'
    ) => {
        // Detect if we have rendered canvas images or plain page objects
        const isImageMode =
            Array.isArray(canvasImagesOrPages) &&
            canvasImagesOrPages.length > 0 &&
            typeof canvasImagesOrPages[0] === 'string' &&
            canvasImagesOrPages[0].startsWith('data:image');

        const canvasImages = isImageMode ? canvasImagesOrPages : [];

        if (!window.PDFLib) {
            alert('PDF Library is still loading. Please wait a moment.');
            return null;
        }

        const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
        const fontkit = window.fontkit;

        try {
            const pdfDoc = await PDFDocument.create();
            if (fontkit) pdfDoc.registerFontkit(fontkit);

            // ─────────────────────────────────────────────────────────────────
            // Font Cache & Loader
            //
            // DESIGN: Pre-verified direct URL map → 1 fetch per font, 0 wasted 404s.
            //
            // • Thai fonts:   fetched as TTF from verified GitHub paths
            // • Latin fonts:  use built-in Helvetica (0 network requests)
            //   Latin fonts lack Thai glyphs anyway, and Helvetica is a perfect
            //   PDF standard font. The probe logic below handles the swap if needed.
            //
            // WOFF2 guard: magic-byte validation skips WOFF/WOFF2 to prevent
            // "Cannot extract embedded font" errors in Acrobat.
            // ─────────────────────────────────────────────────────────────────
            const fontCache = new Map();

            const VALID_SFNT = new Set([
                0x00010000, // TrueType
                0x4F54544F, // OTF CFF (OTTO)
                0x74727565, // TrueType Mac (true)
                0x74746366  // TTC
            ]);

            // Verified single-URL map for every Thai font in our picker.
            // Key: "FontFamilyNoSpaces-Suffix"  Value: path under google/fonts main branch
            // Generated from the actual google/fonts GitHub repo structure.
            const GH_BASE = 'https://raw.githubusercontent.com/google/fonts/main';
            const FONT_MAP = {
                // ── Modern Thai Sans-Serif ─────────────────────────────────────
                'Sarabun-Regular': 'ofl/sarabun/Sarabun-Regular.ttf',
                'Sarabun-Bold': 'ofl/sarabun/Sarabun-Bold.ttf',
                'Sarabun-Italic': 'ofl/sarabun/Sarabun-Italic.ttf',
                'Sarabun-BoldItalic': 'ofl/sarabun/Sarabun-BoldItalic.ttf',
                'Kanit-Regular': 'ofl/kanit/Kanit-Regular.ttf',
                'Kanit-Bold': 'ofl/kanit/Kanit-Bold.ttf',
                'Kanit-Italic': 'ofl/kanit/Kanit-Italic.ttf',
                'Kanit-BoldItalic': 'ofl/kanit/Kanit-BoldItalic.ttf',
                'Prompt-Regular': 'ofl/prompt/Prompt-Regular.ttf',
                'Prompt-Bold': 'ofl/prompt/Prompt-Bold.ttf',
                'Prompt-Italic': 'ofl/prompt/Prompt-Italic.ttf',
                'Prompt-BoldItalic': 'ofl/prompt/Prompt-BoldItalic.ttf',
                'Mitr-Regular': 'ofl/mitr/Mitr-Regular.ttf',
                'Mitr-Bold': 'ofl/mitr/Mitr-SemiBold.ttf', // Mitr uses SemiBold
                'BaiJamjuree-Regular': 'ofl/baijamjuree/BaiJamjuree-Regular.ttf',
                'BaiJamjuree-Bold': 'ofl/baijamjuree/BaiJamjuree-Bold.ttf',
                'BaiJamjuree-Italic': 'ofl/baijamjuree/BaiJamjuree-Italic.ttf',
                'BaiJamjuree-BoldItalic': 'ofl/baijamjuree/BaiJamjuree-BoldItalic.ttf',
                'K2D-Regular': 'ofl/k2d/K2D-Regular.ttf',
                'K2D-Bold': 'ofl/k2d/K2D-Bold.ttf',
                'K2D-Italic': 'ofl/k2d/K2D-Italic.ttf',
                'K2D-BoldItalic': 'ofl/k2d/K2D-BoldItalic.ttf',
                'Kodchasan-Regular': 'ofl/kodchasan/Kodchasan-Regular.ttf',
                'Kodchasan-Bold': 'ofl/kodchasan/Kodchasan-Bold.ttf',
                'Kodchasan-Italic': 'ofl/kodchasan/Kodchasan-Italic.ttf',
                'Kodchasan-BoldItalic': 'ofl/kodchasan/Kodchasan-BoldItalic.ttf',
                'Krub-Regular': 'ofl/krub/Krub-Regular.ttf',
                'Krub-Bold': 'ofl/krub/Krub-Bold.ttf',
                'Krub-Italic': 'ofl/krub/Krub-Italic.ttf',
                'Krub-BoldItalic': 'ofl/krub/Krub-BoldItalic.ttf',
                'Niramit-Regular': 'ofl/niramit/Niramit-Regular.ttf',
                'Niramit-Bold': 'ofl/niramit/Niramit-Bold.ttf',
                'Niramit-Italic': 'ofl/niramit/Niramit-Italic.ttf',
                'Niramit-BoldItalic': 'ofl/niramit/Niramit-BoldItalic.ttf',
                'Srisakdi-Regular': 'ofl/srisakdi/Srisakdi-Regular.ttf',
                'Srisakdi-Bold': 'ofl/srisakdi/Srisakdi-Bold.ttf',
                // ── Thai Serif ─────────────────────────────────────────────────
                'Pridi-Regular': 'ofl/pridi/Pridi-Regular.ttf',
                'Pridi-Bold': 'ofl/pridi/Pridi-SemiBold.ttf',
                'Taviraj-Regular': 'ofl/taviraj/Taviraj-Regular.ttf',
                'Taviraj-Bold': 'ofl/taviraj/Taviraj-Bold.ttf',
                'Taviraj-Italic': 'ofl/taviraj/Taviraj-Italic.ttf',
                'Taviraj-BoldItalic': 'ofl/taviraj/Taviraj-BoldItalic.ttf',
                'Trirong-Regular': 'ofl/trirong/Trirong-Regular.ttf',
                'Trirong-Bold': 'ofl/trirong/Trirong-Bold.ttf',
                'Trirong-Italic': 'ofl/trirong/Trirong-Italic.ttf',
                'Trirong-BoldItalic': 'ofl/trirong/Trirong-BoldItalic.ttf',
                'Charm-Regular': 'ofl/charm/Charm-Regular.ttf',
                'Charm-Bold': 'ofl/charm/Charm-Bold.ttf',
                'Fahkwang-Regular': 'ofl/fahkwang/Fahkwang-Regular.ttf',
                'Fahkwang-Bold': 'ofl/fahkwang/Fahkwang-SemiBold.ttf',
                'Fahkwang-Italic': 'ofl/fahkwang/Fahkwang-Italic.ttf',
                'Pattaya-Regular': 'ofl/pattaya/Pattaya-Regular.ttf',
                'Thasadith-Regular': 'ofl/thasadith/Thasadith-Regular.ttf',
                'Thasadith-Bold': 'ofl/thasadith/Thasadith-Bold.ttf',
                'Thasadith-Italic': 'ofl/thasadith/Thasadith-Italic.ttf',
                'Thasadith-BoldItalic': 'ofl/thasadith/Thasadith-BoldItalic.ttf',
                // ── Thai Display / Decorative ──────────────────────────────────
                'Chonburi-Regular': 'ofl/chonburi/Chonburi-Regular.ttf',
                'Charmonman-Regular': 'ofl/charmonman/Charmonman-Regular.ttf',
                'Charmonman-Bold': 'ofl/charmonman/Charmonman-Bold.ttf',
                'ChakraPetch-Regular': 'ofl/chakrapetch/ChakraPetch-Regular.ttf',
                'ChakraPetch-Bold': 'ofl/chakrapetch/ChakraPetch-Bold.ttf',
                'ChakraPetch-Italic': 'ofl/chakrapetch/ChakraPetch-Italic.ttf',
                'ChakraPetch-BoldItalic': 'ofl/chakrapetch/ChakraPetch-BoldItalic.ttf',
                'Mali-Regular': 'ofl/mali/Mali-Regular.ttf',
                'Mali-Bold': 'ofl/mali/Mali-Bold.ttf',
                'Mali-Italic': 'ofl/mali/Mali-Italic.ttf',
                'Mali-BoldItalic': 'ofl/mali/Mali-BoldItalic.ttf',
                'Maitree-Regular': 'ofl/maitree/Maitree-Regular.ttf',
                'Maitree-Bold': 'ofl/maitree/Maitree-SemiBold.ttf',
                'Sriracha-Regular': 'ofl/sriracha/Sriracha-Regular.ttf',
                // Watone is not yet on Google Fonts GitHub → will fall to Sarabun
                // ── Noto Thai (variable-only in GH repo → use gstatic static TTFs) ─────
                'NotoSansThai-Regular': 'https://fonts.gstatic.com/s/notosansthai/v29/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU5RtpzE.ttf',
                'NotoSansThai-Bold': 'https://fonts.gstatic.com/s/notosansthai/v29/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU3NqpzE.ttf',
                'NotoSerifThai-Regular': 'https://fonts.gstatic.com/s/notoserifthai/v28/k3kyo80MPvpLmixYH7euCxWpSMu3-gcWGj0hHAKGvUQlUv_bCKDUSzB5L0oiF-RR.ttf',
                'NotoSerifThai-Bold': 'https://fonts.gstatic.com/s/notoserifthai/v28/k3kyo80MPvpLmixYH7euCxWpSMu3-gcWGj0hHAKGvUQlUv_bCKDUSzB5L0rFEORR.ttf',
                'NotoSansThaiLooped-Regular': 'https://fonts.gstatic.com/s/notosansthailooped/v16/B503F6pOpWTRcGrhOVJJ3-oPfY7WQuFu5R36MIjwurFMX_p0KVmQL3HnxYJ8hCVQ-_gtHhJi.ttf',
                'NotoSansThaiLooped-Bold': 'https://fonts.gstatic.com/s/notosansthailooped/v16/B503F6pOpWTRcGrhOVJJ3-oPfY7WQuFu5R36MIjwurFMX_p0KVmQL3HnxYJ8hCVQ-_jKGRJi.ttf',
                // ── IBM Plex Sans Thai (gstatic for reliability) ─────────────────────────
                'IBMPlexThai-Regular': 'https://fonts.gstatic.com/s/ibmplexsansthai/v11/m8JPje1VVIzcq1HzJq2AEdo2Tj_qvLq8Dg.ttf',
                'IBMPlexThai-Bold': 'https://fonts.gstatic.com/s/ibmplexsansthai/v11/m8JMje1VVIzcq1HzJq2AEdo2Tj_qvLqEsvMFbQ.ttf',
                'IBMPlexThaiLooped-Regular': 'https://fonts.gstatic.com/s/ibmplexsansthailooped/v12/tss_AoJJRAhL3BTrK3r2xxbFhvKfyBB6l7hHT30LxBI.ttf',
                'IBMPlexThaiLooped-Bold': 'https://fonts.gstatic.com/s/ibmplexsansthailooped/v12/tss6AoJJRAhL3BTrK3r2xxbFhvKfyBB6l7hHT30L_K6vhFk.ttf',
                // ── Anuphan (variable-only in GH repo → use gstatic static TTFs) ────────
                'Anuphan-Regular': 'https://fonts.gstatic.com/s/anuphan/v6/2sDBZGxYgY7LkLT0s2Yrm5UhuLoIZCkY9Q4k.ttf',
                'Anuphan-Bold': 'https://fonts.gstatic.com/s/anuphan/v6/2sDBZGxYgY7LkLT0s2Yrm5UhuLoIZCn_8g4k.ttf',
                // Noto Sans → moved to LATIN_ONLY_FAMILIES (Latin-subset only from gstatic; Thai in NotoSansThai)
            };

            const tryFetchTTF = async (url) => {
                try {
                    // Support both absolute URLs (gstatic) and GH_BASE-relative paths
                    const fullUrl = url.startsWith('http') ? url : `${GH_BASE}/${url}`;
                    const res = await fetch(fullUrl);
                    if (!res.ok) return null;
                    const bytes = await res.arrayBuffer();
                    const sig = new DataView(bytes).getUint32(0);
                    if (!VALID_SFNT.has(sig)) return null; // reject WOFF/WOFF2
                    return bytes;
                } catch { return null; }
            };

            // Latin-only families: These get Helvetica directly in the PDF.
            // They lack Thai glyphs anyway; Helvetica is the industry-standard fallback.
            const LATIN_ONLY_FAMILIES = new Set([
                'Roboto', 'Open Sans', 'OpenSans', 'Lato', 'Montserrat', 'Poppins',
                'Inter', 'Raleway', 'Nunito', 'Playfair Display', 'PlayfairDisplay',
                'Oswald', 'Merriweather', 'Source Sans 3', 'SourceSans3',
                'Ubuntu', 'PT Sans', 'PTSans', 'Josefin Sans', 'JosefinSans',
                'Quicksand', 'Dancing Script', 'DancingScript', 'Pacifico',
                // Watone: commercial demo font — not available as free TTF anywhere
                'Watone',
                // Noto Sans: removed — the gstatic TTF is Latin-subset only and Acrobat
                // shows the fallback font name (Sarabun) instead. Users needing Noto for
                // Thai should use "Noto Sans Thai" from the Thai fonts section.
                // 'Noto Sans', 'NotoSans',
            ]);

            const loadFont = async (family, weight = 'normal', style = 'normal') => {
                const key = `${family}-${weight}-${style}`;
                if (fontCache.has(key)) return fontCache.get(key);

                const isBold = weight === 'bold' || weight === '700' || weight === 700;
                const isItalic = style === 'italic';

                // Helper to get Standard Font Name
                const getStandardFont = (base) => {
                    if (base === 'Times') {
                        return isBold && isItalic ? StandardFonts.TimesRomanBoldItalic
                            : isBold ? StandardFonts.TimesRomanBold
                                : isItalic ? StandardFonts.TimesRomanItalic
                                    : StandardFonts.TimesRoman;
                    }
                    if (base === 'Courier') {
                        return isBold && isItalic ? StandardFonts.CourierBoldOblique
                            : isBold ? StandardFonts.CourierBold
                                : isItalic ? StandardFonts.CourierOblique
                                    : StandardFonts.Courier;
                    }
                    return isBold && isItalic ? StandardFonts.HelveticaBoldOblique
                        : isBold ? StandardFonts.HelveticaBold
                            : isItalic ? StandardFonts.HelveticaOblique
                                : StandardFonts.Helvetica;
                };

                // A. Standard built-in PDF fonts
                const isStandard = ['Helvetica', 'Arial', 'Times', 'Times New Roman',
                    'Courier', 'Courier New'].some(n => family.includes(n));
                if (isStandard) {
                    const base = family.includes('Times') ? 'Times' : family.includes('Courier') ? 'Courier' : 'Helvetica';
                    const f = await pdfDoc.embedFont(getStandardFont(base));
                    fontCache.set(key, f);
                    return f;
                }

                // B. Latin-only families → Helvetica fallback
                if (LATIN_ONLY_FAMILIES.has(family)) {
                    const f = await pdfDoc.embedFont(getStandardFont('Helvetica'));
                    fontCache.set(key, f);
                    return f;
                }

                // C. Verified direct URL map with robust variant fallback
                const fmt = family.replace(/\s+/g, '');

                // Try variants in order of specificity
                const getVariants = () => {
                    if (isBold && isItalic) return ['BoldItalic', 'Bold', 'Italic', 'Regular'];
                    if (isBold) return ['Bold', 'Regular'];
                    if (isItalic) return ['Italic', 'Regular'];
                    return ['Regular'];
                };

                for (const suffix of getVariants()) {
                    const mapKey = `${fmt}-${suffix}`;
                    if (FONT_MAP[mapKey]) {
                        const bytes = await tryFetchTTF(FONT_MAP[mapKey]);
                        if (bytes) {
                            const f = await pdfDoc.embedFont(bytes, { subset: false });
                            fontCache.set(key, f);
                            return f;
                        }
                    }
                }

                // D. Thai Fallback (Sarabun) - PRESERVE STYLE
                const sarabunSuffix = isBold && isItalic ? 'BoldItalic' : isBold ? 'Bold' : isItalic ? 'Italic' : 'Regular';
                const sarabunKey = `Sarabun-${sarabunSuffix}`;
                if (FONT_MAP[sarabunKey]) {
                    const bytes = await tryFetchTTF(FONT_MAP[sarabunKey]);
                    if (bytes) {
                        const f = await pdfDoc.embedFont(bytes, { subset: false });
                        fontCache.set(key, f);
                        return f;
                    }
                }

                // E. Absolute last resort — built-in Helvetica
                const f = await pdfDoc.embedFont(getStandardFont('Helvetica'));
                fontCache.set(key, f);
                return f;
            };

            // ── Embed project metadata for re-import ──────────────────────────
            if (fullProjectData) {
                try {
                    const json = JSON.stringify(fullProjectData);
                    const b64 = btoa(unescape(encodeURIComponent(json)));
                    pdfDoc.setTitle(fullProjectData.name || 'Report');
                    pdfDoc.setSubject(`layout:${b64}`);

                    const keywords = ['dynamic-report-hybrid', 'editable'];
                    if (recordId) keywords.push(`dynamic-id:${recordId}`);
                    keywords.push(`dynamic-type:${recordType || 'report'}`);

                    pdfDoc.setKeywords(keywords);
                    pdfDoc.setCreator('Dynamic Report Creator');
                } catch (e) { console.warn('Metadata embed failed:', e); }
            }

            // ── Helpers ───────────────────────────────────────────────────────
            const resolveText = (text) => {
                if (!variableMap || !text) return text;
                return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
                    variableMap[k] !== undefined ? String(variableMap[k]) : `{{${k}}}`
                );
            };

            const parseColor = (fill) => {
                if (!fill || fill === 'transparent') return rgb(0, 0, 0);
                if (fill.startsWith('#')) {
                    const hex = fill.slice(1);
                    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
                    return rgb(parseInt(full.slice(0, 2), 16) / 255, parseInt(full.slice(2, 4), 16) / 255, parseInt(full.slice(4, 6), 16) / 255);
                }
                const m = fill.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
                if (m) return rgb(+m[1] / 255, +m[2] / 255, +m[3] / 255);
                return rgb(0, 0, 0);
            };

            const dataUrlToBytes = (dataUrl) => {
                if (!dataUrl || typeof dataUrl !== 'string') return null;
                const parts = dataUrl.split(';base64,');
                if (parts.length < 2) return null;
                const raw = atob(parts[1]);
                const arr = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
                return arr;
            };

            // ── Build pages ───────────────────────────────────────────────────
            const pages = fullProjectData?.pages ?? [];
            const numPages = Math.max(canvasImages.length, pages.length);

            for (let pi = 0; pi < numPages; pi++) {
                const pdfPage = pdfDoc.addPage([PDF_W, PDF_H]);

                // Layer 1: Background JPEG (text-free canvas render)
                if (canvasImages[pi]) {
                    const imgBytes = dataUrlToBytes(canvasImages[pi]);
                    if (imgBytes) {
                        try {
                            const isJpeg = canvasImages[pi].startsWith('data:image/jpeg') ||
                                canvasImages[pi].startsWith('data:image/jpg');
                            const img = isJpeg
                                ? await pdfDoc.embedJpg(imgBytes)
                                : await pdfDoc.embedPng(imgBytes);
                            pdfPage.drawImage(img, { x: 0, y: 0, width: PDF_W, height: PDF_H });
                        } catch (imgErr) {
                            console.warn(`Page ${pi + 1} image failed:`, imgErr);
                        }
                    }
                }

                // Layer 2: Vector text & Vector Images (editable in Acrobat Edit PDF mode)
                const pageData = pages[pi];
                if (!pageData?.objects) continue;

                for (const obj of pageData.objects) {
                    // ── A. Handle Text (Vector) ─────────────────────────────
                    if (['textbox', 'text', 'i-text'].includes(obj.type)) {
                        const rawText = (obj.text || '').trim();
                        if (!rawText) continue;

                        const textContent = resolveText(rawText);
                        const hasThai = /[\u0E00-\u0E7F]/.test(textContent);

                        // ── Coordinate conversion ───────────────────────────────────
                        const sx = obj.scaleX || 1;
                        const sy = obj.scaleY || 1;
                        const w = (obj.width || 0) * sx;
                        const h = (obj.height || 0) * sy;
                        let localX = obj.left ?? 0;
                        let localY = obj.top ?? 0;
                        if (obj.originX === 'center') localX -= w / 2;
                        if (obj.originY === 'center') localY -= h / 2;

                        const pdfX = localX * SCALE;
                        const pdfY = PDF_H - (localY + h) * SCALE;
                        const pdfW = w * SCALE;
                        const pdfH = h * SCALE;
                        const fontSize = Math.max(1, (obj.fontSize || 12) * sy * SCALE);

                        // ── Smart font selection ────────────────────────────────────
                        let font;
                        const weight = obj.fontWeight || 'normal';
                        const style = obj.fontStyle || 'normal';

                        try {
                            font = await loadFont(obj.fontFamily || 'Helvetica', weight, style);
                        } catch {
                            font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                        }

                        if (hasThai) {
                            let canEncodeThai = false;
                            try {
                                font.widthOfTextAtSize('\u0E01', fontSize);
                                canEncodeThai = true;
                            } catch { }

                            if (!canEncodeThai) {
                                try {
                                    font = await loadFont('Sarabun', weight, style);
                                } catch { }
                            }
                        }

                        const textColor = parseColor(obj.fill);
                        const charSpacing = hasThai ? 0 : ((obj.charSpacing || 0) / 1000) * fontSize;
                        const lineHeight = fontSize * (obj.lineHeight || 1.16);
                        const textLines = textContent.split('\n');
                        let currentY = pdfY + pdfH - fontSize * 0.85;

                        for (const line of textLines) {
                            if (currentY < pdfY - lineHeight) break;
                            if (!line) { currentY -= lineHeight; continue; }

                            let lineWidth;
                            try {
                                lineWidth = font.widthOfTextAtSize(line, fontSize)
                                    + charSpacing * Math.max(0, line.length - 1);
                            } catch { lineWidth = pdfW; }

                            let lineX = pdfX;
                            if (obj.textAlign === 'center') lineX = pdfX + pdfW / 2 - lineWidth / 2;
                            else if (obj.textAlign === 'right') lineX = pdfX + pdfW - lineWidth;

                            try {
                                pdfPage.drawText(line, {
                                    x: lineX, y: currentY,
                                    size: fontSize, font,
                                    color: textColor,
                                    opacity: obj.opacity ?? 1,
                                    ...(charSpacing !== 0 ? { characterSpacing: charSpacing } : {})
                                });
                            } catch (drawErr) {
                                // Specific encoding fallback that PRESERVES STYLE
                                if (drawErr.message?.includes('WinAnsi') || drawErr.message?.includes('encode')) {
                                    try {
                                        const fb = await loadFont('Sarabun', weight, style);
                                        pdfPage.drawText(line, {
                                            x: lineX, y: currentY,
                                            size: fontSize, font: fb,
                                            color: textColor,
                                            opacity: obj.opacity ?? 1
                                        });
                                    } catch { }
                                }
                            }

                            if (obj.underline) {
                                try {
                                    pdfPage.drawLine({
                                        start: { x: lineX, y: currentY - 2 },
                                        end: { x: lineX + lineWidth, y: currentY - 2 },
                                        thickness: Math.max(0.5, fontSize / 20),
                                        color: textColor, opacity: obj.opacity ?? 1
                                    });
                                } catch { }
                            }
                            currentY -= lineHeight;
                        }
                    }

                    // ── B. Handle Images (Assets) ───────────────────────────
                    // DRAWING ASSETS AS PDF OBJECTS: This makes images "selectable" and
                    // "movable" in Acrobat Edit PDF mode, rather than baked into the background.
                    else if (obj.type === 'image' && obj.src) {
                        try {
                            let imgBytes;
                            const srcLower = obj.src.toLowerCase();
                            let isPng = srcLower.endsWith('.png') || srcLower.startsWith('data:image/png');
                            const isGif = srcLower.endsWith('.gif') || srcLower.startsWith('data:image/gif');

                            if (isGif) {
                                // PDF-lib doesn't support GIF. Convert to static PNG via Canvas.
                                const staticUrl = await new Promise((resolve, reject) => {
                                    const img = new Image();
                                    img.crossOrigin = 'anonymous';
                                    img.onload = () => {
                                        const cvs = document.createElement('canvas');
                                        cvs.width = img.width;
                                        cvs.height = img.height;
                                        const ctx = cvs.getContext('2d');
                                        ctx.drawImage(img, 0, 0);
                                        resolve(cvs.toDataURL('image/png'));
                                    };
                                    img.onerror = reject;
                                    img.src = obj.src;
                                });
                                imgBytes = dataUrlToBytes(staticUrl);
                                isPng = true;
                            } else {
                                if (srcLower.startsWith('data:')) {
                                    imgBytes = dataUrlToBytes(obj.src);
                                    if (!imgBytes) continue;
                                } else {
                                    const imgRes = await fetch(obj.src);
                                    if (!imgRes.ok) continue;
                                    imgBytes = await imgRes.arrayBuffer();
                                }
                            }

                            let pdfImg;
                            try {
                                pdfImg = await pdfDoc.embedJpg(imgBytes);
                            } catch (error) {
                                try {
                                    pdfImg = await pdfDoc.embedPng(imgBytes);
                                } catch (fallbackErr) {
                                    console.warn('Failed to embed asset as JPG or PNG', fallbackErr);
                                    continue;
                                }
                            }

                            const sx = obj.scaleX || 1;
                            const sy = obj.scaleY || 1;
                            const w = (obj.width || 0) * sx;
                            const h = (obj.height || 0) * sy;
                            let localX = obj.left ?? 0;
                            let localY = obj.top ?? 0;
                            if (obj.originX === 'center') localX -= w / 2;
                            if (obj.originY === 'center') localY -= h / 2;

                            pdfPage.drawImage(pdfImg, {
                                x: localX * SCALE,
                                y: PDF_H - (localY + h) * SCALE,
                                width: w * SCALE,
                                height: h * SCALE,
                                opacity: obj.opacity ?? 1
                            });
                        } catch (err) {
                            console.warn('Failed to embed asset image in PDF layer:', err);
                        }
                    }
                }
            }

            const pdfBytes = await pdfDoc.save();
            return new Blob([pdfBytes], { type: 'application/pdf' });

        } catch (err) {
            console.error('Hybrid PDF generation failed:', err);
            alert('PDF generation failed: ' + err.message);
            return null;
        }
    };

    // Store original templates before preview mode
    const originalTemplates = new Map();

    // Safe template backup before entering preview
    const backupTemplatesBeforePreview = (canvas, pages) => {
        originalTemplates.clear();

        if (!canvas || !pages) return;

        canvas.getObjects().forEach(obj => {
            if (['textbox', 'text', 'i-text'].includes(obj.type) && obj.text) {
                const objId = obj.id || `${obj.type}_${obj.left}_${obj.top}`;
                originalTemplates.set(objId, {
                    text: obj.text,
                    editable: obj.editable,
                    selectable: obj.selectable,
                    evented: obj.evented
                });
            }
        });
    };

    // Safe template restoration with validation
    const restoreTemplatesAfterPreview = (canvas) => {
        if (!canvas || originalTemplates.size === 0) return false;

        let restored = 0;
        let errors = 0;

        canvas.getObjects().forEach(obj => {
            if (['textbox', 'text', 'i-text'].includes(obj.type)) {
                const objId = obj.id || `${obj.type}_${obj.left}_${obj.top}`;
                const backup = originalTemplates.get(objId);

                if (backup) {
                    try {
                        // Restore original template text
                        obj.set('text', backup.text);
                        obj.set('editable', backup.editable);
                        obj.set('selectable', backup.selectable);
                        obj.set('evented', backup.evented);

                        // Ensure proper text baseline
                        if (obj.textBaseline === 'alphabetical') {
                            obj.set('textBaseline', 'alphabetic');
                        }

                        restored++;
                    } catch (e) {
                        console.error(`Failed to restore template for object ${objId}:`, e);
                        errors++;
                    }
                }
            }
        });

        console.log(`Template restoration: ${restored} restored, ${errors} errors`);
        originalTemplates.clear();

        return errors === 0;
    };

    // Enhanced applyPreviewData with error handling
    const applyPreviewDataSafe = (canvas, mockData) => {
        if (!canvas) return false;

        try {
            // Backup before applying preview data
            const currentTexts = new Map();
            canvas.getObjects().forEach(obj => {
                if (['textbox', 'text', 'i-text'].includes(obj.type) && obj.text) {
                    const objId = obj.id || `${obj.type}_${obj.left}_${obj.top}`;
                    currentTexts.set(objId, obj.text);
                }
            });

            canvas.selection = false;
            canvas.discardActiveObject();

            canvas.getObjects().forEach(obj => {
                // Resolve text variables safely
                if (['textbox', 'text', 'i-text'].includes(obj.type) && obj.text) {
                    let newText = obj.text;
                    let hasVariables = false;

                    // Check for variables before replacement
                    if (/\{\{[^}]+\}\}/.test(newText)) {
                        hasVariables = true;
                        Object.keys(mockData).forEach(key => {
                            const regex = new RegExp(`{{${key}}}`, 'g');
                            newText = newText.replace(regex, mockData[key]);
                        });
                    }

                    if (hasVariables && newText !== obj.text) {
                        obj.set('text', newText);
                    }
                    obj.set('editable', false);
                }

                // Lock objects safely - preserve background elements
                if (obj.id !== 'page-bg' && obj.id !== 'page-bg-image') {
                    obj.set({
                        selectable: false,
                        evented: false,
                        hasControls: false,
                        hasBorders: false
                    });
                }
            });

            canvas.requestRenderAll();
            return true;

        } catch (error) {
            console.error('Error applying preview data:', error);
            return false;
        }
    };

    // Safe toggle with rollback capability
    const togglePreviewWithRollback = async (
        canvas,
        isPreviewMode,
        setIsPreviewMode,
        mockData,
        renderAllPages,
        saveCurrentPageState
    ) => {
        if (!canvas) return false;

        // Always save state before any toggle
        saveCurrentPageState();

        const wasPreview = isPreviewMode.value;

        try {
            if (!wasPreview) {
                // Entering preview mode
                backupTemplatesBeforePreview(canvas);
                setIsPreviewMode(true);

                await nextTick();
                await renderAllPages();

                const success = applyPreviewDataSafe(canvas, mockData);
                if (!success) {
                    throw new Error('Failed to apply preview data');
                }
            } else {
                // Exiting preview mode
                const success = restoreTemplatesAfterPreview(canvas);
                if (!success) {
                    console.warn('Template restoration had errors, but continuing...');
                }

                setIsPreviewMode(false);
                canvas.selection = true;

                await nextTick();
                await renderAllPages();
            }

            return true;

        } catch (error) {
            console.error('Preview toggle failed, rolling back:', error);

            // Rollback on error
            try {
                if (!wasPreview) {
                    // Failed to enter preview, restore edit mode
                    restoreTemplatesAfterPreview(canvas);
                    setIsPreviewMode(false);
                    canvas.selection = true;
                } else {
                    // Failed to exit preview, stay in preview
                    setIsPreviewMode(true);
                }

                await nextTick();
                await renderAllPages();
            } catch (rollbackError) {
                console.error('Rollback also failed:', rollbackError);
            }

            return false;
        }
    };

    // Cleanup function
    const cleanup = () => {
        originalTemplates.clear();
    };

    // Enhanced font loading with timeout and concurrency control
    const createFontLoader = () => {
        const fontCache = new Map();
        const loadingPromises = new Map();
        const MAX_FONT_CACHE_SIZE = 20;
        const FONT_LOAD_TIMEOUT = 10000; // 10 seconds

        const loadFontSafe = async (pdfDoc, family, weight = 'normal', style = 'normal') => {
            const key = `${family}-${weight}-${style}`;

            // Check cache first
            if (fontCache.has(key)) {
                return fontCache.get(key);
            }

            // Check if already loading
            if (loadingPromises.has(key)) {
                return loadingPromises.get(key);
            }

            // Limit cache size
            if (fontCache.size >= MAX_FONT_CACHE_SIZE) {
                const firstKey = fontCache.keys().next().value;
                fontCache.delete(firstKey);
            }

            // Create loading promise with timeout
            const loadPromise = new Promise(async (resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    loadingPromises.delete(key);
                    reject(new Error(`Font load timeout: ${key}`));
                }, FONT_LOAD_TIMEOUT);

                try {
                    // Try to load font (implementation depends on your font strategy)
                    let font = null;

                    // Standard fonts first
                    if (['Helvetica', 'Arial', 'Times', 'Courier'].some(n => family.includes(n))) {
                        const base = family.includes('Times') ? 'Times' :
                            family.includes('Courier') ? 'Courier' : 'Helvetica';

                        if (weight === 'bold' && style === 'italic') {
                            font = await pdfDoc.embedFont(window.PDFLib.StandardFonts[`${base}BoldOblique`]);
                        } else if (weight === 'bold') {
                            font = await pdfDoc.embedFont(window.PDFLib.StandardFonts[`${base}Bold`]);
                        } else if (style === 'italic') {
                            font = await pdfDoc.embedFont(window.PDFLib.StandardFonts[`${base}Oblique`]);
                        } else {
                            font = await pdfDoc.embedFont(window.PDFLib.StandardFonts[base]);
                        }
                    } else {
                        // Custom font loading with error handling
                        try {
                            // Your custom font loading logic here
                            font = await pdfDoc.embedFont(window.PDFLib.StandardFonts.Helvetica);
                        } catch (customError) {
                            console.warn(`Custom font ${family} failed, using Helvetica:`, customError);
                            font = await pdfDoc.embedFont(window.PDFLib.StandardFonts.Helvetica);
                        }
                    }

                    clearTimeout(timeoutId);
                    loadingPromises.delete(key);
                    fontCache.set(key, font);
                    resolve(font);

                } catch (error) {
                    clearTimeout(timeoutId);
                    loadingPromises.delete(key);
                    reject(error);
                }
            });

            loadingPromises.set(key, loadPromise);
            return loadPromise;
        };

        return { loadFontSafe, cleanup: () => fontCache.clear() };
    };

    // Safe canvas image capture with CORS protection
    const captureCanvasPageSafe = async (canvas, pageIndex, zoomLevel, qualityMultiplier = 2) => {
        if (!canvas) return null;

        const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
        const GAP = CANVAS_CONSTANTS.PAGE_GAP;
        const TEXT_TYPES = ['textbox', 'text', 'i-text'];
        const IMAGE_TYPES = ['image'];
        const ALL_OVERLAY_TYPES = [...TEXT_TYPES, ...IMAGE_TYPES];

        try {
            // Create a clean canvas clone to avoid tainting
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');

            const captureWidth = CANVAS_CONSTANTS.PAGE_WIDTH * zoomLevel;
            const captureHeight = P_H * zoomLevel;
            const topOffset = pageIndex * (P_H + GAP) * zoomLevel;

            tempCanvas.width = captureWidth;
            tempCanvas.height = captureHeight;

            // Get all objects and determine visibility for this page
            const allObjects = canvas.getObjects();
            const objectsToRender = [];
            const hiddenForCapture = [];

            allObjects.forEach(obj => {
                const center = obj.getCenterPoint();
                const objPageIndex = Math.floor(center.y / (P_H + GAP));
                const isWrongPage = objPageIndex !== pageIndex;
                const isOverlay = ALL_OVERLAY_TYPES.includes(obj.type) &&
                    obj.id !== 'page-bg-image' &&
                    obj.id !== 'page-bg';

                if ((isWrongPage || isOverlay) && obj.visible) {
                    hiddenForCapture.push(obj);
                    obj.visible = false;
                } else if (!isWrongPage && obj.visible) {
                    objectsToRender.push(obj);
                }
            });

            // Render the clean page
            canvas.renderAll();

            // Use toDataURL with error handling
            let dataUrl = null;
            try {
                dataUrl = canvas.toDataURL({
                    format: 'jpeg',
                    quality: 0.92,
                    multiplier: qualityMultiplier / zoomLevel,
                    left: 0,
                    top: topOffset,
                    width: captureWidth,
                    height: captureHeight
                });
            } catch (canvasError) {
                console.warn(`Canvas taint detected on page ${pageIndex + 1}, using fallback:`, canvasError);

                // Fallback: draw only background elements
                try {
                    // Create a minimal canvas with just background
                    const fallbackCanvas = document.createElement('canvas');
                    fallbackCanvas.width = CANVAS_CONSTANTS.PAGE_WIDTH * qualityMultiplier;
                    fallbackCanvas.height = P_H * qualityMultiplier;
                    const fallbackCtx = fallbackCanvas.getContext('2d');

                    fallbackCtx.fillStyle = '#ffffff';
                    fallbackCtx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);

                    dataUrl = fallbackCanvas.toDataURL('image/jpeg', 0.92);
                } catch (fallbackError) {
                    console.error(`Even fallback failed for page ${pageIndex + 1}:`, fallbackError);
                    return null;
                }
            }

            // Restore visibility
            hiddenForCapture.forEach(obj => { obj.visible = true; });
            canvas.renderAll();

            return dataUrl && dataUrl.length > 100 ? dataUrl : null;

        } catch (error) {
            console.error(`Error capturing page ${pageIndex + 1}:`, error);
            return null;
        }
    };

    // Helper functions from usePdfExportFix
    const dataUrlToBytes = (dataUrl) => {
        if (!dataUrl || typeof dataUrl !== 'string') return null;
        const parts = dataUrl.split(';base64,');
        if (parts.length < 2) return null;
        const raw = atob(parts[1]);
        const arr = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        return arr;
    };

    return {
        generateHybridPdfBlob,
        createFontLoader,
        captureCanvasPageSafe,
        backupTemplatesBeforePreview,
        restoreTemplatesAfterPreview,
        applyPreviewDataSafe,
        togglePreviewWithRollback,
        cleanup
    };
}
