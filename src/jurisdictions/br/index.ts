/** Brasil (plan § 11.3): LexML (API SRU), DataJud (CNJ), STF/STJ dados abertos. Idioma: portugués. */
import type { Jurisdiction } from '../types';
import { DISCLAIMER_PT, makeCitationStyle } from '../_shared/citation';

export const BR_ENTITIES = [
  ['BR-AC', 'Acre'], ['BR-AL', 'Alagoas'], ['BR-AP', 'Amapá'], ['BR-AM', 'Amazonas'], ['BR-BA', 'Bahia'], ['BR-CE', 'Ceará'],
  ['BR-DF', 'Distrito Federal'], ['BR-ES', 'Espírito Santo'], ['BR-GO', 'Goiás'], ['BR-MA', 'Maranhão'], ['BR-MT', 'Mato Grosso'],
  ['BR-MS', 'Mato Grosso do Sul'], ['BR-MG', 'Minas Gerais'], ['BR-PA', 'Pará'], ['BR-PB', 'Paraíba'], ['BR-PR', 'Paraná'],
  ['BR-PE', 'Pernambuco'], ['BR-PI', 'Piauí'], ['BR-RJ', 'Rio de Janeiro'], ['BR-RN', 'Rio Grande do Norte'],
  ['BR-RS', 'Rio Grande do Sul'], ['BR-RO', 'Rondônia'], ['BR-RR', 'Roraima'], ['BR-SC', 'Santa Catarina'], ['BR-SP', 'São Paulo'],
  ['BR-SE', 'Sergipe'], ['BR-TO', 'Tocantins'],
] as const;

export const br: Jurisdiction = {
  code: 'br',
  name: 'Brasil',
  languages: ['pt', 'es'],
  defaultLanguage: 'pt',
  corpusScopes: ['br-federal', ...BR_ENTITIES.map(([c]) => c.toLowerCase())],
  hierarchy: [
    { level: 1, name: 'Constituição Federal de 1988', examples: ['Constituição da República Federativa do Brasil'] },
    { level: 2, name: 'Tratados de direitos humanos (art. 5º, § 3º)', examples: ['Convenção sobre os Direitos das Pessoas com Deficiência'] },
    { level: 3, name: 'Leis complementares e ordinárias', examples: ['Lei nº 13.709/2018 (LGPD)', 'CLT (Decreto-Lei nº 5.452/1943)', 'Código Civil'] },
    { level: 4, name: 'Decretos', examples: ['Decreto nº 10.474/2020'] },
    { level: 5, name: 'Portarias, resoluções e instruções normativas', examples: ['Instrução Normativa RFB'] },
    { level: 6, name: 'Constituições e leis estaduais', examples: ['Constituição do Estado de São Paulo'] },
    { level: 7, name: 'Leis municipais', examples: ['Lei Orgânica do Município'] },
  ],
  entities: BR_ENTITIES.map(([code, name]) => ({ code, name })),
  sources: [
    { id: 'lexml', name: 'LexML Brasil (Senado Federal)', kind: 'legislation', access: 'open-api', url: 'https://www.lexml.gov.br/', verifyUrl: 'https://www.lexml.gov.br/urn/{id}', notes: 'API SRU em XML e acervo em dados abertos; identificadores URN LexML.' },
    { id: 'planalto', name: 'Planalto · Legislação federal', kind: 'legislation', access: 'open-download', url: 'https://www.planalto.gov.br/ccivil_03/', notes: 'Texto compilado das leis federais.' },
    { id: 'datajud', name: 'DataJud (CNJ) · API pública', kind: 'jurisprudence', access: 'open-api', url: 'https://datajud-wiki.cnj.jus.br/api-publica/', notes: 'Metadados de processos com chave pública; base do monitoramento de tribunais.' },
    { id: 'stf', name: 'STF · Jurisprudência e dados abertos', kind: 'jurisprudence', access: 'open-download', url: 'https://portal.stf.jus.br/jurisprudencia/' },
    { id: 'dou', name: 'Diário Oficial da União', kind: 'gazette', access: 'open-download', url: 'https://www.in.gov.br/' },
  ],
  citation: makeCitationStyle({
    language: 'pt',
    constitution: 'Constituição Federal',
    instrumentLead: String.raw`Lei|C[óo]digo|Decreto|Constitui[çc][ãa]o|CLT|Consolida[çc][ãa]o|Portaria|Resolu[çc][ãa]o|Medida`,
    extra: [
      { kind: 'law', regex: /\bLei\s+(?:Complementar\s+)?n?[ºo°]?\s*([\d.]+\/\d{4})\b/gi },
      { kind: 'ruling', regex: /\b(?:RE|ADI|ADPF|ADC|HC|REsp|AgRg|MS)\s+n?[ºo°]?\s*([\d.]{3,9})\b/g },
      { kind: 'ruling', regex: /\bS[úu]mula\s+(?:Vinculante\s+)?(?:n[ºo°]?\s*)?(\d{1,4})\b/gi },
    ],
  }),
  legal: {
    privacyLaw: { name: 'Lei nº 13.709/2018 · Lei Geral de Proteção de Dados (LGPD)', url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm' },
    dataAuthority: 'ANPD · Autoridade Nacional de Proteção de Dados',
    disclaimer: DISCLAIMER_PT,
  },
};
export default br;
