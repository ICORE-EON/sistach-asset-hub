import type { PlanNature } from './plan-classification';

/** Practical tasks, not a regulatory calendar. No frequency or legal origin is inferred. */
export type MaintenanceSuggestion = {
  id: string; group: string; name: string; description: string;
  typeCodes: string[]; nature: PlanNature; origin: 'unspecified'; frequency: null; reference: null;
};
const task = (id: string, group: string, name: string, description: string, typeCodes: string[], nature: PlanNature = 'preventive'): MaintenanceSuggestion =>
  ({ id, group, name, description, typeCodes, nature, origin: 'unspecified', frequency: null, reference: null });

export const MAINTENANCE_SUGGESTIONS: MaintenanceSuggestion[] = [
  task('EXT', 'PCI', 'Revisión de extintores', 'Comprobar accesibilidad, señalización, estado exterior, precinto e indicador de presión cuando exista.', ['EXT-POLVO','EXT-CO2','extinguisher_co2','extinguisher_powder','extinguisher_water']),
  task('BIE', 'PCI', 'Revisión de BIE', 'Comprobar acceso, manguera, devanadera, boquilla y estado de las conexiones.', ['BIE','bie_25','bie_45']),
  task('DET', 'PCI', 'Revisión de detección y alarma', 'Comprobar central, avisos, alimentación y pruebas funcionales según documentación del sistema.', ['DETECCION-INC','fire_alarm','smoke_detector']),
  task('CLI', 'Climatización', 'Mantenimiento de climatización', 'Revisar filtros, intercambiadores, drenajes, conexiones y funcionamiento según equipo y fabricante.', ['CLIMA-SPLIT','CLIMA-VRF','BOMBA-CALOR','ENFRIADORA','INST-FRIGO']),
  task('BT', 'Electricidad', 'Revisión de instalación BT', 'Revisar cuadros, conexiones, protecciones y estado de la instalación por personal competente.', ['CUADRO-BT','INST-BT']),
  task('TIERRA', 'Electricidad', 'Comprobación de puesta a tierra', 'Comprobar continuidad y mediciones de puesta a tierra según características de la instalación.', ['INST-BT','CUADRO-BT']),
  task('FV', 'Energía', 'Revisión fotovoltaica', 'Revisar módulos, soportes, cableado, protecciones e inversor.', ['FV','INVERSOR']),
  task('SAI', 'Energía', 'Revisión de SAI', 'Comprobar baterías, alarmas, ventilación y prueba funcional conforme al fabricante.', ['SAI']),
  task('VEH', 'Vehículos', 'Mantenimiento de vehículo', 'Revisar frenos, neumáticos, fluidos, luces y mantenimiento según fabricante y uso.', ['TURISMO','FURGONETA','CAMION','vehicle']),
  task('CAR', 'Vehículos', 'Revisión de carretilla', 'Revisar frenos, dirección, horquillas, cadenas, neumáticos y dispositivos de seguridad.', ['CARRETILLA','PLATAFORMA']),
  task('COMP', 'Presión', 'Mantenimiento de compresor', 'Revisar filtros, lubricación, fugas, drenaje y dispositivos de seguridad según fabricante.', ['COMPRESOR','DEPOSITO-AIRE','INST-AIRE']),
  task('ELEV', 'Elevación', 'Revisión de equipo de elevación', 'Revisar elementos de elevación, frenos, límites y dispositivos de seguridad por personal competente.', ['PUENTE-GRUA','ASCENSOR']),
  task('MED', 'Medida', 'Calibración o verificación de instrumento', 'Confirmar magnitudes, rango, criterio de aceptación y método según uso previsto.', ['TERMOMETRO','MANOMETRO','MULTIMETRO','BALANZA','CALIBRE','MICROMETRO','FLEXOMETRO'], 'calibration'),
];

export const suggestionPlanCode = (s: MaintenanceSuggestion) => `SUG-${s.id}`;
export function suggestionAlreadyApplied(s: MaintenanceSuggestion, plans: Array<{ code: string; name: string }>) {
  return plans.some(p => p.code.toUpperCase() === suggestionPlanCode(s) || p.name.trim().toLocaleLowerCase('es') === s.name.toLocaleLowerCase('es'));
}