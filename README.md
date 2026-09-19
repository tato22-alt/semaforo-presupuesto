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

## Qué dice cada renglón

El renglón de **Mano de obra** tiene un espacio para escribir qué trabajo incluye
—"desabollado y pintura de tres paños, con pulido"— al lado de su importe. No es
obligatorio: si se deja vacío, la hoja sale como siempre, sólo con "Mano de obra".

Tanto ahí como en los renglones de repuestos, el texto **baja de renglón solo**: lo
que se escribe se lee entero en el papel, por largo que sea.

## Campos obligatorios

Antes de guardar, la herramienta pide: **fecha, cliente con teléfono, y mano de obra
mayor a cero**. Los renglones de repuestos son opcionales — a veces el trabajo es sólo
mano de obra.

**El N° de chasis y las Observaciones no son obligatorios.** El chasis no siempre se
tiene a mano, y las observaciones casi siempre van vacías: son para cuando hace falta
aclarar algo (un plazo, una condición, que el trabajo queda sujeto a revisión al
desarmar).

## Dejarlo pendiente y terminarlo después

Cuando tomás el auto y falta el precio de un repuesto, o hay que verlo desarmado para
poner la mano de obra, **no hace falta terminarlo ahí**. Con **Acciones → Dejar
pendiente** se guarda como está. Lo único que pide es **el nombre del cliente**, para
poder encontrarlo después.

Un pendiente **no gasta número**: aparece como `N° —` y la hoja, si la imprimís, sale
marcada **SIN EMITIR**. Si al final no va a ningún lado, lo descartás y no queda ningún
hueco en la numeración.

Lo terminás abriéndolo desde **Ver historial** —los pendientes salen arriba de todo,
marcados— completando lo que faltaba y guardando como siempre. Ahí recibe su número. Es
el mismo presupuesto, no uno nuevo.

**Un pendiente sí se puede descartar** (Ficha → Descartar), justamente porque nunca tuvo
número. Uno ya emitido no: eso no cambió, y la que lo impide es la base, no la página.

Sobre un presupuesto ya emitido, ese mismo botón pasa a decir **Guardar cambios**: sirve
para corregir algo sin tener que volver a imprimirlo.

## Guardar y hacer PDF

Guardar hace varias llamadas a la base (cliente, vehículo, presupuesto y renglones),
no una sola. Si alguna falla a mitad de camino, la herramienta lo avisa con el número
de presupuesto de por medio — no queda nada guardado a medias sin que se note. El
número reservado no se pierde: si el guardado falló, se puede reabrir el mismo
presupuesto desde el historial y volver a intentar.

## Lo que protege la hoja impresa

Tres cosas, y ninguna impide falsificar un papel —nada impreso lo impide—: lo que
hacen es que la adulteración se note.

- **El total en letras**, debajo de la cifra. Es la defensa vieja y la mejor: cambiar
  "$473.000" es fácil, cambiar también "Cuatrocientos setenta y tres mil" sin que se
  note, no.
- **El microtexto pegado al total**: una tira diminuta que repite número, importe y
  fecha. Para alterar la cifra hay que rehacer también esa tira, y a ese cuerpo de
  letra no se empareja a ojo. Fotocopiado se empasta, que ya es una señal.
- **La marca de agua** en diagonal sobre toda la hoja, con el nombre, el CUIT y el
  número. Si el presupuesto todavía no se guardó, dice **SIN EMITIR**.

Verificar de verdad un papel sigue siendo lo mismo: buscar ese número en el historial
y comparar el monto.

## Historial

Se lee de la base, compartido entre todos los que usan la herramienta. Al abrir un
presupuesto viejo se pueden corregir sus datos y volver a guardarlo — pisa la versión
anterior, no crea uno nuevo.

**Un presupuesto no se puede borrar.** Es un registro histórico a propósito: ni
siquiera desde el panel de la base se lo elimina en el uso normal.

## Marcar si se concretó, y si fue por seguro

Eso no se sabe cuando emitís el presupuesto, así que no está en el formulario. Se carga
después, desde **Ver historial**: cada presupuesto tiene un botón **Ficha** que abre dos
opciones —*No se concretó* y *Origen: particular / siniestro*— y guarda solo.

**No cambia nada del presupuesto ya impreso.** Es información interna del taller: el
cliente nunca ve si su trabajo entró como siniestro.

Conviene marcarlo cuando se sabe. Con eso, más adelante vas a poder saber qué porcentaje
de lo que cotizás se convierte en trabajo y cuánto de tu facturación depende de las
aseguradoras — dos cosas que no se pueden reconstruir para atrás.

## Buscar en el historial

Arriba de la lista hay un buscador. Escribí el **nombre del cliente** (sin importar
acentos ni mayúsculas: *peña* encuentra a *Peña* y a *Pena*), una **patente** (da igual
cómo la escribas) o directamente el **número de presupuesto**.

## Cuando un auto vuelve

Si cargás una patente que ya estuvo en el taller, la herramienta te ofrece traer los
datos del último presupuesto de ese vehículo: cliente, teléfono, la descripción del
auto y su número de chasis. Aceptás y te ahorra tipear todo de nuevo.

Además evita algo que se paga caro con el tiempo: **que el mismo cliente termine con
cuatro fichas distintas.** Si aceptás la propuesta y dejás el nombre como está, se
actualiza esa ficha. Si el auto cambió de dueño y escribís otro nombre, se crea una
ficha nueva y la del dueño anterior queda intacta.

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
