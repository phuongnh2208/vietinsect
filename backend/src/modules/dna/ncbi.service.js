const axios = require("axios");

function parseGenBankDate(raw) {
  if (!raw) return null;
  const months = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  };
  const m = String(raw).trim().match(/(\d{1,2})-([A-Z]{3})-(\d{4})/i);
  if (m && months[m[2].toUpperCase()]) {
    return `${m[3]}-${months[m[2].toUpperCase()]}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

function detectGeneMarker(flatText = "") {
  const geneQual = flatText.match(/\/gene="([^"]+)"/i);
  if (geneQual) {
    const g = geneQual[1].trim().toUpperCase();
    if (g === "COX1" || g === "CO1" || g === "COI") return "COI";
    return g.slice(0, 45);
  }
  if (/COI|COX1|CO1|cytochrome\s+c?\s*oxidase\s+subunit\s+(I|1)\b/i.test(flatText)) return "COI";
  if (/internal\s+transcribed\s+spacer\s+2|\bITS2\b/i.test(flatText)) return "ITS2";
  if (/\b16S\b/i.test(flatText)) return "16S";
  if (/\b18S\b/i.test(flatText)) return "18S";
  if (/\b28S\b/i.test(flatText)) return "28S";
  if (/cytochrome\s+b|\bcytb\b/i.test(flatText)) return "CytB";
  return "COI";
}

/**
 * Parse 1 khối GenBank Flatfile (chuẩn quốc tế INSDC: NCBI GenBank / DDBJ / ENA)
 */
function parseGenBankFlatEntry(entryText) {
  if (!entryText || !entryText.includes("LOCUS")) return null;

  const locusDateMatch = entryText.match(/^LOCUS\s+\S+.*?(\d{1,2}-[A-Z]{3}-\d{4})/m);
  const subDateMatch = entryText.match(/Submitted\s*\((\d{1,2}-[A-Z]{3}-\d{4})\)/i);
  const accMatch = entryText.match(/^ACCESSION\s+(\S+)/m);
  const verMatch = entryText.match(/^VERSION\s+(\S+)/m);

  const defMatch = entryText.match(/^DEFINITION\s+([\s\S]*?)(?=\n[A-Z]{2,})/m);
  const definition = defMatch ? defMatch[1].replace(/\s+/g, " ").trim() : null;

  const orgBlockMatch = entryText.match(/^\s+ORGANISM\s+([^\r\n]+)\r?\n([\s\S]*?)(?=\n[A-Z])/m);
  const organism = orgBlockMatch ? orgBlockMatch[1].trim() : null;
  const lineageRaw = orgBlockMatch ? orgBlockMatch[2].replace(/[.\r\n]/g, " ") : "";
  const lineage = lineageRaw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const authorsMatch = entryText.match(/^\s+AUTHORS\s+([\s\S]*?)(?=\n\s+[A-Z]{3,}|\n[A-Z])/m);
  const authorName = authorsMatch ? authorsMatch[1].replace(/\s+/g, " ").trim() : null;

  const primerMatch = entryText.match(/\/PCR_primers="([\s\S]*?)"/i);
  const primersInfo = primerMatch ? primerMatch[1].replace(/\s+/g, " ").trim() : null;

  const voucherMatch = entryText.match(/\/specimen_voucher="([^"]+)"/i);
  const voucher = voucherMatch ? voucherMatch[1].trim() : "";

  const boldMatch =
    entryText.match(/BOLD:([A-Za-z0-9_-]+)/) || voucher.match(/\b([A-Z]{3,6}\d{3,6}-\d{2})\b/);
  const boldProcessId =
    boldMatch && !boldMatch[1].startsWith("AAA") ? boldMatch[1].slice(0, 50) : null;
  const binMatch = entryText.match(/BOLD:(AAA[A-Z0-9]{4}|[A-Z]{3}\d{4})/);

  const originSplit = entryText.split(/^ORIGIN[^\r\n]*\r?\n/m);
  const rawOrigin = originSplit[1] ? originSplit[1].split(/^\/\//m)[0] : "";
  const fastaSequence = rawOrigin.replace(/[^a-zA-Z]/g, "").toUpperCase();

  const accession = verMatch ? verMatch[1].trim() : accMatch ? accMatch[1].trim() : null;
  if (!accession || !fastaSequence) return null;

  return {
    baseAccession: accMatch ? accMatch[1].trim().toUpperCase() : accession.split(".")[0].toUpperCase(),
    genbankAccession: accession.slice(0, 40),
    scientificNameVerbatim: organism,
    lineage,
    geneMarker: detectGeneMarker(entryText),
    sequenceLengthBp: fastaSequence.length,
    fastaSequence,
    submissionDate: parseGenBankDate(subDateMatch?.[1] || locusDateMatch?.[1]),
    authorName: authorName ? authorName.slice(0, 255) : null,
    primersInfo: primersInfo ? primersInfo.slice(0, 1000) : null,
    boldProcessId,
    binUri: binMatch ? `BOLD:${binMatch[1]}` : null,
    notes: [definition, voucher ? `Voucher: ${voucher}` : null].filter(Boolean).join(" | "),
    sourceDb: boldProcessId ? "BOLD" : "NCBI",
  };
}

/**
 * Tải nhiều mã GenBank Accession cùng lúc qua cổng INSDC Châu Á - Thái Bình Dương (DDBJ GetEntry ~0.8s)
 */
async function fetchGenBankBatch(accessions) {
  const cleanIds = accessions
    .map((a) => String(a || "").trim().split(".")[0].toUpperCase())
    .filter((a) => /^[A-Z]{1,2}_?\d{5,8}$/.test(a));
  if (cleanIds.length === 0) return [];

  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data } = await axios.get(
        `https://getentry.ddbj.nig.ac.jp/getentry/na/${cleanIds.join(",")}`,
        {
          timeout: 15000,
          signal: AbortSignal.timeout(15000),
          responseType: "text",
        },
      );

      const rawText = String(data || "");
      if (!rawText.includes("LOCUS")) return [];

      return rawText
        .split(/\n\/\/\s*\r?\n?/)
        .map((block) => parseGenBankFlatEntry(`${block}\n//`))
        .filter(Boolean);
    } catch (err) {
      lastErr = err;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    }
  }
  throw lastErr;
}

async function fetchGenBankByAccession(accessionRaw) {
  const entries = await fetchGenBankBatch([accessionRaw]);
  return entries[0] || null;
}

module.exports = {
  fetchGenBankByAccession,
  fetchGenBankBatch,
  parseGenBankFlatEntry,
};
