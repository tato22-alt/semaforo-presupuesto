# Presupuestos — Taller El Semáforo

Herramienta web para armar, numerar, imprimir y archivar los presupuestos del
taller. Funciona en el navegador, sin instalar nada.

**Usala acá:** https://tato22-alt.github.io/semaforo-presupuesto/

---

## ⚠️ ADVERTENCIA IMPORTANTE — USALA SIEMPRE DESDE EL MISMO EQUIPO

**El historial y la numeración viven en el navegador de ese dispositivo, no en
internet.** Si la abrís desde otra computadora, otro celular, otro navegador o
en modo incógnito, ese navegador no sabe nada de lo que emitiste acá.

Elegí **una sola máquina** para emitir presupuestos y usá siempre esa. Tampoco
borres los datos de navegación de ese navegador: si los borrás, se pierde el
historial.

## 📥 Descargá el CSV como respaldo cada tanto

Desde **Acciones → Descargar CSV** bajás todos los presupuestos guardados.
Hacelo seguido (por ejemplo, una vez por semana) y guardá el archivo en un
lugar seguro. Es el único respaldo que existe, y es lo que te permite
recuperar todo con **Acciones → Restaurar desde CSV**.

## Cómo se protege la numeración

Un número de presupuesto repetido es el peor error posible, así que la
herramienta lo bloquea por cuatro lados:

1. **El número nunca retrocede.** Se guarda aparte el máximo número emitido en
   la historia. El próximo siempre es mayor que ese máximo, y se verifica antes
   de cada guardado: si no se cumple, no guarda y te lo dice.
2. **La primera vez pregunta desde dónde arranca.** Con el historial vacío no
   asume ningún número. Te hace elegir entre *"es la primera vez que se usa"*
   (arranca en el 16000) o *"ya se usó en otro equipo o se borraron los datos"*
   (escribís el último número emitido y arranca en el siguiente). Hasta que no
   elegís, no deja guardar.
3. **Elegido una vez, no se cambia más.** No hay ninguna forma de editar la
   numeración desde la herramienta. Es a propósito.
4. **Se puede restaurar desde el CSV.** Es la salida real cuando se limpia el
   navegador o se cambia de equipo. No pisa lo que ya está, te dice cuántos
   entraron y cuántos se saltearon por número repetido, y vuelve a calcular el
   máximo.

> **Al restaurar, mandan los renglones.** Los totales se vuelven a calcular
> sumando los renglones del CSV, no se leen de las columnas de totales. Si
> alguien edita esas columnas a mano en Excel, esos cambios se pierden al
> importar. Editá los renglones, no los totales.

**Borrar un presupuesto del historial no libera su número.** Un número usado
queda quemado para siempre; el siguiente sigue de largo. Es la única forma de
garantizar que nunca se repita.

### Esto reduce el riesgo, no lo elimina

Hay que decirlo con todas las letras: **mientras la numeración viva en el
navegador, el riesgo de duplicar números baja mucho pero no desaparece.** Las
cuatro protecciones de arriba funcionan dentro de un navegador; dos equipos
distintos no se ven entre sí y no hay forma de que se vean sin un servidor.

La garantía definitiva es la base de datos que ya está planeada. Cuando esté,
va a ser la **fuente de verdad** de la numeración y el historial, compartidos
entre todos los equipos, y estas advertencias dejan de hacer falta.

## Si algo se rompe

Si al abrirla aparece el cartel rojo **"No se pudo leer el historial"**, el
guardado queda bloqueado a propósito para no borrar nada. Hacé esto, en orden:

1. **Descargar copia de los datos (.txt)** — el botón del cartel rojo. Guardá
   ese archivo antes que nada.
2. Buscá el último CSV que hayas descargado.
3. Limpiá los datos del navegador para este sitio.
4. Volvé a abrir la herramienta, elegí *"ya se usó en otro equipo o se borraron
   los datos"* y poné el último número que recuerdes.
5. **Acciones → Restaurar desde CSV** con el archivo del punto 2.

## Por qué no tiene backend

La ausencia de servidor es **a propósito**, no algo que falte. Es una solución
provisoria hasta que se conecte a la base de datos.

Otra razón para migrar: el navegador reserva unos 5 MB para guardar los datos
de un sitio. Estamos lejísimos de ese tope, pero con miles de presupuestos
acumulados algún día se alcanza, y desde el código no hay nada que hacer al
respecto.
