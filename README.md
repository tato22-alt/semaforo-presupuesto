# Presupuestos — Taller El Semáforo

Aplicación web para emitir, numerar, imprimir y archivar los presupuestos del taller
de chapa y pintura El Semáforo.

**Producción:** https://tato22-alt.github.io/semaforo-presupuesto/

## Funcionalidades

- Carga del presupuesto: cliente, vehículo, repuestos y mano de obra, con total en
  cifras y en letras.
- Numeración correlativa centralizada en la base, a partir del N° 16000, sin
  repeticiones.
- Presupuestos pendientes, que no consumen número hasta emitirse.
- Historial compartido entre equipos, con búsqueda por cliente, patente o número.
- Seguimiento posterior: si el trabajo se concretó y si fue particular o siniestro.
- Recuperación automática de lo cargado si se cierra la pestaña.
- Impresión y PDF con medidas contra la adulteración (total en letras y microtexto).
- Exportación del historial completo a CSV.
- Instalable en el celular (PWA).

## Arquitectura

| Componente | Tecnología |
|---|---|
| Interfaz | Un único `index.html` con HTML, CSS y JavaScript, sin dependencias ni compilación |
| Base de datos | Supabase (PostgreSQL), accedida mediante su API REST |
| Autenticación | Supabase Auth (email y contraseña) |
| Publicación | GitHub Pages, directamente desde `main` |

El esquema de la base, sus migraciones y sus permisos se mantienen en el repositorio
[`semaforo-modelo-datos`](https://github.com/tato22-alt/semaforo-modelo-datos).

## Estructura

```
index.html         La aplicación completa
manifest.json      Configuración de la PWA
icono-*.png        Íconos de la PWA
logo.png           Logo de la hoja impresa
pruebas/           Pruebas automáticas
MANUAL.md          Manual de uso
CONEXION-BASE.md   Integración con la base y decisiones técnicas
```

## Desarrollo

No requiere instalación ni compilación: alcanza con abrir `index.html` en un servidor
local, por ejemplo:

```
python3 -m http.server 8000
```

Los usuarios se dan de alta desde el panel de Supabase.

## Pruebas

```
node pruebas/correr.js
```

Requieren Node y Playwright. Ejecutan la página en Chromium contra una base simulada
en memoria, sin tocar la base real. Detalle en [`pruebas/README.md`](pruebas/README.md).

Todas deben pasar antes de publicar un cambio.

## Publicación

Cada cambio integrado en `main` queda publicado en GitHub Pages en uno o dos minutos.

## Documentación

- [`MANUAL.md`](MANUAL.md): uso diario de la aplicación y solución de problemas.
- [`CONEXION-BASE.md`](CONEXION-BASE.md): cómo se conecta con la base y por qué.
- [`pruebas/README.md`](pruebas/README.md): alcance y limitaciones de las pruebas.
