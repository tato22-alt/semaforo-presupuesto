# Conexión con la base — qué cambió y por qué

Este documento registra las decisiones de la migración de `localStorage` a Supabase,
para quien retome este código después. La base es la del repo
`tato22-alt/gestion-taller-sql-server`, feature 001 (presupuesto) + 002 (numeración).

**Proyecto Supabase:** `osslhkvdclrbukjqwpnt` · **URL:** `https://osslhkvdclrbukjqwpnt.supabase.co`

La página requiere conexión a internet para funcionar. No hay modo sin conexión: la
numeración, el historial y el guardado dependen de la base. Decisión del dueño del
negocio: "casi siempre hay internet".

## Lo que se retiró, y por qué ya no hace falta

Estos cuatro mecanismos existían para proteger la numeración y el historial **dentro
de un navegador**. La base los reemplaza:

| Mecanismo retirado | Lo reemplaza |
|---|---|
| `maxEmitido` + compuerta de arranque ("¿primera vez o ya se usó?") | La base ya sabe en qué número va (arranca en 16000, nunca retrocede) |
| Bloqueo de segunda pestaña (`BroadcastChannel`) | Dos pestañas ya no pueden pedir el mismo número: cada una llama a la base, que entrega uno distinto por diseño (`nextval` no es transaccional) |
| Modo seguro por historial dañado en el navegador | El historial vive en la base, no en `localStorage` |
| Restaurar desde CSV | Era la vía de recuperación cuando el historial vivía en el navegador. Servía además para cargar historial en papel — eso es el bloque D de la spec (T011–T015), pausado a propósito por falta de datos históricos (hallazgo H16). Se puede reintroducir el día que ese bloque se retome |

**Se mantiene** la descarga de CSV como respaldo/planilla contable, ahora a partir de
lo que devuelve la base en vez de `localStorage`.

**Se retiró** "Borrar del historial": la base revoca el DELETE sobre `trabajos` para el
rol autenticado (hallazgo H5 / RF-023) — un presupuesto es un registro histórico, no se
borra nunca. No hay reemplazo por ahora; marcar un presupuesto como "no concretado"
(la columna ya existe) queda para una próxima vuelta.

## Login

Sin sesión no se lee ni se escribe nada (RLS, T007/T008). Pantalla de email +
contraseña contra `/auth/v1/token?grant_type=password`. La sesión (access + refresh
token) se guarda en `localStorage` y se renueva sola cuando falta menos de un minuto
para que venza. Si el refresco falla, vuelve a pedir login.

Usuarios ya dados de alta y confirmados por el dueño del negocio — esta página no
tiene alta de usuarios, eso se hace desde el panel de Supabase.

## Numeración

El número se pide con `fn_proximo_numero_presupuesto()` **recién al guardar**, no al
abrir la herramienta ni al empezar un presupuesto en blanco. Hasta entonces la hoja
muestra `N° —`.

Esto es a propósito y corrige la primera versión, que lo pedía al abrir: como cada
llamada gasta el número para siempre (RF-020/RF-103), abrir la página tres veces sin
guardar nada dejaba tres números quemados. La garantía de la base no cambia — un
número pedido no se reutiliza — pero pedirlo tarde hace que sólo se gasten números
para presupuestos que de verdad se guardan. Dentro del guardado se pide después del
cliente y el vehículo, así un fallo en esos pasos tampoco lo gasta.

Un guardado que falla después de pedirlo sí deja el número quemado: eso es correcto y
es justo lo que RF-020 pide.

## Guardado — cuatro llamadas, no una transacción

Guardar un presupuesto nuevo hace, en orden:

1. `POST /rest/v1/clientes` (o `PATCH` si ya existe `id_cliente`, al reeditar).
2. Buscar `vehiculos` por `patente_norm`; si no existe, `POST`. Si la patente está
   vacía, se guarda sin vehículo.
3. Pedir el número (sólo si es nuevo) y `POST /rest/v1/trabajos` con él — o `PATCH`
   si es una reedición, que conserva el número que ya tenía.
4. Reemplazar `trabajo_items`: `DELETE` de los existentes (si había) + `POST` de los
   actuales.

Agruparlas en una sola operación atómica es orquestación, y la constitución de la base
la deja fuera de ese repositorio (hallazgo H4) — le toca a esta página, y esto es lo
que hace. Si un paso falla después de que otro ya escribió, no hay rollback real:
- Un cliente o vehículo huérfano (se creó pero el presupuesto no) es inofensivo, sólo
  basura de datos maestros.
- Un presupuesto sin renglones (el `trabajo` se guardó pero fallaron los `items`) es
  recuperable: el número no se pierde, se reabre desde el historial y se vuelve a
  guardar.

Cada paso que falla se lo dice a quien está cargando, con el número de presupuesto de
por medio si ya se asignó, para que sepa qué reabrir.

## Campos obligatorios (RF-024)

La base los reporta pero no los exige (`vw_presupuestos_incompletos`). Esta página sí
los exige antes de guardar: fecha, cliente (nombre, dirección, teléfono) y mano de obra
mayor a cero. Los renglones de repuestos son opcionales.

## Formato de patente (RF-022)

La base normaliza y valida el formato (anterior a 2016 o Mercosur) pero no bloquea
nada — es una función de apoyo para que la aplicación avise. Esta página avisa (no
bloquea) si la patente cargada no encaja en ninguno de los dos formatos.

## Historial

Se lee de `vw_presupuestos` (últimos 200, no hay buscador todavía — queda para una
próxima vuelta si el volumen lo pide). Al abrir un presupuesto del historial para
reeditarlo se trae también `trabajo_items` con una segunda consulta.

## Ficha interna: lo que no se sabe al emitir

Dos datos del trabajo **no se conocen cuando se emite el presupuesto**, y uno de ellos
además no debe salir impreso:

- **Si el trabajo se concretó** (`no_concretado`). Se sabe días o semanas después.
- **Si fue particular o por seguro** (`origen`). El modelo ya lo declara "nulo al nacer"
  (RF-014), y además es información interna: el cliente no tiene por qué leer "siniestro"
  en su presupuesto.

Por eso no son campos del formulario. Se cargan **desde el historial**, con el botón
*Ficha* de cada fila, que abre un panel y guarda cada cambio en el acto con un `PATCH`
sobre `trabajos`. No toca el número, ni los renglones, ni nada de lo que se imprimió: el
papel que el cliente ya tiene sigue siendo válido.

En la lista quedan visibles como marcas, para ver de un vistazo cuáles no prosperaron y
cuáles fueron por seguro.

**Para qué sirve:** son los dos datos que permiten responder qué porcentaje de lo que se
cotiza se convierte en trabajo, y cuánto de la facturación depende de las aseguradoras.
Ninguna de las dos se puede reconstruir para atrás si no se registran cuando pasan.

## Qué falta (documentado en README y en `mejoras-futuras.md` de la base)

- Buscador en el historial.
- Marcar un presupuesto como "no concretado" desde la interfaz.
- Concurrencia: si dos personas reeditan el mismo presupuesto a la vez, gana el último
  que guarda — no hay bloqueo optimista. Sin uso real todavía para que esto importe.
