# Pruebas

Prueban la página de verdad: abren `index.html` en Chromium, hacen lo que haría
alguien en el taller —cargar, guardar, dejar pendiente, abrir del historial,
bajar el CSV— y después miran qué quedó en la base.

La base es una imitación en memoria (`base-simulada.js`), armada con las mismas
tablas, controles y permisos que las migraciones de `semaforo-modelo-datos`. **No
tocan la base real** ni gastan números del talonario.

## Cómo se corren

```
node pruebas/correr.js
```

Hace falta Node y Playwright, instalado en el proyecto o global. En las sesiones
de Claude Code ya están.

Tarda unos 20 segundos. Cada prueba dice `PASA` o `FALLA` con el motivo. Para correr
sólo algunas, se pasa una parte del nombre: `node pruebas/correr.js csv`.

**Antes de subir un cambio a la página, tienen que pasar todas.**

## Lo que no prueban

Que la base real acepte las consultas tal como las escribe la página. La imitación
entiende lo que la página usa hoy, pero una consulta mal escrita puede pasar acá y
fallar allá. Eso sólo lo confirma usar la página contra Supabase.

Tampoco prueban cómo sale impreso en papel ni cómo se ve en un celular.

## Si cambia la base

Si una migración agrega o cambia una columna, un control o un permiso que la página
usa, hay que cambiarlo también en `base-simulada.js`. Si no, las pruebas pasan
contra una base que ya no existe.
