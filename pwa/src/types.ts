export interface Exhibitor {
  id: string;
  nome: string;
  url: string;
  url_canonical: string;
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
  regione: string;
  paese: string;
  telefono: string;
  email: string;
  sito_web: string;
  padiglione: string;
  stand: string;
  coespositore: string;
  espositore_principale: string;
  marchi: string;
  categorie: string;
  descrizione: string;
}

export type CompanySize = "grande" | "media" | "piccola" | "consorzio" | "n.d.";

export interface VisitState {
  visited: boolean;
  visitedAt?: number;
  notes?: string;
  tags?: string[];
  size?: CompanySize;
}

export type AllVisits = Record<string, VisitState>;

export type ViewName = "list" | "map" | "dashboard" | "export";
