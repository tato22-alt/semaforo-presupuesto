# Presupuestos — Taller El Semáforo

Herramienta web para armar, numerar, imprimir y archivar los presupuestos del
taller. Funciona en el navegador, sin instalar nada.

**Usala acá:** https://tato22-alt.github.io/semaforo-presupuesto/

---

## ⚠️ ADVERTENCIA IMPORTANTE — USALA SIEMPRE DESDE EL MISMO EQUIPO

**El historial y la numeración de los presupuestos viven en el navegador de
ese dispositivo, no en internet.**

Si la abrís desde otra computadora, otro celular, otro navegador o en modo
incógnito:

- **la numeración arranca de cero otra vez** y
- **vas a repetir números de presupuesto ya usados.**

Elegí **una sola máquina** para emitir presupuestos y usá siempre esa. Tampoco
borres los datos de navegación de ese navegador: si los borrás, se pierde el
historial.

## 📥 Descargá el CSV como respaldo cada tanto

Desde **Acciones → Descargar CSV** bajás todos los presupuestos guardados.
Hacelo seguido (por ejemplo, una vez por semana) y guardá el archivo en un
lugar seguro. Es el único respaldo que existe: si se rompe o se borra el
navegador, el CSV es lo que te permite recuperar la información.

## Por qué no tiene backend

La ausencia de servidor es **a propósito**, no algo que falte. Más adelante
esta herramienta se va a conectar a una base de datos, y esa base va a ser la
**fuente de verdad** de los presupuestos: ahí van a vivir la numeración y el
historial, compartidos entre todos los equipos. Mientras tanto, el guardado en
el navegador es una solución provisoria, y por eso valen las dos advertencias
de arriba.
