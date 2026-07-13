import { reduce } from '../engine';
import type {
  MatchConfig,
  MatchEvent,
  PlayerId,
  Shot,
  Stroke,
  TeamId,
  Variant,
} from '../engine';

/**
 * Un partido de mentira, jugado de verdad.
 *
 * Sirve para tener con que probar las pantallas de estadisticas sin cargar cien puntos a mano
 * en el emulador. Solo existe en desarrollo.
 *
 * NO SE ESCRIBE EL LOG A MANO. Un partido en Vigia *es* su log: el tanteo no se guarda en
 * ningun lado, se deriva. Si uno inventa el JSON, puede fabricar sin querer una secuencia
 * imposible o un tanteo que el motor nunca produciria — y entonces estaria probando las
 * pantallas contra una mentira, que es peor que no probarlas.
 *
 * Asi que lo juega el MOTOR: se le pregunta a `reduce` en que estado esta, se emite un evento
 * plausible para ese estado, y se repite hasta que el partido termina solo. El log queda valido
 * por construccion, y los tiebreaks, los breaks y las ventajas salen del reglamento, no de mi
 * imaginacion.
 */

/** Azar reproducible: el mismo semillero da siempre el mismo partido. */
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const STROKES_CON_LADO: Stroke[] = [
  'fondo',
  'salida_de_pared',
  'globo',
  'chiquita',
  'dejada',
  'recuperacion',
  'volea',
];
const POR_ALTO: Array<{ stroke: Stroke; variants: Variant[] }> = [
  { stroke: 'bandeja', variants: ['vibora', 'gancho'] },
  { stroke: 'remate', variants: ['x3', 'x4', 'traerla'] },
];

/** Un tope de seguridad: si el motor nunca termina, es un bug del motor y prefiero enterarme. */
const MAX_EVENTS = 4000;

export interface SimOptions {
  seed?: number;
  /** Cuanto mejor es el equipo A. 0.5 es parejo; 0.6 lo hace claro favorito. */
  strengthA?: number;
  /** Cada cuantos puntos se carga el golpe. 1 = todos; 0 = ninguno (para probar el caso vacio). */
  shotRate?: number;
  /**
   * Cuando se jugo. Por defecto, hace tres dias.
   *
   * Va como opcion y no como `Date.now()` a secas porque si no el simulador NO ES
   * REPRODUCIBLE: el azar lo es, pero el reloj no, y dos corridas con el mismo semillero
   * daban partidos identicos con horas distintas. Fijandolo, el log es siempre el mismo.
   */
  startedAt?: number;
}

export function simulate(config: MatchConfig, opts: SimOptions = {}): MatchEvent[] {
  const rand = rng(opts.seed ?? 7);
  const strengthA = opts.strengthA ?? 0.55;
  const shotRate = opts.shotRate ?? 0.75;

  const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)]!;

  const shot = (): Shot | undefined => {
    if (rand() > shotRate) return undefined; // el golpe es OPCIONAL: no siempre se carga
    if (rand() < 0.25) {
      const { stroke, variants } = pick(POR_ALTO);
      // La variante refina, no siempre esta.
      return rand() < 0.4 ? { stroke, variant: pick(variants) } : { stroke };
    }
    return { stroke: pick(STROKES_CON_LADO), side: rand() < 0.6 ? 'drive' : 'reves' };
  };

  const events: MatchEvent[] = [];
  let t = opts.startedAt ?? Date.now() - 3 * 24 * 60 * 60 * 1000;

  const push = (e: MatchEvent) => {
    // Entre 20 y 50 segundos por evento: un punto de padel con su pausa.
    t += 20000 + Math.floor(rand() * 30000);
    events.push({ ...e, t });
  };

  for (let n = 0; n < MAX_EVENTS; n++) {
    const st = reduce(config, events);
    if (st.finished) break;

    const other = (team: TeamId): TeamId => (team === 'A' ? 'B' : 'A');
    const pair = (team: TeamId): PlayerId[] => [
      config.teams[team].drive,
      config.teams[team].reves,
    ];

    const r = rand();

    // El let no pasa nada: se saca de nuevo. Es raro, pero existe, y hay que ver que no ensucie.
    if (r < 0.02) {
      push({ type: 'LET' });
      continue;
    }

    // Falta de primer saque. Si ya iba el segundo, esta misma falta es doble falta — el motor
    // lo sabe solo, no hay que decirselo.
    if (r < 0.14) {
      push({ type: 'FALTA' });
      continue;
    }

    if (r < 0.18 && st.serveState === 'PRIMERO') {
      push({ type: 'ACE' });
      continue;
    }

    // El punto lo define alguien: o lo gana con un winner, o lo regala con un error.
    const winsA = rand() < strengthA;
    const winner: TeamId = winsA ? 'A' : 'B';
    const loser = other(winner);

    const how = rand();
    if (how < 0.4) {
      push({ type: 'WINNER', player: pick(pair(winner)), shot: shot() });
    } else if (how < 0.75) {
      push({ type: 'ERROR_NO_FORZADO', player: pick(pair(loser)), shot: shot() });
    } else {
      push({ type: 'ERROR_FORZADO', player: pick(pair(loser)), shot: shot() });
    }
  }

  return events;
}
