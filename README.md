# Presupuestos — Taller El Semáforo

Herramienta web para armar, numerar, imprimir y archivar los presupuestos del
taller. Funciona en el navegador, sin instalar nada — pero **necesita conexión a
internet**: el historial y la numeración viven en una base de datos compartida, no en
este equipo.

**Usala acá:** https://tato22-alt.github.io/semaforo-presupuesto/

---

## Cómo entrar

Pide email y contraseña la primera vez. La sesión queda guardada en este navegador,
así que no hay que volver a escribirla cada vez — pero **cualquier equipo con
usuario y contraseña ve el mismo historial**, no hace falta usar siempre la misma
computadora. Si en algún momento pide iniciar sesión de nuevo (la sesión venció, o se
cerró desde el menú), es normal.

Los usuarios se dan de alta desde el panel de Supabase, no desde esta página.

## Numeración

El número de cada presupuesto nuevo lo entrega la base, no el navegador. Arranca en
el **16000** (donde terminó el talonario de papel) y nunca repite ni retrocede.

**El número se asigna recién al guardar.** Hasta ese momento la hoja muestra `N° —`.
Abrir la herramienta, o empezar uno nuevo y arrepentirse, no gasta ningún número.

Si un guardado falla a mitad de camino, ese número sí queda usado y el siguiente sigue
de largo. Es a propósito: es la única forma de garantizar que dos presupuestos nunca
lleven el mismo número. Por eso la numeración puede tener algún hueco.

## Campos obligatorios

Antes de guardar, la herramienta pide: **fecha, cliente con dirección y teléfono, y
mano de obra mayor a cero**. Los renglones de repuestos son opcionales — a veces el
trabajo es sólo mano de obra.

## Guardar y hacer PDF

Guardar hace varias llamadas a la base (cliente, vehículo, presupuesto y renglones),
no una sola. Si alguna falla a mitad de camino, la herramienta lo avisa con el número
de presupuesto de por medio — no queda nada guardado a medias sin que se note. El
número reservado no se pierde: si el guardado falló, se puede reabrir el mismo
presupuesto desde el historial y volver a intentar.

## Historial

Se lee de la base, compartido entre todos los que usan la herramienta. Al abrir un
presupuesto viejo se pueden corregir sus datos y volver a guardarlo — pisa la versión
anterior, no crea uno nuevo.

**Un presupuesto no se puede borrar.** Es un registro histórico a propósito: ni
siquiera desde el panel de la base se lo elimina en el uso normal.

## Descargar CSV

Desde **Acciones → Descargar CSV** se arma una planilla con todo el historial —
sirve para contabilidad o para abrir en Excel. No es un respaldo del que dependa
recuperar nada: eso ya lo garantiza la base.

## Formato de patente

Al salir del campo Patente, si el formato no coincide con ninguna patente argentina
conocida (la de antes de 2016 o la Mercosur), avisa — pero no bloquea. Puede ser una
patente extranjera o un error de tipeo; queda a criterio de quien carga.

## Si algo no anda

- **"No se pudo iniciar sesión"** — revisá el email y la contraseña. Si seguís sin
  poder entrar, consultá con quien administra los usuarios en Supabase.
- **Un aviso dice que algo "no se pudo guardar" o "no se pudo pedir"** — casi
  siempre es la conexión. Revisá el internet del equipo y volvé a intentar; nada se
  guarda a medias sin avisar.
- **La sesión pide iniciar sesión de nuevo sin avisar** — el token venció y no se
  pudo renovar solo. Iniciá sesión otra vez, no se perdió nada.

## Detalle técnico

`CONEXION-BASE.md` documenta cómo se conecta esta página con la base (qué llamadas
hace, qué mecanismos viejos se retiraron y por qué, y las cosas que quedan
pendientes) para quien retome este código.
