import type { CompanySize, Exhibitor } from "../types";

// Simple heuristic on company name / legal form. Manual override stored in VisitState.size.
const RULES: Array<{ test: RegExp; size: CompanySize }> = [
  { test: /\bCONSORZIO|CONSORTIUM|GROUP\b/i, size: "consorzio" },
  { test: /\bSPA\b|S\.P\.A\.|S\.\s*P\.\s*A\.|SOC\.?\s*PER\s*AZIONI/i, size: "grande" },
  { test: /\bSRL\b|S\.R\.L\.|GMBH|LTD|LLC|SARL|S\.A\.|SPA\s*SOCIETA'?\s*BENEFIT/i, size: "media" },
  { test: /\bSAS\b|S\.A\.S\.|SNC\b|S\.N\.C\.|S\.S\.|AZ\.?\s*AGRICOLA|AZIENDA\s+AGRICOLA|COOP|SOC\.?\s*COOP|DITTA\s+INDIVIDUALE|DI\s+[A-Z]+\s+[A-Z]+$/i, size: "piccola" },
];

export function inferSize(e: Exhibitor): CompanySize {
  const haystack = e.nome || "";
  for (const rule of RULES) if (rule.test.test(haystack)) return rule.size;
  return "n.d.";
}

export const SIZE_LABEL: Record<CompanySize, string> = {
  grande: "Grande (SPA)",
  media: "Media (SRL)",
  piccola: "Piccola (Az. agricola, SAS, SNC, Coop)",
  consorzio: "Consorzio / Group",
  "n.d.": "Non determinata",
};
