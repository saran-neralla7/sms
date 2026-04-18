import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

/**
 * Pre-process the docx zip to clean up XML runs that split {{...}} tags.
 * Word/LibreOffice often inserts bookmarks, spell-check spans, or formatting
 * changes in the middle of a {{tag}}, splitting it across multiple <w:r> elements.
 * This function merges adjacent <w:t> text nodes within the same paragraph
 * so that docxtemplater can find complete {{tag_name}} tokens.
 */
function cleanTemplateXml(zip: PizZip): void {
    const files = zip.files;
    // Process document.xml (main body) and any headers/footers
    const xmlFiles = Object.keys(files).filter(
        (name) => name.startsWith("word/") && name.endsWith(".xml")
    );

    for (const fileName of xmlFiles) {
        let xmlContent = zip.file(fileName)?.asText();
        if (!xmlContent) continue;

        // Strategy: Find paragraphs that contain partial {{ or }} tokens
        // and merge all <w:t> text within those paragraphs into a single run.
        
        // Simpler approach: merge all <w:r> runs that have the same formatting
        // within a paragraph when they contain parts of {{ }} tags.
        
        // Most robust approach: extract all text from <w:t> tags, find where
        // {{ and }} don't match within a single <w:t>, and merge those runs.
        
        // Use the docxtemplater-recommended approach: strip XML between 
        // split tags by collapsing runs.
        
        // Replace pattern: when we see }} or {{ split across <w:t> boundaries,
        // merge them. The pattern is:
        // </w:t></w:r>...<w:r>...<w:t>  between parts of a {{tag}}
        
        // Step 1: Remove bookmarks that appear inside runs (the exact issue we found)
        xmlContent = xmlContent.replace(
            /<w:bookmarkStart[^/]*\/>/g, ""
        );
        xmlContent = xmlContent.replace(
            /<w:bookmarkEnd[^/]*\/>/g, ""
        );

        // Step 2: Merge adjacent runs with partial tags.
        // Find cases where a <w:t> ends with {{ or starts with }}
        // and merge with the adjacent <w:t>
        let changed = true;
        let iterations = 0;
        while (changed && iterations < 20) {
            changed = false;
            iterations++;
            
            // Pattern: text ending with partial open tag, followed by close/open run XML, then more text
            // e.g., <w:t>{{something</w:t></w:r><w:r><w:rPr>...</w:rPr><w:t>}}</w:t>
            const mergePattern = /<w:t([^>]*)>([^<]*)<\/w:t><\/w:r>\s*<w:r>\s*<w:rPr>[^]*?<\/w:rPr>\s*<w:t([^>]*)>([^<]*)<\/w:t>/g;
            
            const newContent: string = xmlContent.replace(mergePattern, (match: string, attrs1: string, text1: string, attrs2: string, text2: string): string => {
                const combined = text1 + text2;
                // Only merge if the combined text would complete a {{...}} tag
                if (combined.includes("{{") || combined.includes("}}") || 
                    text1.includes("{") || text2.includes("}")) {
                    changed = true;
                    // Use xml:space="preserve" to maintain spacing
                    return `<w:t xml:space="preserve">${combined}</w:t>`;
                }
                return match;
            });
            xmlContent = newContent;
            
            // Also handle runs without <w:rPr>
            const mergePattern2 = /<w:t([^>]*)>([^<]*)<\/w:t><\/w:r>\s*<w:r>\s*<w:t([^>]*)>([^<]*)<\/w:t>/g;
            const newContent2: string = xmlContent.replace(mergePattern2, (match: string, attrs1: string, text1: string, attrs2: string, text2: string): string => {
                const combined = text1 + text2;
                if (combined.includes("{{") || combined.includes("}}") || 
                    text1.includes("{") || text2.includes("}")) {
                    changed = true;
                    return `<w:t xml:space="preserve">${combined}</w:t>`;
                }
                return match;
            });
            xmlContent = newContent2;
        }

        zip.file(fileName, xmlContent);
    }
}

export async function generateCertificatePDF(
    templateName: string, 
    data: any, 
    outputFilename: string
): Promise<string> {
    const templatePath = path.join(process.cwd(), "public", "certificates", templateName);
    
    if (!fs.existsSync(templatePath)) {
        throw new Error("Template file not found. Please upload it in settings.");
    }

    const content = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(content);
    
    // Clean up XML before docxtemplater processes it
    cleanTemplateXml(zip);

    let doc;
    try {
        doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: { start: "{{", end: "}}" },
        });

        doc.render(data);
    } catch (error: any) {
        if (error.properties && error.properties.errors) {
            const errorMessages = error.properties.errors.map((e: any) => e.properties.explanation).join(", ");
            throw new Error(`Template Format Error: ${errorMessages}. Please clear formatting on your {{...}} tags in MS Word.`);
        }
        throw new Error(`Template Error: ${error.message || "Unknown error parsing template"}`);
    }

    const docxBuf = doc.getZip().generate({
        type: "nodebuffer",
        compression: "DEFLATE",
    });

    const outDir = path.join(process.cwd(), "public", "certificates", "issued");
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    // Write filled DOCX to a temp file, then convert via soffice CLI
    const tempDocxName = outputFilename.replace('.pdf', '.docx');
    const tempDocxPath = path.join(outDir, tempDocxName);
    fs.writeFileSync(tempDocxPath, docxBuf);

    try {
        const { execSync } = require("child_process");
        execSync(
            `/snap/bin/libreoffice --headless --convert-to pdf --outdir "${outDir}" "${tempDocxPath}"`,
            { timeout: 60000 }
        );

        const generatedPdfPath = path.join(outDir, outputFilename);
        
        // soffice names output based on input filename, rename if needed
        const sofficeOutputName = tempDocxName.replace('.docx', '.pdf');
        const sofficeOutputPath = path.join(outDir, sofficeOutputName);
        
        if (sofficeOutputPath !== generatedPdfPath && fs.existsSync(sofficeOutputPath)) {
            fs.renameSync(sofficeOutputPath, generatedPdfPath);
        }

        if (!fs.existsSync(generatedPdfPath)) {
            throw new Error("PDF conversion failed — LibreOffice did not produce output file.");
        }

        return `/certificates/issued/${outputFilename}`;
    } catch (convError: any) {
        throw new Error(`PDF Conversion Error: ${convError.message}`);
    } finally {
        // Clean up temp docx
        if (fs.existsSync(tempDocxPath)) {
            fs.unlinkSync(tempDocxPath);
        }
    }
}
