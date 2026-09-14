import { describe, expect, it } from 'vitest';
import { areaFromSubjects, articleNumber, parseLeyChile, parseXml, stripMarginNotes, toLegalDocumentCl, typeFromKind } from '../leychile';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<Norma normaId="207436" fechaVersion="2024-05-01" fechaPublicacion="2003-01-16" derogado="false">
  <Identificador><TiposNumeros><TipoNumero><Tipo>DFL</Tipo><Numero>1</Numero></TipoNumero></TiposNumeros>
    <Organismos><Organismo>MINISTERIO DEL TRABAJO Y PREVISIÓN SOCIAL</Organismo></Organismos></Identificador>
  <Metadatos><TituloNorma>FIJA EL TEXTO REFUNDIDO, COORDINADO Y SISTEMATIZADO DEL CÓDIGO DEL TRABAJO</TituloNorma>
    <Materias><Materia>Trabajo &amp; empleo</Materia></Materias></Metadatos>
  <EstructurasFuncionales>
    <EstructuraFuncional id="t1" tipoParte="Título" nivel="1"><Texto>TÍTULO PRELIMINAR</Texto>
      <EstructurasFuncionales>
        <EstructuraFuncional id="a1" tipoParte="Artículo" nivel="2"><Texto><![CDATA[Artículo 1.- Las relaciones laborales entre los empleadores y los trabajadores se regularán por este Código.]]></Texto></EstructuraFuncional>
        <EstructuraFuncional id="a2" tipoParte="Artículo" nivel="2"><Texto>Artículo 2 bis.- Reconócese la función social que cumple el trabajo.</Texto></EstructuraFuncional>
      </EstructurasFuncionales>
    </EstructuraFuncional>
    <EstructuraFuncional id="c1" tipoParte="Capítulo" nivel="1"><Texto>Capítulo I De la jornada</Texto>
      <EstructurasFuncionales>
        <EstructuraFuncional id="a22" tipoParte="Artículo"><Texto>Artículo 22.- La duración de la jornada ordinaria de trabajo no excederá de cuarenta horas semanales.</Texto></EstructuraFuncional>
      </EstructurasFuncionales>
    </EstructuraFuncional>
    <EstructuraFuncional id="tr" tipoParte="Artículos transitorios" nivel="1"><Texto>ARTÍCULOS TRANSITORIOS</Texto>
      <EstructurasFuncionales>
        <EstructuraFuncional id="tr1" tipoParte="Artículo"><Texto>Artículo primero.- Esta ley entrará en vigencia el día primero del mes siguiente.</Texto></EstructuraFuncional>
      </EstructurasFuncionales>
    </EstructuraFuncional>
  </EstructurasFuncionales>
</Norma>`;

describe('leychile adapter', () => {
  it('parses XML with CDATA, entities and nesting', () => {
    const root = parseXml('<a x="1"><b>t &amp; u</b><c/><![CDATA[<raw>]]></a>');
    const a = root.children[0]!;
    expect(a.attrs.x).toBe('1');
    expect(a.children.map((c) => c.tag)).toEqual(['b', 'c']);
    expect(a.children[0]?.text).toBe('t & u');
    expect(a.text).toBe('<raw>');
  });

  it('extracts article numbers including bis and ordinal words', () => {
    expect(articleNumber('Artículo 12 bis.- texto')).toBe('12 bis');
    expect(articleNumber('Art. 3°.- texto')).toBe('3');
    expect(articleNumber('Artículo único.- texto')).toBe('único');
    expect(articleNumber('Artículo 1.o Las relaciones')).toBe('1');
    expect(articleNumber('Art.2.o Reconócese')).toBe('2');
    expect(articleNumber('Artículo 3º bis.- El consumidor')).toBe('3 bis');
    expect(articleNumber('Artículo 20 BIS.- DEROGADO')).toBe('20 bis');
    expect(articleNumber('Artículo 1º.- Las personas')).toBe('1');
    expect(articleNumber('Nada')).toBeNull();
  });

  it('turns a norm into structured content with transitorios marked', () => {
    const norm = parseLeyChile(XML);
    expect(norm.id).toBe('207436');
    expect(norm.kind).toBe('DFL');
    expect(norm.subjects).toEqual(['Trabajo & empleo']);
    const articles = norm.content.filter((c) => c.type === 'article');
    expect(articles.map((a) => a.number)).toEqual(['1', '2 bis', '22', 'primero']);
    expect(articles[0]?.content).toMatch(/^Las relaciones laborales/);
    expect(articles[0]?.parent).toBe(norm.content[0]?.id);
    expect(norm.content[0]?.type).toBe('title');
    expect(norm.content[0]?.children).toHaveLength(2);
    expect(articles[3]?.transitory).toBe(true);
    expect(articles[2]?.transitory).toBeUndefined();
  });

  it('classifies area and type from subjects and kind', () => {
    expect(areaFromSubjects(['Trabajo'], '')).toBe('labor');
    expect(areaFromSubjects([], 'Ley sobre impuesto a la renta')).toBe('tax');
    expect(areaFromSubjects([], 'Ley de tránsito')).toBe('civil');
    expect(typeFromKind('DFL', 'Código del Trabajo')).toEqual({ type: 'code', hierarchy: 3 });
    expect(typeFromKind('Ley', 'Constitución Política')).toEqual({ type: 'constitution', hierarchy: 1 });
    expect(typeFromKind('Decreto', 'Reglamento X')).toEqual({ type: 'regulation', hierarchy: 4 });
  });

  it('builds a LegalDocument with jurisdiction cl and renamed ids', () => {
    const doc = toLegalDocumentCl(parseLeyChile(XML), 'cl-codigo-trabajo');
    expect(doc.jurisdiction).toBe('cl');
    expect(doc.type).toBe('code');
    expect(doc.primaryArea).toBe('labor');
    expect(doc.status).toBe('active');
    expect(doc.lastReform).toBe('2024-05-01');
    expect(doc.officialUrl).toContain('idNorma=207436');
    expect(doc.content[0]?.id.startsWith('cl-codigo-trabajo-')).toBe(true);
    expect(doc.content.find((c) => c.number === '22')?.id).toBe('cl-codigo-trabajo-art-22');
    expect(doc.fullText).toContain('Artículo 22. La duración');
  });

  it('drops the right-hand reference column that LeyChile interleaves with the text', () => {
    const raw = [
      '     Art.2.o Reconócese la función social que cumple el             L. 18.620',
      'trabajo y la libertad de las personas para contratar y              ART. PRIMERO',
      'dedicar su esfuerzo a la labor lícita que elijan.                   Art. 2º',
      '',
      '     La familia es el núcleo                  CPR Art. 1° D.O.',
      'fundamental de la sociedad.                                         24.10.1980',
      '                                         24.10.1980',
      '     El Estado reconoce y ampara.',
    ].join('\n');
    const out = stripMarginNotes(raw);
    expect(out).not.toMatch(/18\.620|ART\. PRIMERO|D\.O\.|24\.10\.1980/);
    expect(out).toContain('Reconócese la función social que cumple el\ntrabajo y la libertad');
    expect(out).toContain('La familia es el núcleo\nfundamental de la sociedad.');
    expect(out).toContain('El Estado reconoce y ampara.');
  });

  it('keeps walking below a decree article that nests a whole code', () => {
    const xml = `<Norma normaId="1"><EstructurasFuncionales>
      <EstructuraFuncional tipoParte="Artículo"><Texto>Artículo 2.- Fíjase el siguiente texto refundido.</Texto>
        <EstructurasFuncionales>
          <EstructuraFuncional tipoParte="Título"><Texto>TÍTULO PRELIMINAR</Texto>
            <EstructurasFuncionales><EstructuraFuncional tipoParte="Artículo"><Texto>Art. 1.o La ley es una declaración de la voluntad soberana.</Texto></EstructuraFuncional></EstructurasFuncionales>
          </EstructuraFuncional>
        </EstructurasFuncionales>
      </EstructuraFuncional>
      <EstructuraFuncional tipoParte="Disposición Transitoria" transitorio="transitorio"><Texto>Primera.- Vigencia.</Texto></EstructuraFuncional>
    </EstructurasFuncionales></Norma>`;
    const norm = parseLeyChile(xml);
    const arts = norm.content.filter((c) => c.type === 'article');
    expect(arts.map((a) => a.number)).toEqual(['2', '1', '3']);
    expect(arts[1]?.content).toBe('La ley es una declaración de la voluntad soberana.');
    expect(arts[2]?.transitory).toBe(true);
  });
});
