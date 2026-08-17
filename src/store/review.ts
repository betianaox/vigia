/**
 * CUANDO SE PIDE LA VALORACION. Casi nunca.
 *
 * Google ya limita esto por su cuenta —tiene una cuota interna y decide si muestra el dialogo,
 * sin decirle a la app si lo mostro— asi que el riesgo real no es tecnico: es que la app se
 * sienta insistente. La regla de aca es deliberadamente exagerada en la otra direccion.
 *
 * Se pide al llegar al TERCER partido terminado, que es cuando alguien ya se formo una opinion y
 * todavia no se olvido de que la instalo. Y despues, cada 240. Alguien que llega a 240 partidos
 * cargados punto por punto no es un usuario: es un converso, y se le puede preguntar de nuevo sin
 * que moleste.
 *
 * El numero VA A DISCO (`lastReviewAsk`) y no un simple "ya se pidio": si alguien borra partidos
 * del historial y vuelve a subir hasta el mismo hito, no se le pregunta dos veces por el mismo.
 */

/**
 * El primero: ya jugo lo suficiente para tener algo que decir.
 *
 * Se exportan las dos para que los tests puedan razonar CON ellas en vez de repetir los numeros
 * a mano. Una lista escrita a mano —[3, 240, 480…]— deja de ser cierta en el momento en que
 * alguien cambia el intervalo, y el test que la tenga va a fallar sin que nada este mal.
 */
export const FIRST_ASK = 3;
/** Y despues, uno cada tanto. Muy cada tanto. */
export const EVERY_ASK = 240;

/**
 * Si a esta cantidad de partidos terminados le corresponde pedir valoracion.
 *
 * Es pura y por eso esta testeada: la que importa no es la llamada al sistema —esa la contesta
 * Google— sino no equivocarse en CUANDO, que es lo unico que puede volver molesta a la app.
 */
export const isReviewMilestone = (finishedMatches: number): boolean =>
  finishedMatches === FIRST_ASK ||
  (finishedMatches >= EVERY_ASK && finishedMatches % EVERY_ASK === 0);

/**
 * Si hay que pedirla AHORA: es un hito, y no es el mismo hito en el que ya se pidio.
 *
 * `lastAsk` es la cantidad de partidos que habia la ultima vez. Comparar contra el numero, y no
 * contra un booleano, es lo que hace que borrar partidos y volver a llegar a 200 no dispare otra
 * vez el mismo pedido.
 */
export const shouldAskReview = (finishedMatches: number, lastAsk: number): boolean =>
  isReviewMilestone(finishedMatches) && lastAsk !== finishedMatches;
