import type { PlanNature } from './plan-classification';

/** Optional practical interventions, not a regulatory calendar. IDs are stable across catalog versions. */
export const MAINTENANCE_SUGGESTIONS_VERSION = 2;
export type MaintenanceSuggestion = {
  id: string; group: string; name: string; description: string;
  typeCodes: string[]; nature: PlanNature; origin: 'unspecified';
  frequency: 'quarterly' | 'annual' | null; reference: null;
};
const task = (id: string, group: string, name: string, description: string, typeCodes: string[], nature: PlanNature = 'preventive', frequency: MaintenanceSuggestion['frequency'] = null): MaintenanceSuggestion =>
  ({ id, group, name, description, typeCodes, nature, origin: 'unspecified', frequency, reference: null });
const ext = ['EXT-POLVO','EXT-CO2','extinguisher_co2','extinguisher_powder','extinguisher_water'];
const bie = ['BIE','bie_25','bie_45'];
const det = ['DETECCION-INC','fire_alarm','smoke_detector'];
const bt = ['CUADRO-BT','INST-BT'];
const clima = ['CLIMA-SPLIT','CLIMA-VRF','BOMBA-CALOR','ENFRIADORA','INST-FRIGO'];
const veh = ['TURISMO','FURGONETA','CAMION','vehicle'];
const car = ['CARRETILLA','PLATAFORMA'];
const med = ['TERMOMETRO','MANOMETRO','MULTIMETRO','BALANZA','CALIBRE','MICROMETRO'];
const orientative = ' Frecuencia orientativa: validar con documentación del equipo y requisitos aplicables; no implica obligación legal universal.';

export const MAINTENANCE_SUGGESTIONS: MaintenanceSuggestion[] = [
  task('EXT', 'PCI y emergencias', 'Revisión trimestral de extintores', 'Comprobar acceso, señalización, estado exterior, precinto e indicador de presión cuando exista.' + orientative, ext, 'preventive', 'quarterly'),
  task('EXT-ANUAL', 'PCI y emergencias', 'Mantenimiento anual de extintores', 'Revisar estado y componentes, agente extintor y funcionamiento por personal competente según equipo.' + orientative, ext, 'preventive', 'annual'),
  task('EXT-PRESION', 'PCI y emergencias', 'Prueba de presión / retimbrado de extintores según aplicación', 'Confirmar si procede la prueba, su método y periodicidad según recipiente, documentación y ámbito aplicable; a definir por empresa.', ext),
  task('BIE', 'PCI y emergencias', 'Revisión trimestral de BIE', 'Comprobar acceso, manguera, devanadera, boquilla y conexiones.' + orientative, bie, 'preventive', 'quarterly'),
  task('BIE-ANUAL', 'PCI y emergencias', 'Mantenimiento anual de BIE', 'Revisar componentes y funcionamiento, estanqueidad y condiciones de suministro según sistema.' + orientative, bie, 'preventive', 'annual'),
  task('BIE-MANGUERA', 'PCI y emergencias', 'Prueba periódica de manguera de BIE según aplicación', 'Confirmar aplicabilidad, presión de ensayo, método y periodicidad con documentación técnica; a definir por empresa.', bie),
  task('DET', 'PCI y emergencias', 'Revisión trimestral de detección y alarma PCI', 'Comprobar central, avisos, alimentación y pruebas funcionales previstas por el sistema.' + orientative, det, 'preventive', 'quarterly'),
  task('DET-ANUAL', 'PCI y emergencias', 'Mantenimiento anual de detección y alarma PCI', 'Revisar detectores, pulsadores, avisadores y conexiones; probar funciones conforme a documentación.' + orientative, det, 'preventive', 'annual'),
  task('PCI-INSPECCION', 'PCI y emergencias', 'Inspección periódica de instalación PCI por organismo de control según aplicación', 'Verificar si la instalación requiere inspección por organismo competente y definir alcance y frecuencia conforme al ámbito acreditado; a definir por empresa.', [...ext,...bie,...det]),
  task('BT', 'Electricidad', 'Revisión preventiva de instalación de baja tensión', 'Revisar cuadros, conexiones, protecciones y estado de instalación por personal competente; frecuencia a definir por empresa.', bt),
  task('BT-INSPECCION', 'Electricidad', 'Inspección periódica de baja tensión por organismo de control según aplicación', 'Confirmar categoría de instalación, ámbito y periodicidad aplicable; no existe una frecuencia quinquenal universal. A definir por empresa.', bt),
  task('TIERRA', 'Electricidad', 'Comprobación de puesta a tierra', 'Comprobar continuidad y medir puesta a tierra con método y criterios adecuados a la instalación; frecuencia a definir por empresa.', bt),
  task('CLI', 'Climatización y refrigeración', 'Mantenimiento periódico de climatización y refrigeración', 'Revisar intercambiadores, drenajes, conexiones y funcionamiento según equipo, fabricante y uso; frecuencia a definir por empresa.', clima),
  task('CLI-FILTROS', 'Climatización y refrigeración', 'Limpieza / sustitución de filtros de climatización', 'Inspeccionar filtros y limpiar o sustituir según estado, calidad del aire y fabricante; frecuencia a definir por empresa.', clima),
  task('CLI-FUGAS', 'Climatización y refrigeración', 'Control de fugas de refrigerante según aplicabilidad', 'Confirmar refrigerante, carga, características del circuito y requisitos aplicables antes de fijar método y frecuencia; a definir por empresa.', clima),
  task('VEH-INSPECCION', 'Vehículos y equipos móviles', 'Inspección técnica periódica de vehículos', 'Confirmar categoría, uso y ámbito de inspección técnica (ITV es un ejemplo local); frecuencia a definir por empresa conforme a requisitos aplicables.', veh),
  task('VEH', 'Vehículos y equipos móviles', 'Mantenimiento periódico de vehículo según fabricante', 'Realizar operaciones de servicio según fabricante, uso y kilometraje registrado fuera de esta plantilla; frecuencia temporal a definir por empresa.', veh),
  task('VEH-SEGURIDAD', 'Vehículos y equipos móviles', 'Revisión de seguridad y neumáticos de vehículo', 'Comprobar frenos, luces, neumáticos, presiones y elementos de seguridad según uso; frecuencia a definir por empresa.', veh),
  task('CAR-PREUSO', 'Vehículos y equipos móviles', 'Inspección preuso de carretilla', 'Antes del uso, comprobar frenos, dirección, horquillas, neumáticos, fugas y avisadores. Control por uso: no equivale a una frecuencia mensual; programación a definir por empresa.', car),
  task('CAR-MANT', 'Vehículos y equipos móviles', 'Mantenimiento periódico de carretilla', 'Revisar lubricación, sistemas hidráulicos, batería o motor y operaciones de fabricante según horas de uso; frecuencia temporal a definir por empresa.', car),
  task('CAR', 'Vehículos y equipos móviles', 'Revisión de seguridad de carretilla', 'Inspeccionar horquillas, cadenas, frenos, límites y dispositivos de seguridad por personal competente; frecuencia a definir por empresa.', car),
  task('COMP', 'Presión y aire comprimido', 'Mantenimiento de compresor de aire', 'Revisar filtros, lubricación, fugas, drenaje y dispositivos de seguridad conforme a fabricante y uso; frecuencia a definir por empresa.', ['COMPRESOR','DEPOSITO-AIRE','INST-AIRE']),
  task('PRESION-INSPECCION', 'Presión y aire comprimido', 'Inspección periódica de equipo a presión según categoría', 'Confirmar categoría, documentación y ámbito aplicable antes de definir nivel, agente y periodicidad de inspección; a definir por empresa.', ['COMPRESOR','DEPOSITO-AIRE','INST-AIRE']),
  task('MED', 'Instrumentos de medida y control', 'Calibración de instrumento de medida según uso', 'Definir magnitud, rango, incertidumbre requerida y trazabilidad según uso previsto; no imponer calibración a todo instrumento. Frecuencia a definir por empresa.', med, 'calibration'),
  task('MED-VERIFICACION', 'Instrumentos de medida y control', 'Verificación interna de instrumento de medida', 'Comparar con referencia adecuada y documentar método y criterio de aceptación según uso; frecuencia a definir por empresa.', med, 'calibration'),
  task('BOTIQUIN', 'PCI y emergencias', 'Revisión de contenido y caducidades de botiquín', 'Comprobar dotación definida por empresa, integridad, disponibilidad y caducidades; frecuencia a definir por empresa.', ['BOTIQUIN']),
  task('DEA', 'PCI y emergencias', 'Revisión de estado, batería y electrodos de DEA', 'Comprobar indicador de disponibilidad, batería, integridad y caducidad de electrodos conforme al fabricante; frecuencia a definir por empresa.', ['DEA']),
  task('ELEV-MANT', 'Maquinaria y elevación', 'Mantenimiento preventivo periódico de puente grúa / polipasto', 'Revisar lubricación, mecanismos, frenos y funcionamiento conforme al fabricante y uso; frecuencia a definir por empresa.', ['PUENTE-GRUA']),
  task('ELEV', 'Maquinaria y elevación', 'Inspección de seguridad y elementos de elevación de puente grúa / polipasto', 'Inspeccionar cables, cadenas, ganchos, frenos, límites y dispositivos de seguridad por personal competente; frecuencia a definir por empresa.', ['PUENTE-GRUA']),
  task('ASCENSOR-MANT', 'Maquinaria y elevación', 'Mantenimiento periódico de ascensor / montacargas', 'Revisar mecanismos, puertas, funcionamiento y dispositivos de seguridad por personal competente según equipo; frecuencia a definir por empresa.', ['ASCENSOR']),
  task('SAI', 'Energía y generación', 'Revisión funcional y de baterías de SAI / UPS', 'Comprobar baterías, alarmas, ventilación y respuesta ante pérdida de alimentación según fabricante; frecuencia a definir por empresa.', ['SAI']),
  task('FV', 'Energía y generación', 'Revisión de módulos, inversores y conexiones fotovoltaicas', 'Revisar módulos, soportes, inversores, conexiones, cableado y protecciones; frecuencia a definir por empresa.', ['FV','INVERSOR']),
  task('GRUPO-PRUEBA', 'Energía y generación', 'Prueba de funcionamiento de grupo electrógeno', 'Comprobar arranque, alarmas y funcionamiento con condiciones de prueba seguras definidas por fabricante; frecuencia a definir por empresa.', ['GRUPO-ELEC']),
  task('GRUPO-MANT', 'Energía y generación', 'Mantenimiento periódico de grupo electrógeno', 'Revisar lubricación, filtros, refrigeración, combustible y batería según fabricante y horas de uso; frecuencia temporal a definir por empresa.', ['GRUPO-ELEC']),
  task('ALUMBRADO', 'PCI y emergencias', 'Comprobación funcional y de autonomía de alumbrado de emergencia', 'Comprobar encendido, señalización y autonomía mediante ensayo seguro conforme al equipo; frecuencia a definir por empresa.', ['ALUMBRADO-EMERG']),
  task('ESTANTERIA', 'Maquinaria y elevación', 'Inspección de estado y estabilidad de estanterías industriales', 'Revisar golpes, deformaciones, anclajes, estabilidad y señalización de cargas según instalación y uso; frecuencia a definir por empresa.', ['ESTANTERIA']),
  task('MED-VISUAL', 'Instrumentos de medida y control', 'Verificación visual y funcional de flexómetro / instrumento según uso', 'Comprobar integridad, legibilidad, movimiento y respuesta adecuados al uso. No exige calibración por defecto; frecuencia a definir por empresa.', [...med,'FLEXOMETRO'], 'calibration'),
];

export const suggestionPlanCode = (s: MaintenanceSuggestion) => `SUG-${s.id}`;
export function suggestionAlreadyApplied(s: MaintenanceSuggestion, plans: Array<{ code: string; name: string }>) {
  return plans.some(p => p.code.trim().toUpperCase() === suggestionPlanCode(s) || p.name.trim().toLocaleLowerCase('es') === s.name.toLocaleLowerCase('es'));
}
