/**
 * Plantillas de redacción de México (plan § 11.4 C). Texto base anclado a
 * artículos; el usuario las adapta y las revisa con un abogado. No sustituyen
 * asesoría legal.
 */
import type { DocumentTemplate } from '../types';

export const mxTemplates: DocumentTemplate[] = [
  {
    id: 'mx-contrato-trabajo-indeterminado',
    name: 'Contrato individual de trabajo por tiempo indeterminado',
    description: 'Contenido mínimo del artículo 25 de la Ley Federal del Trabajo.',
    area: 'labor',
    basis: ['Artículo 24 de la Ley Federal del Trabajo', 'Artículo 25 de la Ley Federal del Trabajo', 'Artículo 35 de la Ley Federal del Trabajo'],
    warnings: ['Las condiciones no pueden ser inferiores a las de la Ley Federal del Trabajo (artículo 56).', 'Si el patrón es persona moral, indica la denominación y quién la representa.'],
    fields: [
      { name: 'patron', label: 'Nombre o denominación del patrón', type: 'text', required: true },
      { name: 'patron_domicilio', label: 'Domicilio del patrón', type: 'text', required: true },
      { name: 'trabajador', label: 'Nombre del trabajador', type: 'text', required: true },
      { name: 'trabajador_datos', label: 'Nacionalidad, edad, sexo, estado civil, CURP y domicilio del trabajador', type: 'textarea', required: true },
      { name: 'puesto', label: 'Puesto y descripción del servicio', type: 'textarea', required: true },
      { name: 'lugar', label: 'Lugar o lugares donde se prestará el trabajo', type: 'text', required: true },
      { name: 'jornada', label: 'Duración de la jornada', type: 'text', required: true, placeholder: '8 horas diarias, de lunes a viernes de 9:00 a 18:00 con una hora de comida' },
      { name: 'salario', label: 'Salario (monto, forma y periodicidad de pago)', type: 'text', required: true, placeholder: '$15,000.00 mensuales, pagaderos quincenalmente por transferencia' },
      { name: 'dia_pago', label: 'Día y lugar de pago', type: 'text', required: true },
      { name: 'fecha_inicio', label: 'Fecha de inicio', type: 'date', required: true },
      { name: 'ciudad', label: 'Ciudad de firma', type: 'text', required: true },
      { name: 'fecha_firma', label: 'Fecha de firma', type: 'date', required: true },
    ],
    body: `# Contrato individual de trabajo por tiempo indeterminado

Contrato que celebran, por una parte, **{{patron}}**, con domicilio en {{patron_domicilio}} (en adelante "el Patrón"), y por la otra **{{trabajador}}** (en adelante "el Trabajador"), cuyos datos son: {{trabajador_datos}}; conforme a las siguientes

## Declaraciones

I. El Patrón declara que requiere los servicios del Trabajador para el puesto que se describe en la cláusula primera.

II. El Trabajador declara que tiene los conocimientos y la capacidad para desempeñar el puesto y que sus datos son los indicados.

## Cláusulas

**Primera. Servicios.** El Trabajador prestará sus servicios como {{puesto}}, con la diligencia y el cuidado que el puesto requiere (artículo 134 de la Ley Federal del Trabajo).

**Segunda. Duración.** La relación de trabajo es por tiempo indeterminado (artículo 35 de la Ley Federal del Trabajo) e inicia el {{fecha_inicio}}.

**Tercera. Lugar de trabajo.** Los servicios se prestarán en {{lugar}}.

**Cuarta. Jornada.** La jornada será de {{jornada}}, sin exceder los máximos legales (artículos 58 a 68 de la Ley Federal del Trabajo).

**Quinta. Salario.** El Patrón pagará al Trabajador {{salario}}, el {{dia_pago}} (artículos 82 a 89 de la Ley Federal del Trabajo).

**Sexta. Descansos, vacaciones y aguinaldo.** El Trabajador disfrutará de un día de descanso por cada seis de trabajo (artículo 69), de vacaciones conforme al artículo 76 con prima vacacional del veinticinco por ciento (artículo 80) y de aguinaldo de al menos quince días de salario (artículo 87), todos de la Ley Federal del Trabajo.

**Séptima. Capacitación y seguridad social.** El Patrón capacitará al Trabajador (artículo 153-A) y lo inscribirá en el Instituto Mexicano del Seguro Social (artículo 15 de la Ley del Seguro Social).

**Octava. Condiciones generales.** En lo no previsto se aplicará la Ley Federal del Trabajo; ninguna condición será inferior a la ley (artículo 56).

Firmado por duplicado en {{ciudad}}, el {{fecha_firma}}.

| El Patrón | El Trabajador |
|---|---|
| {{patron}} | {{trabajador}} |
`,
  },
  {
    id: 'mx-carta-poder-simple',
    name: 'Carta poder simple',
    description: 'Poder otorgado ante dos testigos para actos que no requieren poder notarial.',
    area: 'civil',
    basis: ['Artículo 2554 del Código Civil Federal', 'Artículo 2555 del Código Civil Federal'],
    warnings: ['No sirve para actos que exigen poder ante notario (artículo 2555 del Código Civil Federal): por ejemplo, actos de dominio sobre inmuebles o cuando el interés del negocio supera el equivalente que fije la ley.', 'Cada institución puede exigir su propio formato.'],
    fields: [
      { name: 'otorgante', label: 'Nombre de quien otorga el poder', type: 'text', required: true },
      { name: 'apoderado', label: 'Nombre del apoderado', type: 'text', required: true },
      { name: 'facultades', label: 'Actos concretos que se autorizan', type: 'textarea', required: true, placeholder: 'Recoger a mi nombre el documento X en la oficina Y y firmar el acuse correspondiente' },
      { name: 'ciudad', label: 'Ciudad', type: 'text', required: true },
      { name: 'fecha', label: 'Fecha', type: 'date', required: true },
      { name: 'testigo1', label: 'Nombre del primer testigo', type: 'text', required: true },
      { name: 'testigo2', label: 'Nombre del segundo testigo', type: 'text', required: true },
    ],
    body: `# Carta poder

{{ciudad}}, {{fecha}}.

Por la presente, **{{otorgante}}** otorga a **{{apoderado}}** poder amplio, cumplido y bastante para que a su nombre y representación realice los siguientes actos: {{facultades}}.

El apoderado podrá hacer valer este poder ante quien corresponda, con las limitaciones señaladas, conforme a los artículos 2554 y 2555 del Código Civil Federal.

| Otorgante | Apoderado |
|---|---|
| {{otorgante}} | {{apoderado}} |

| Testigo | Testigo |
|---|---|
| {{testigo1}} | {{testigo2}} |
`,
  },
  {
    id: 'mx-solicitud-acceso-informacion',
    name: 'Solicitud de acceso a la información pública',
    description: 'Escrito con los requisitos del artículo 124 de la Ley General de Transparencia y Acceso a la Información Pública.',
    area: 'administrative',
    basis: ['Artículo 6 constitucional', 'Artículo 124 de la Ley General de Transparencia y Acceso a la Información Pública', 'Artículo 132 de la Ley General de Transparencia y Acceso a la Información Pública'],
    warnings: ['No es necesario acreditar interés ni justificar el uso de la información (artículo 124).', 'El sujeto obligado debe responder en veinte días hábiles, prorrogables por diez (artículo 132).'],
    fields: [
      { name: 'sujeto_obligado', label: 'Sujeto obligado (dependencia)', type: 'text', required: true },
      { name: 'solicitante', label: 'Nombre o seudónimo del solicitante', type: 'text', required: true },
      { name: 'medio', label: 'Medio para recibir notificaciones', type: 'text', required: true, placeholder: 'correo electrónico ejemplo@correo.mx' },
      { name: 'informacion', label: 'Descripción clara de la información solicitada', type: 'textarea', required: true },
      { name: 'modalidad', label: 'Modalidad de entrega', type: 'select', required: true, options: [{ value: 'electrónica', label: 'Electrónica' }, { value: 'consulta directa', label: 'Consulta directa' }, { value: 'copia simple', label: 'Copia simple' }, { value: 'copia certificada', label: 'Copia certificada' }] },
      { name: 'ciudad', label: 'Ciudad', type: 'text', required: true },
      { name: 'fecha', label: 'Fecha', type: 'date', required: true },
    ],
    body: `# Solicitud de acceso a la información pública

**Sujeto obligado:** {{sujeto_obligado}}
**Solicitante:** {{solicitante}}
**Medio para recibir notificaciones:** {{medio}}
**Lugar y fecha:** {{ciudad}}, {{fecha}}

Con fundamento en el artículo 6 de la Constitución Política de los Estados Unidos Mexicanos y en los artículos 4, 122 y 124 de la Ley General de Transparencia y Acceso a la Información Pública, solicito la siguiente información:

{{informacion}}

Solicito que la información se entregue en la modalidad de **{{modalidad}}**.

Hago notar que, conforme al artículo 124, no se me puede exigir que acredite interés alguno ni que justifique el uso que daré a la información, y que la respuesta debe emitirse en el plazo del artículo 132.

Atentamente,

{{solicitante}}
`,
  },
];
