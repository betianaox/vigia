import { describe, expect, it } from 'vitest';
import { reduce, undo } from './engine';
import type { GameFormat, MatchConfig, MatchEvent, TeamId } from './types';

// a1/b1 juegan de drive (reciben a la derecha), a2/b2 de reves (reciben a la izquierda).
const baseConfig = (over: Partial<MatchConfig> = {}): MatchConfig => ({
  players: {
    a1: { id: 'a1', name: 'Ana' },
    a2: { id: 'a2', name: 'Aldo' },
    b1: { id: 'b1', name: 'Bea' },
    b2: { id: 'b2', name: 'Beto' },
  },
  teams: {
    A: { id: 'A', drive: 'a1', reves: 'a2' },
    B: { id: 'B', drive: 'b1', reves: 'b2' },
  },
  serveOrder: { A: ['a1', 'a2'], B: ['b1', 'b2'] },
  firstServingTeam: 'A',
  gameFormat: 'ventajas',
  length: 'tres_sets',
  thirdSet: 'set_normal',
  changeEnds: 'games_impares',
  ...over,
});

const point = (team: TeamId): MatchEvent => ({
  type: 'WINNER',
  player: team === 'A' ? 'a1' : 'b1',
});
const points = (team: TeamId, n: number): MatchEvent[] => Array.from({ length: n }, () => point(team));
/** Un game completo a cero. */
const game = (team: TeamId): MatchEvent[] => points(team, 4);
const games = (team: TeamId, n: number): MatchEvent[] => Array.from({ length: n }, () => game(team)).flat();

describe('puntuacion del game', () => {
  it('cuenta 0 / 15 / 30 / 40 y cierra el game al cuarto punto', () => {
    const c = baseConfig();
    expect(reduce(c, []).display).toEqual({ A: '0', B: '0' });
    expect(reduce(c, points('A', 1)).display).toEqual({ A: '15', B: '0' });
    expect(reduce(c, points('A', 2)).display).toEqual({ A: '30', B: '0' });
    expect(reduce(c, points('A', 3)).display).toEqual({ A: '40', B: '0' });

    const s = reduce(c, points('A', 4));
    expect(s.games).toEqual({ A: 1, B: 0 });
    expect(s.display).toEqual({ A: '0', B: '0' });
  });

  it('un error no forzado le da el punto al rival', () => {
    const s = reduce(baseConfig(), [{ type: 'ERROR_NO_FORZADO', player: 'a1' }]);
    expect(s.display).toEqual({ A: '0', B: '15' });
  });

  it('un error forzado tambien le da el punto al rival', () => {
    const s = reduce(baseConfig(), [{ type: 'ERROR_FORZADO', player: 'b2' }]);
    expect(s.display).toEqual({ A: '15', B: '0' });
  });
});

describe('formato: ventajas', () => {
  const c = baseConfig({ gameFormat: 'ventajas' });

  it('a 40-40 hay que sacar dos de diferencia', () => {
    const deuce = [...points('A', 3), ...points('B', 3)];
    expect(reduce(c, deuce).display).toEqual({ A: '40', B: '40' });
    expect(reduce(c, deuce).isGoldenPoint).toBe(false);

    const ad = reduce(c, [...deuce, point('A')]);
    expect(ad.display).toEqual({ A: 'AD', B: '40' });
    expect(ad.games).toEqual({ A: 0, B: 0 });

    // Pierde la ventaja: vuelve a 40-40.
    expect(reduce(c, [...deuce, point('A'), point('B')]).display).toEqual({ A: '40', B: '40' });

    // Gana los dos seguidos: game.
    expect(reduce(c, [...deuce, point('A'), point('A')]).games).toEqual({ A: 1, B: 0 });
  });

  it('aguanta ventajas indefinidas', () => {
    const evs = [...points('A', 3), ...points('B', 3)];
    for (let i = 0; i < 10; i++) evs.push(point('A'), point('B'));
    const s = reduce(c, evs);
    expect(s.games).toEqual({ A: 0, B: 0 });
    expect(s.display).toEqual({ A: '40', B: '40' });
  });
});

describe('formato: punto de oro', () => {
  const c = baseConfig({ gameFormat: 'punto_de_oro' });
  const deuce = [...points('A', 3), ...points('B', 3)];

  it('el primer 40-40 es punto de oro y define el game', () => {
    const s = reduce(c, deuce);
    expect(s.isGoldenPoint).toBe(true);
    expect(s.display).toEqual({ A: '40', B: '40' });

    expect(reduce(c, [...deuce, point('A')]).games).toEqual({ A: 1, B: 0 });
    expect(reduce(c, [...deuce, point('B')]).games).toEqual({ A: 0, B: 1 });
  });

  it('el equipo que resta elige el cuadro', () => {
    const s = reduce(c, deuce);
    expect(s.awaitingBoxChoice).toBe(true);

    // Sin eleccion, el cuadro derivado seria derecha (se jugaron 6 puntos).
    expect(s.box).toBe('derecha');
    expect(s.receiver).toBe('b1');

    const chosen = reduce(c, [...deuce, { type: 'ELECCION_CUADRO', box: 'izquierda' }]);
    expect(chosen.awaitingBoxChoice).toBe(false);
    expect(chosen.box).toBe('izquierda');
    expect(chosen.receiver).toBe('b2'); // el de reves
  });
});

describe('formato: punto estrella (el de Premier)', () => {
  const c = baseConfig({ gameFormat: 'punto_estrella' });
  const deuce = [...points('A', 3), ...points('B', 3)];

  it('permite dos ventajas y el tercer 40-40 es punto de oro', () => {
    // 1er 40-40: no es de oro, se juega ventaja.
    expect(reduce(c, deuce).isGoldenPoint).toBe(false);

    // Ventaja A, la pierde -> 2do 40-40.
    const d2 = [...deuce, point('A'), point('B')];
    expect(reduce(c, d2).display).toEqual({ A: '40', B: '40' });
    expect(reduce(c, d2).isGoldenPoint).toBe(false);

    // Ventaja B, la pierde -> 3er 40-40 = PUNTO DE ORO.
    const d3 = [...d2, point('B'), point('A')];
    const s = reduce(c, d3);
    expect(s.display).toEqual({ A: '40', B: '40' });
    expect(s.isGoldenPoint).toBe(true);
    expect(s.awaitingBoxChoice).toBe(true);

    // Y define el game de una.
    expect(reduce(c, [...d3, point('B')]).games).toEqual({ A: 0, B: 1 });
  });

  it('si alguien gana los dos puntos de una ventaja, el game cierra antes', () => {
    const s = reduce(c, [...deuce, point('A'), point('A')]);
    expect(s.games).toEqual({ A: 1, B: 0 });
  });
});

describe('saque', () => {
  const c = baseConfig();

  it('una falta pasa a segundo saque', () => {
    expect(reduce(c, []).serveState).toBe('PRIMERO');
    expect(reduce(c, [{ type: 'FALTA' }]).serveState).toBe('SEGUNDO');
  });

  it('la doble falta no es un boton: es una falta en segundo saque', () => {
    const s = reduce(c, [{ type: 'FALTA' }, { type: 'FALTA' }]);
    expect(s.display).toEqual({ A: '0', B: '15' }); // punto para el que resta
    expect(s.serveState).toBe('PRIMERO'); // arranca punto nuevo
  });

  it('el let repite el saque sin avanzar el contador', () => {
    expect(reduce(c, [{ type: 'LET' }]).serveState).toBe('PRIMERO');
    expect(reduce(c, [{ type: 'LET' }, { type: 'LET' }]).serveState).toBe('PRIMERO');

    // Un let sobre el segundo saque sigue siendo segundo saque.
    const s = reduce(c, [{ type: 'FALTA' }, { type: 'LET' }]);
    expect(s.serveState).toBe('SEGUNDO');

    // Y la falta que sigue si es doble falta.
    expect(reduce(c, [{ type: 'FALTA' }, { type: 'LET' }, { type: 'FALTA' }]).display).toEqual({
      A: '0',
      B: '15',
    });
  });

  it('el ace le da el punto al sacador', () => {
    expect(reduce(c, [{ type: 'ACE' }]).display).toEqual({ A: '15', B: '0' });
  });

  it('ni el ace ni la falta llevan jugador: el sacador se deriva', () => {
    // Game 1 lo saca A; game 2 lo saca B. El mismo evento ACE cambia de dueno.
    const s = reduce(c, [...game('A'), { type: 'ACE' }]);
    expect(s.servingTeam).toBe('B');
    expect(s.display).toEqual({ A: '0', B: '15' });
  });
});

describe('rotacion de saque', () => {
  const c = baseConfig();

  it('alterna equipos, y dentro del equipo alterna jugadores: a1, b1, a2, b2, a1...', () => {
    const expected = ['a1', 'b1', 'a2', 'b2', 'a1', 'b1', 'a2', 'b2'];
    expected.forEach((who, i) => {
      // i games completos jugados (los gana A o B, da igual para la rotacion).
      const evs = Array.from({ length: i }, (_, k) => game(k % 2 === 0 ? 'A' : 'B')).flat();
      expect(reduce(c, evs).server).toBe(who);
    });
  });

  it('respeta que el que gana el sorteo puede optar por restar', () => {
    const s = reduce(baseConfig({ firstServingTeam: 'B' }), []);
    expect(s.server).toBe('b1');
    expect(s.servingTeam).toBe('B');
  });

  it('se puede cambiar el orden de saque de un equipo al empezar un set', () => {
    const evs: MatchEvent[] = [{ type: 'ORDEN_SAQUE', team: 'A', order: ['a2', 'a1'] }];
    expect(reduce(c, evs).server).toBe('a2');
  });
});

describe('receptor derivado', () => {
  const c = baseConfig();

  it('el sacador arranca por la derecha y alterna cuadro cada punto', () => {
    expect(reduce(c, []).box).toBe('derecha');
    expect(reduce(c, points('A', 1)).box).toBe('izquierda');
    expect(reduce(c, points('A', 2)).box).toBe('derecha');
  });

  it('el de drive recibe siempre a la derecha y el de reves a la izquierda', () => {
    // Saca A: resta B.
    expect(reduce(c, []).receiver).toBe('b1'); // drive de B, cuadro derecho
    expect(reduce(c, points('A', 1)).receiver).toBe('b2'); // reves de B, cuadro izquierdo

    // Game 2 lo saca B: resta A.
    expect(reduce(c, game('A')).receiver).toBe('a1');
    expect(reduce(c, [...game('A'), point('B')]).receiver).toBe('a2');
  });
});

describe('cambio de lado', () => {
  it('games_impares: se cambia al terminar cada game impar', () => {
    const c = baseConfig({ changeEnds: 'games_impares' });
    expect(reduce(c, []).endsSwapped).toBe(false);
    expect(reduce(c, games('A', 1)).endsSwapped).toBe(true); // total 1
    expect(reduce(c, games('A', 2)).endsSwapped).toBe(true); // total 2, no cambia
    expect(reduce(c, games('A', 3)).endsSwapped).toBe(false); // total 3, cambia
  });

  it('nunca: no cambia jamas (lo habitual en amateur)', () => {
    const c = baseConfig({ changeEnds: 'nunca' });
    expect(reduce(c, games('A', 3)).endsSwapped).toBe(false);
    expect(reduce(c, games('A', 5)).endsSwapped).toBe(false);
  });

  it('fin_de_set: solo cambia al cerrar el set', () => {
    const c = baseConfig({ changeEnds: 'fin_de_set' });
    expect(reduce(c, games('A', 3)).endsSwapped).toBe(false);
    expect(reduce(c, games('A', 6)).endsSwapped).toBe(true);
  });
});

describe('set', () => {
  const c = baseConfig();

  it('se gana 6-4', () => {
    const s = reduce(c, [...games('B', 4), ...games('A', 6)]);
    expect(s.completedSets).toHaveLength(1);
    expect(s.completedSets[0]!.games).toEqual({ A: 6, B: 4 });
    expect(s.setsWon).toEqual({ A: 1, B: 0 });
  });

  it('a 5-5 hay que llegar a 7', () => {
    const cinco = [...games('A', 5), ...games('B', 5)];
    expect(reduce(c, cinco).games).toEqual({ A: 5, B: 5 });
    expect(reduce(c, [...cinco, ...games('A', 1)]).completedSets).toHaveLength(0); // 6-5
    expect(reduce(c, [...cinco, ...games('A', 2)]).completedSets[0]!.games).toEqual({ A: 7, B: 5 });
  });
});

describe('tiebreak', () => {
  const c = baseConfig();
  // Intercalados, para llegar a 6-6 sin que el set cierre antes por diferencia de 2.
  const seisIguales = Array.from({ length: 6 }, () => [...game('A'), ...game('B')]).flat();

  it('arranca a 6-6', () => {
    const s = reduce(c, seisIguales);
    expect(s.inTiebreak).toBe(true);
    expect(s.display).toEqual({ A: '0', B: '0' }); // ahora es tanteo crudo
  });

  it('el primero saca 1 punto y despues cada uno saca 2', () => {
    // Alternados, para que el tiebreak no termine antes de llegar al punto 7.
    const tb = (n: number) => Array.from({ length: n }, (_, i) => point(i % 2 === 0 ? 'A' : 'B'));
    const at = (n: number) => reduce(c, [...seisIguales, ...tb(n)]);
    expect(at(0).server).toBe('a1'); // 1 punto
    expect(at(1).server).toBe('b1'); // 2 puntos
    expect(at(2).server).toBe('b1');
    expect(at(3).server).toBe('a2'); // 2 puntos
    expect(at(4).server).toBe('a2');
    expect(at(5).server).toBe('b2');
    expect(at(6).server).toBe('b2');
    expect(at(7).server).toBe('a1'); // vuelve a empezar el ciclo
  });

  it('se cambia de lado cada 6 puntos', () => {
    expect(reduce(c, [...seisIguales, ...points('A', 5)]).endsSwapped).toBe(false);
    expect(reduce(c, [...seisIguales, ...points('A', 3), ...points('B', 3)]).endsSwapped).toBe(true);
  });

  it('se gana a 7 con dos de diferencia y el set queda 7-6', () => {
    const s = reduce(c, [...seisIguales, ...points('A', 7)]);
    expect(s.completedSets[0]!.games).toEqual({ A: 7, B: 6 });
    expect(s.completedSets[0]!.tiebreak).toEqual({ A: 7, B: 0 });
  });

  it('a 6-6 en el tiebreak sigue hasta sacar dos', () => {
    const iguales = [...seisIguales, ...points('A', 6), ...points('B', 6)];
    expect(reduce(c, iguales).completedSets).toHaveLength(0);
    expect(reduce(c, [...iguales, ...points('A', 1)]).completedSets).toHaveLength(0); // 7-6
    expect(reduce(c, [...iguales, ...points('A', 2)]).completedSets[0]!.tiebreak).toEqual({
      A: 8,
      B: 6,
    });
  });
});

describe('partido', () => {
  const set = (team: TeamId): MatchEvent[] => games(team, 6);

  it('un_game termina al primer game', () => {
    const s = reduce(baseConfig({ length: 'un_game' }), game('A'));
    expect(s.finished).toBe(true);
    expect(s.winner).toBe('A');
  });

  it('un_set termina al primer set', () => {
    const s = reduce(baseConfig({ length: 'un_set' }), set('A'));
    expect(s.finished).toBe(true);
    expect(s.winner).toBe('A');
  });

  it('tres_sets: gana el primero que llega a 2', () => {
    const c = baseConfig({ length: 'tres_sets' });
    const unoUno = [...set('A'), ...set('B')];
    expect(reduce(c, unoUno).finished).toBe(false);
    expect(reduce(c, unoUno).setsWon).toEqual({ A: 1, B: 1 });

    const s = reduce(c, [...unoUno, ...set('A')]);
    expect(s.finished).toBe(true);
    expect(s.winner).toBe('A');
    expect(s.completedSets).toHaveLength(3);
  });

  it('ignora eventos despues de terminado', () => {
    const c = baseConfig({ length: 'un_game' });
    const s = reduce(c, [...game('A'), ...points('B', 4)]);
    expect(s.winner).toBe('A');
    expect(s.games).toEqual({ A: 1, B: 0 });
  });

  it('el tercer set puede ser un super tiebreak a 10', () => {
    const c = baseConfig({ length: 'tres_sets', thirdSet: 'super_tiebreak' });
    const unoUno = [...set('A'), ...set('B')];

    const s = reduce(c, unoUno);
    expect(s.inTiebreak).toBe(true);
    expect(s.isSuperTiebreak).toBe(true);

    // A 7 no alcanza: hay que llegar a 10.
    expect(reduce(c, [...unoUno, ...points('A', 7)]).finished).toBe(false);

    const fin = reduce(c, [...unoUno, ...points('A', 10)]);
    expect(fin.finished).toBe(true);
    expect(fin.winner).toBe('A');
    expect(fin.completedSets[2]!.tiebreak).toEqual({ A: 10, B: 0 });
  });
});

describe('rotacion de saque entre sets', () => {
  it('continua la rotacion: saca el equipo que no saco el ultimo game', () => {
    const c = baseConfig();
    // Set de 9 games (6-3): el ultimo lo saco A (indice 8, par) -> saca B.
    const s = reduce(c, [...games('B', 3), ...games('A', 6)]);
    expect(s.completedSets[0]!.games).toEqual({ A: 6, B: 3 });
    expect(s.servingTeam).toBe('B');
    expect(s.server).toBe('b1');
  });

  it('con 10 games (6-4) el ultimo lo saca B, asi que saca A', () => {
    const c = baseConfig();
    const s = reduce(c, [...games('B', 4), ...games('A', 6)]);
    expect(s.servingTeam).toBe('A');
  });
});

describe('marcador inicial (el partido ya habia empezado)', () => {
  it('arranca desde un marcador dado', () => {
    const c = baseConfig({
      initialScore: { sets: [{ A: 6, B: 4 }], games: { A: 3, B: 2 } },
    });
    const s = reduce(c, []);
    expect(s.setsWon).toEqual({ A: 1, B: 0 });
    expect(s.games).toEqual({ A: 3, B: 2 });
    expect(s.manuallyCorrected).toBe(false);
  });
});

describe('correccion manual', () => {
  it('fuerza el marcador y deja el partido marcado', () => {
    const c = baseConfig();
    const s = reduce(c, [
      ...points('A', 2),
      { type: 'CORRECCION_MANUAL', sets: [], games: { A: 4, B: 1 } },
    ]);
    expect(s.games).toEqual({ A: 4, B: 1 });
    expect(s.points).toEqual({ A: 0, B: 0 });
    expect(s.manuallyCorrected).toBe(true);
  });
});

describe('undo', () => {
  it('es sacar el ultimo evento y recalcular', () => {
    const c = baseConfig();
    const evs = points('A', 3);
    expect(reduce(c, evs).display).toEqual({ A: '40', B: '0' });
    expect(reduce(c, undo(evs)).display).toEqual({ A: '30', B: '0' });
  });

  it('deshace tambien un game entero', () => {
    const c = baseConfig();
    const evs = game('A');
    expect(reduce(c, evs).games).toEqual({ A: 1, B: 0 });

    const back = reduce(c, undo(evs));
    expect(back.games).toEqual({ A: 0, B: 0 });
    expect(back.display).toEqual({ A: '40', B: '0' });
    expect(back.server).toBe('a1'); // y el saque vuelve al que era
  });
});

/**
 * Los dos cambios que el reglamento permite al empezar un set. No son adornos: si la pareja
 * se da vuelta y la app no se entera, muestra el restador equivocado en CADA punto del set y
 * atribuye mal todas las estadisticas de drive y de reves.
 */
describe('cambio de posiciones (la pareja se da vuelta)', () => {
  const c = baseConfig();

  it('sin cambios, las posiciones son las de la config', () => {
    const s = reduce(c, []);
    expect(s.positions.A).toEqual({ drive: 'a1', reves: 'a2' });
  });

  it('da vuelta el drive y el reves del equipo', () => {
    const s = reduce(c, [{ type: 'CAMBIO_POSICION', team: 'A' }]);
    expect(s.positions.A).toEqual({ drive: 'a2', reves: 'a1' });
    // El otro equipo no se toca.
    expect(s.positions.B).toEqual({ drive: 'b1', reves: 'b2' });
  });

  /** Lo que realmente importa: el que resta se deriva del cuadro, y el cuadro de las posiciones. */
  it('cambia quien resta en cada cuadro', () => {
    // Saca A desde la derecha: resta el de drive de B.
    expect(reduce(c, []).receiver).toBe('b1');
    expect(reduce(c, [{ type: 'CAMBIO_POSICION', team: 'B' }]).receiver).toBe('b2');
  });

  it('el undo lo revierte como cualquier otro evento', () => {
    const evs: MatchEvent[] = [{ type: 'CAMBIO_POSICION', team: 'B' }];
    expect(reduce(c, undo(evs)).receiver).toBe('b1');
  });

  /**
   * Divulgacion progresiva: en el primer set las posiciones se acaban de configurar en el
   * setup, asi que ofrecer cambiarlas es ruido. El boton aparece recien en el segundo,
   * cuando el usuario ya jugo un set entero y conoce la tarjeta.
   */
  it('NO se ofrece en el primer set: se acaba de configurar en el setup', () => {
    expect(reduce(c, []).canSwapPositions).toBe(false);
    expect(reduce(c, points('A', 1)).canSwapPositions).toBe(false);
  });

  it('aparece al empezar el segundo set', () => {
    // 6-0: se cierra el set y el siguiente arranca en cero.
    const s = reduce(c, games('A', 6));
    expect(s.completedSets).toHaveLength(1);
    expect(s.games).toEqual({ A: 0, B: 0 });
    expect(s.canSwapPositions).toBe(true);
  });

  it('y se va apenas se juega el primer punto de ese set', () => {
    const s = reduce(c, [...games('A', 6), ...points('A', 1)]);
    expect(s.canSwapPositions).toBe(false);
  });
});

describe('cambio del orden de saque', () => {
  const c = baseConfig();

  it('se puede en el primer game de saque de cada equipo, y no despues', () => {
    // Game 0: saca A, es su primer game de saque del set.
    expect(reduce(c, []).canSwapServer).toBe(true);
    // Game 1: saca B, es el suyo.
    expect(reduce(c, game('A')).canSwapServer).toBe(true);
    // Game 2: los dos equipos ya sacaron. Se acabo.
    expect(reduce(c, [...game('A'), ...game('B')]).canSwapServer).toBe(false);
  });

  /**
   * Una falta YA quedo atribuida a ese sacador. Darlo vuelta despues no la arregla: la
   * ensucia. Para eso esta el Deshacer.
   */
  it('se cierra apenas el game tiene un evento, aunque no haya puntos', () => {
    expect(reduce(c, [{ type: 'FALTA' }]).canSwapServer).toBe(false);
    expect(reduce(c, points('A', 1)).canSwapServer).toBe(false);
  });

  it('da vuelta el orden y cambia quien saca', () => {
    expect(reduce(c, []).server).toBe('a1');
    const s = reduce(c, [{ type: 'ORDEN_SAQUE', team: 'A', order: ['a2', 'a1'] }]);
    expect(s.server).toBe('a2');
  });
});

/**
 * Como se para la pareja CUANDO SACA. Es una eleccion por pareja.
 *
 * No cambia ningun dato del partido — ni el tanteo, ni quien saca, ni quien resta, ni el
 * golpe. Cambia DONDE ESTAN PARADOS, y por eso cambia como se dibuja la cancha. El layout de
 * la app tiene que espejar lo que el observador esta mirando, o le va a errar al jugador.
 */
describe('formacion de la pareja que saca', () => {
  it('australiana (el default): cada uno mantiene su lado siempre, saque desde donde saque', () => {
    const c = baseConfig(); // sin formacion = australiana

    expect(reduce(c, []).layout.A).toEqual({ drive: 'a1', reves: 'a2' });
    // Segundo punto, se saca desde la izquierda, y la pareja NO se movio.
    expect(reduce(c, points('A', 1)).layout.A).toEqual({ drive: 'a1', reves: 'a2' });
  });

  it('cambiando de lado: el sacador se queda del lado desde el que saco', () => {
    const c = baseConfig({
      teams: {
        A: { id: 'A', drive: 'a1', reves: 'a2', formation: 'cambio' },
        B: { id: 'B', drive: 'b1', reves: 'b2' },
      },
    });

    // Punto 0: se saca desde la DERECHA. a1 (que saca) queda del lado del drive.
    const p0 = reduce(c, []);
    expect(p0.box).toBe('derecha');
    expect(p0.layout.A).toEqual({ drive: 'a1', reves: 'a2' });

    // Punto 1: se saca desde la IZQUIERDA. a1 sigue sacando y queda del lado del reves;
    // su companero cruza al drive. LA PAREJA INTERCAMBIA LUGAR.
    const p1 = reduce(c, points('A', 1));
    expect(p1.box).toBe('izquierda');
    expect(p1.layout.A).toEqual({ drive: 'a2', reves: 'a1' });

    // Pero su ROL no cambio: a1 sigue siendo el de drive, y por eso resta a la derecha.
    expect(p1.positions.A).toEqual({ drive: 'a1', reves: 'a2' });
  });

  /** El que recibe esta obligado a mantener el lugar que eligio al empezar el set. */
  it('el equipo que RECIBE no se mueve nunca, con ninguna formacion', () => {
    const c = baseConfig();
    expect(reduce(c, []).layout.B).toEqual({ drive: 'b1', reves: 'b2' });
    expect(reduce(c, points('A', 1)).layout.B).toEqual({ drive: 'b1', reves: 'b2' });
    expect(reduce(c, points('A', 2)).layout.B).toEqual({ drive: 'b1', reves: 'b2' });
  });

  it('no toca ningun dato del partido: el que resta se sigue derivando del ROL', () => {
    const c = baseConfig();
    // Saque desde la derecha: resta el de drive de B, se pare donde se pare el que saca.
    expect(reduce(c, []).receiver).toBe('b1');
    // Saque desde la izquierda: resta el de reves.
    expect(reduce(c, points('A', 1)).receiver).toBe('b2');
  });
});

describe('el motor es una funcion pura del log', () => {
  it('el mismo log da siempre el mismo estado', () => {
    const c = baseConfig({ gameFormat: 'punto_estrella' });
    const evs: MatchEvent[] = [
      { type: 'FALTA' },
      { type: 'ACE' },
      { type: 'LET' },
      { type: 'ERROR_NO_FORZADO', player: 'b2', shot: { stroke: 'bandeja' } },
      { type: 'WINNER', player: 'a2', shot: { stroke: 'bandeja' } },
      { type: 'ERROR_FORZADO', player: 'a1', forcedBy: 'b1', forcedByShot: { stroke: 'remate' } },
    ];
    expect(reduce(c, evs)).toEqual(reduce(c, evs));
  });
});
