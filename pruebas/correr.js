/* Pruebas de la página de presupuestos, en Chromium y contra la base simulada.

   Uso:  node pruebas/correr.js          (o con una parte del nombre: ... correr.js csv)
   Necesita Node y Playwright; en las sesiones de Claude Code ya están instalados.

   Abre index.html tal como está en el repo, hace lo que haría alguien en el taller
   —cargar, guardar, dejar pendiente, abrir del historial, bajar el CSV— y después
   mira qué quedó en la base. No toca la base real. */

'use strict';

const fs = require('fs');
const path = require('path');
/* Playwright puede estar instalado en el proyecto o global (como en Claude Code). */
const { chromium } = (() => {
  try{ return require('playwright'); }
  catch(e){ return require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
})();
const { crearBase } = require('./base-simulada');

const RAIZ = path.join(__dirname, '..');
const PAGINA = 'http://taller.test/';
const TIPOS = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png' };
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*',
               'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': 'Content-Range' };

/* ===================== cómo se abre la página ===================== */
async function abrirPagina(browser, base, { sesion = true } = {}){
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  page.errores = [];
  page.on('pageerror', e => page.errores.push(e.message));
  /* confirm() y el aviso de salir: se acepta salvo que la prueba diga otra cosa. */
  page.aceptarDialogos = true;
  page.on('dialog', d => page.aceptarDialogos ? d.accept() : d.dismiss());

  await ctx.route('**/*', async route => {
    const req = route.request();
    const u = new URL(req.url());
    if(u.host === 'taller.test'){
      const archivo = path.join(RAIZ, u.pathname === '/' ? 'index.html' : u.pathname);
      if(!archivo.startsWith(RAIZ) || !fs.existsSync(archivo)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ contentType: TIPOS[path.extname(archivo)] || 'application/octet-stream',
                             body: fs.readFileSync(archivo) });
    }
    if(!u.host.endsWith('.supabase.co')) return route.abort();
    if(req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const r = base.responder(req.method(), req.url(), req.headers(), req.postData());
    return route.fulfill({
      status: r.status,
      headers: { ...CORS, ...(r.headers || {}), 'Content-Type': 'application/json' },
      body: r.cuerpo == null ? '' : JSON.stringify(r.cuerpo),
    });
  });

  /* Imprimir abre el diálogo del sistema: acá sólo se cuenta. */
  await ctx.addInitScript(() => { window.print = () => { window.impresiones = (window.impresiones || 0) + 1; }; });
  if(sesion){
    const s = base.sesionPara();
    await ctx.addInitScript(s => {                 // sólo la primera vez que abre: al recargar sigue lo que haya
      if(sessionStorage.getItem('prueba-sesion')) return;
      sessionStorage.setItem('prueba-sesion', '1');
      localStorage.setItem('semaforo-sesion', JSON.stringify(s));
    }, s);
  }
  await page.goto(PAGINA);
  if(sesion) await esperarApp(page);
  return page;
}

/* Espera a que la app esté a la vista. Si no aparece, dice qué quedó en pantalla. */
async function esperarApp(page){
  try{ await page.waitForSelector('#app:not([hidden])', { timeout: 8000 }); }
  catch(e){
    const ver = await page.evaluate(() => ({
      carga: document.getElementById('carga').classList.contains('abierto') && document.getElementById('carga-txt').textContent,
      login: document.getElementById('login').classList.contains('abierto') && document.getElementById('login-error').textContent,
      email: document.getElementById('login-email').value,
    }));
    throw new Error('la página no quedó lista: ' + JSON.stringify(ver));
  }
}

/* ===================== lo que hace alguien en el taller ===================== */
async function menu(page, boton){
  await page.click('#b-menu');
  await page.click('#' + boton);
}

/* Espera a que el aviso de abajo diga algo que coincida. Devuelve el texto. */
async function aviso(page, patron){
  try{
    await page.waitForFunction(re => new RegExp(re).test(document.getElementById('aviso').textContent),
                               patron.source, { timeout: 5000 });
  }catch(e){
    throw new Error('el aviso no dijo ' + patron + '; dice: "' + await page.textContent('#aviso') + '"');
  }
  return page.textContent('#aviso');
}

async function cargar(page, d){
  for(const campo of ['fecha', 'cliente', 'telefono', 'vehiculo', 'patente', 'chasis', 'observaciones'])
    if(d[campo] != null) await page.fill('#' + campo, d[campo]);
  for(const [i, [detalle, importe]] of (d.renglones || []).entries()){
    if(await page.locator('#items tr').count() <= i) await page.click('#add');
    const fila = page.locator('#items tr').nth(i);
    await fila.locator('.det').fill(detalle);
    if(importe != null) await fila.locator('.mon').fill(String(importe));
  }
  if(d.mano != null)  await page.fill('#mo', String(d.mano));
  if(d.detMano != null) await page.fill('#mo-det', d.detMano);
  await page.locator('#mo').blur();
}

/* La pantalla de login pone el cursor en el email a los 50 ms de abrirse. Se espera
   eso antes de escribir: si el salto cae a mitad de la contraseña, la contraseña
   termina escrita en el email. Una persona no tipea tan rápido; la prueba sí. */
async function entrar(page, password, email = 'taller@semaforo.test'){
  await page.waitForSelector('#login.abierto');
  await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'login-email');
  await page.fill('#login-email', email);
  await page.fill('#login-pass', password);
  await page.click('#login-entrar');
}

async function abrirDelHistorial(page, texto){
  await menu(page, 'b-hist');
  const fila = page.locator('#lista .item', { hasText: texto });
  await fila.first().waitFor();
  await fila.first().locator('.i-datos').click();
  await page.waitForFunction(() => !document.getElementById('modal').classList.contains('abierto'));
}

async function bajarCSV(page){
  const descarga = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await menu(page, 'b-csv');
  const d = await descarga;
  return d ? fs.readFileSync(await d.path(), 'utf8') : null;
}

const COMPLETO = { fecha: '2026-10-16', cliente: 'Ana Ruiz', telefono: '2255 111222', vehiculo: 'VW Gol',
                   patente: 'ab 123 cd', renglones: [['Paragolpe', 120000], ['Faro', 45000]], mano: 300000,
                   detMano: 'Pintar paragolpe' };

/* Un presupuesto ya guardado, para las pruebas que arrancan del historial. */
function guardado(base, d = {}){
  const tr = base.agregar('trabajos', {
    numero_presupuesto: 16000, fecha_presupuesto: '2026-10-01', txt_cliente: 'Ana Ruiz',
    txt_telefono: '2255', monto_mano_obra: 5000, origen_carga: 'presupuesto_web', ...d });
  return tr;
}

/* ===================== las pruebas ===================== */
const pruebas = [];
const prueba = (nombre, fn, opciones) => pruebas.push({ nombre, fn, opciones });
const ok = (cond, msg) => { if(!cond) throw new Error(msg); };
const igual = (real, esperado, que) =>
  ok(JSON.stringify(real) === JSON.stringify(esperado), que + ': esperaba ' + JSON.stringify(esperado) + ', dio ' + JSON.stringify(real));

prueba('El total en letras', async ({ abrir }) => {
  const page = await abrir();
  const casos = [[21, 'veintiuno'], [100, 'cien'], [1500, 'mil quinientos'], [21000, 'veintiún mil'],
                 [121000, 'ciento veintiún mil'], [201000, 'doscientos un mil'], [473000, 'cuatrocientos setenta y tres mil'],
                 [1000000, 'un millón'], [1231000, 'un millón doscientos treinta y un mil'], [21000000, 'veintiún millones'],
                 [1000000000, 'mil millones']];
  const reales = await page.evaluate(cs => cs.map(([n]) => enLetras(n)), casos);
  casos.forEach(([n, e], i) => igual(reales[i], e, String(n)));
  await page.fill('#mo', '21000');
  await page.locator('#mo').blur();
  igual(await page.textContent('#letras'), 'Veintiún mil', 'lo que se ve en la hoja');
});

prueba('Entrar con email y contraseña', async ({ abrir }) => {
  const page = await abrir({ sesion: false });
  await entrar(page, 'otra');
  await page.waitForSelector('#login-error:not([hidden])');
  igual(await page.textContent('#login-error'), 'Invalid login credentials', 'mensaje con la contraseña mal');
  await page.fill('#login-pass', 'clave');
  await page.click('#login-entrar');
  await esperarApp(page);
});

prueba('Emitir un presupuesto nuevo', async ({ abrir, base }) => {
  const page = await abrir();
  await cargar(page, COMPLETO);
  await page.waitForFunction(() => localStorage.getItem('semaforo-borrador'));   // para ver que guardar lo borra
  await menu(page, 'b-pdf');
  await aviso(page, /Guardado con el N° 16000/);
  await page.waitForFunction(() => window.impresiones === 1);
  igual(await page.textContent('#nro'), '16000', 'N° en la hoja');
  igual(base.contar('POST', '/rest/v1/rpc/fn_proximo_numero_presupuesto'), 1, 'números pedidos');

  const [t] = base.tablas.trabajos;
  igual(base.tablas.trabajos.length, 1, 'trabajos en la base');
  igual([t.numero_presupuesto, t.txt_cliente, t.txt_patente, t.monto_mano_obra, t.origen_carga, t.detalle_mano_obra],
        [16000, 'Ana Ruiz', 'AB123CD', 300000, 'presupuesto_web', 'Pintar paragolpe'], 'el trabajo');
  igual(base.tablas.trabajo_items.map(i => [i.orden, i.detalle, i.importe]),
        [[0, 'Paragolpe', 120000], [1, 'Faro', 45000]], 'los renglones');
  igual(base.vista()[0].monto_total, 465000, 'total en la base');
  igual(base.tablas.clientes.map(c => c.nombre), ['Ana Ruiz'], 'clientes');
  igual(base.tablas.vehiculos.map(v => [v.patente, v.id_cliente_ultimo]), [['AB123CD', 1]], 'vehículos');
  igual(await page.evaluate(() => localStorage.getItem('semaforo-borrador')), null, 'borrador después de guardar');
});

prueba('Si falta un dato obligatorio no se emite ni se gasta número', async ({ abrir, base }) => {
  const page = await abrir();
  await cargar(page, { ...COMPLETO, telefono: '' });
  await menu(page, 'b-pdf');
  await aviso(page, /Falta cargar: el teléfono/);
  igual(base.contar('POST', '/rest/v1/rpc/fn_proximo_numero_presupuesto'), 0, 'números pedidos');
  igual(base.tablas.trabajos.length, 0, 'trabajos en la base');
});

prueba('Dejar pendiente no gasta número, y se termina desde el historial', async ({ abrir, base }) => {
  const page = await abrir();
  await cargar(page, { cliente: 'Luis Gómez', renglones: [['Óptica (falta precio)', null]] });
  await menu(page, 'b-pend');
  await aviso(page, /Guardado como pendiente/);
  igual(base.contar('POST', '/rest/v1/rpc/fn_proximo_numero_presupuesto'), 0, 'números pedidos');
  igual(base.tablas.trabajos.map(t => t.numero_presupuesto), [null], 'número del pendiente');

  await menu(page, 'b-nuevo');
  await abrirDelHistorial(page, 'Sin emitir — Luis Gómez');
  igual(await page.inputValue('#cliente'), 'Luis Gómez', 'cliente al reabrir');
  await cargar(page, { telefono: '2255 333', renglones: [['Óptica', 80000]], mano: 50000 });
  await menu(page, 'b-pdf');
  await aviso(page, /Guardado con el N° 16000/);
  igual(base.tablas.trabajos.map(t => [t.id_trabajo, t.numero_presupuesto]), [[1, 16000]], 'el mismo trabajo, ahora con número');
  igual(base.tablas.trabajo_items.map(i => [i.detalle, i.importe]), [['Óptica', 80000]], 'renglones');
});

prueba('Corregir un emitido conserva el número y no duplica renglones', async ({ abrir, base }) => {
  const tr = guardado(base, { numero_presupuesto: 16005 });
  base.agregar('trabajo_items', { id_trabajo: tr.id_trabajo, orden: 0, detalle: 'Capot', importe: 9000 });
  base.numero = 16006;
  const page = await abrir();
  await abrirDelHistorial(page, 'N° 16005');
  igual(await page.textContent('#b-pend'), 'Guardar cambios', 'botón sobre un emitido');
  await cargar(page, { mano: 7000 });
  await menu(page, 'b-pend');
  await aviso(page, /Cambios guardados en el N° 16005/);
  igual(base.contar('POST', '/rest/v1/rpc/fn_proximo_numero_presupuesto'), 0, 'números pedidos');
  igual(base.tablas.trabajos.map(t => [t.numero_presupuesto, t.monto_mano_obra]), [[16005, 7000]], 'el trabajo');
  igual(base.tablas.trabajo_items.map(i => i.detalle), ['Capot'], 'renglones');
});

prueba('Si fallan los renglones, volver a guardar corrige el mismo presupuesto (H18)', async ({ abrir, base }) => {
  base.fallarUnaVez('POST', '/rest/v1/trabajo_items');
  const page = await abrir();
  await cargar(page, COMPLETO);
  await menu(page, 'b-pdf');
  await aviso(page, /se guardó pero los renglones no/);
  igual(await page.textContent('#nro'), '16000', 'N° en la hoja después del error');
  await menu(page, 'b-pdf');
  await aviso(page, /Guardado con el N° 16000/);
  igual(base.contar('POST', '/rest/v1/rpc/fn_proximo_numero_presupuesto'), 1, 'números pedidos');
  igual(base.tablas.trabajos.length, 1, 'trabajos en la base');
  igual(base.tablas.trabajo_items.length, 2, 'renglones');
});

prueba('El auto que vuelve propone su cliente y no duplica la ficha', async ({ abrir, base }) => {
  base.agregar('clientes', { nombre: 'Juan Pérez', telefono: '2255 999' });
  base.agregar('vehiculos', { patente: 'AB123CD', descripcion: 'Fiat Palio', id_cliente_ultimo: 1 });
  const page = await abrir();
  await page.fill('#patente', 'ab-123-cd');
  await page.locator('#patente').blur();
  await page.waitForFunction(() => document.getElementById('cliente').value === 'Juan Pérez');
  igual(await page.inputValue('#vehiculo'), 'Fiat Palio', 'vehículo propuesto');
  await cargar(page, { fecha: '2026-10-16', mano: 1000 });
  await menu(page, 'b-pdf');
  await aviso(page, /Guardado con el N° 16000/);
  igual(base.tablas.clientes.length, 1, 'fichas de cliente');
  igual(base.tablas.trabajos[0].id_cliente, 1, 'cliente del trabajo');
});

prueba('Si el auto cambió de dueño, se crea otra ficha y la anterior queda igual', async ({ abrir, base }) => {
  base.agregar('clientes', { nombre: 'Juan Pérez', telefono: '2255 999' });
  base.agregar('vehiculos', { patente: 'AB123CD', descripcion: 'Fiat Palio', id_cliente_ultimo: 1 });
  const page = await abrir();
  await page.fill('#patente', 'AB123CD');
  await page.locator('#patente').blur();
  await page.waitForFunction(() => document.getElementById('cliente').value === 'Juan Pérez');
  await cargar(page, { cliente: 'Marta Sosa', telefono: '2255 000', fecha: '2026-10-16', mano: 1000 });
  await menu(page, 'b-pdf');
  await aviso(page, /Guardado con el N° 16000/);
  igual(base.tablas.clientes.map(c => [c.nombre, c.telefono]), [['Juan Pérez', '2255 999'], ['Marta Sosa', '2255 000']], 'fichas');
});

prueba('Buscar en el historial por nombre sin acentos, patente o número', async ({ abrir, base }) => {
  base.agregar('clientes', { nombre: 'José Peña' });
  base.agregar('vehiculos', { patente: 'AC456EF' });
  guardado(base, { numero_presupuesto: 16000, id_cliente: 1, txt_cliente: 'José Peña' });
  guardado(base, { numero_presupuesto: 16001, txt_cliente: 'Otro Cliente', id_vehiculo: 1 });
  guardado(base, { numero_presupuesto: 16002, txt_cliente: 'Tercero' });
  const page = await abrir();
  await menu(page, 'b-hist');
  await page.locator('#lista .item').nth(2).waitFor();
  const lista = () => page.$$eval('#lista .item .i-n', xs => xs.map(x => x.textContent).join('|'));
  const buscar = async (texto, esperado) => {
    await page.fill('#buscar', texto);
    try{
      await page.waitForFunction(e => [...document.querySelectorAll('#lista .item .i-n')]
        .map(x => x.textContent).join('|') === e, esperado, { timeout: 5000 });
    }catch(e){
      throw new Error('buscando "' + texto + '" esperaba ' + esperado + ', dio ' + await lista());
    }
  };
  await buscar('peña', 'N° 16000 — José Peña');
  await buscar('ac 456', 'N° 16001 — Otro Cliente');
  await buscar('16002', 'N° 16002 — Tercero');
});

prueba('Descartar un pendiente; un emitido no se puede descartar', async ({ abrir, base }) => {
  guardado(base, { numero_presupuesto: null, txt_cliente: 'Pendiente Uno' });
  guardado(base, { numero_presupuesto: 16000, txt_cliente: 'Emitido Uno' });
  const page = await abrir();
  await menu(page, 'b-hist');
  const emitido = page.locator('#lista .item', { hasText: 'Emitido Uno' });
  await emitido.locator('.i-ficha').click();
  igual(await page.locator('.ficha .f-descartar').count(), 0, 'botón Descartar en un emitido');
  await emitido.locator('.i-ficha').click();
  const pendiente = page.locator('#lista .item', { hasText: 'Pendiente Uno' });
  await pendiente.locator('.i-ficha').click();
  await page.click('.ficha .f-descartar');
  await aviso(page, /Pendiente descartado/);
  igual(base.tablas.trabajos.map(t => t.txt_cliente), ['Emitido Uno'], 'lo que queda en la base');
});

prueba('La ficha guarda si se concretó y el origen', async ({ abrir, base }) => {
  guardado(base);
  const page = await abrir();
  await menu(page, 'b-hist');
  await page.locator('#lista .item .i-ficha').first().click();
  await page.check('.ficha .f-no');
  await page.waitForFunction(() => document.querySelector('.ficha .f-estado').textContent === 'guardado');
  await page.selectOption('.ficha .f-org', 'siniestro');
  await page.waitForFunction(() => /siniestro/.test(document.querySelector('#lista .item .i-n').textContent));
  igual([base.tablas.trabajos[0].no_concretado, base.tablas.trabajos[0].origen], [true, 'siniestro'], 'la ficha en la base');
});

prueba('El CSV sale con sus columnas, renglones y mano de obra', async ({ abrir, base }) => {
  base.agregar('clientes', { nombre: 'Ana Ruiz' });
  base.agregar('vehiculos', { patente: 'AB123CD' });
  /* El trabajo dice 'Ana' y 'ab-123-cd'; el CSV tiene que traer lo de la ficha, como la vista. */
  const tr = guardado(base, { id_cliente: 1, id_vehiculo: 1, txt_cliente: 'Ana', txt_chasis: 'CH1', txt_vehiculo: 'Gol', txt_patente: 'ab-123-cd',
                              detalle_mano_obra: 'Pintura', observaciones: 'Ojo; con "comillas"',
                              creado_en: '2026-10-01T10:00:00+00:00', modificado_en: '2026-10-02T10:00:00+00:00' });
  base.agregar('trabajo_items', { id_trabajo: tr.id_trabajo, orden: 1, detalle: 'Faro', importe: 2000 });
  base.agregar('trabajo_items', { id_trabajo: tr.id_trabajo, orden: 0, detalle: '=Paragolpe', importe: 1000.5 });
  guardado(base, { numero_presupuesto: null, fecha_presupuesto: '2026-10-02', txt_cliente: 'Sin Ficha', txt_telefono: null,
                   monto_mano_obra: 0, creado_en: '2026-10-02T10:00:00+00:00', modificado_en: '2026-10-02T10:00:00+00:00' });
  const page = await abrir();
  const csv = await bajarCSV(page);
  ok(csv, 'no se descargó nada');
  ok(csv.startsWith('﻿'), 'falta el BOM al principio');
  const fin = ';2026-10-01T10:00:00+00:00;2026-10-02T10:00:00+00:00';
  const izq = '16000;2026-10-01;Ana Ruiz;CH1;2255;Gol;AB123CD;';
  igual(csv.slice(1).split('\n'), [
    'numero_presupuesto;fecha_consulta;nombre_cliente;chasis;telefono;vehiculo;patente;detalle;importe;' +
      'subtotal_repuestos;monto_mano_obra;monto_total;observaciones;creado_en;modificado_en',
    ';2026-10-02;Sin Ficha;;;;;;;0;0;0;;2026-10-02T10:00:00+00:00;2026-10-02T10:00:00+00:00',
    izq + "'=Paragolpe;1000.5;3000.5;5000;8000.5;\"Ojo; con \"\"comillas\"\"\"" + fin,
    izq + 'Faro;2000;3000.5;5000;8000.5;"Ojo; con ""comillas"""' + fin,
    izq + 'Mano de obra — Pintura;5000;3000.5;5000;8000.5;"Ojo; con ""comillas"""' + fin,
  ], 'el CSV');
  await aviso(page, /CSV descargado \(2 presupuestos\)/);
});

prueba('El CSV de más de 1000 presupuestos sale entero', async ({ abrir, base }) => {
  for(let k = 0; k < 1100; k++) guardado(base, { numero_presupuesto: k < 3 ? null : 16000 + k, txt_cliente: 'C' + k });
  const page = await abrir();
  const csv = await bajarCSV(page);
  ok(csv, 'no se descargó nada');
  igual(csv.split('\n').length, 1101, 'filas del CSV');
  igual(base.pedidos.filter(p => p.metodo === 'GET' && p.ruta === '/rest/v1/trabajos').length, 3, 'consultas');
  await aviso(page, /CSV descargado \(1100 presupuestos\)/);
});

prueba('Si el historial cambia mientras se arma el CSV, no se descarga', async ({ abrir, base }) => {
  for(let k = 0; k < 1100; k++) guardado(base, { numero_presupuesto: k < 3 ? null : 16000 + k, txt_cliente: 'C' + k });
  base.alResponder = ({ tabla, query }) => {
    if(tabla === 'trabajos' && query.get('offset') === '0')
      base.tablas.trabajos = base.tablas.trabajos.filter(t => t.id_trabajo !== 1);     // alguien descarta un pendiente
  };
  const page = await abrir();
  ok(!(await bajarCSV(page)), 'descargó un CSV que podía estar incompleto');
  await aviso(page, /cambió mientras se armaba/);
});

prueba('El borrador se ofrece al volver, y después de guardar ya no', async ({ abrir }) => {
  const page = await abrir();
  await cargar(page, { cliente: 'Carla Díaz', renglones: [['Puerta', 5000]] });
  await page.waitForFunction(() => localStorage.getItem('semaforo-borrador'));
  await page.reload();
  await page.waitForSelector('#borrador.abierto');
  ok(/Carla Díaz/.test(await page.textContent('#br-quien')), 'el aviso no dice de quién era');
  await page.click('#br-recuperar');
  igual(await page.inputValue('#cliente'), 'Carla Díaz', 'cliente recuperado');
  igual(await page.inputValue('#items tr:first-child .det'), 'Puerta', 'renglón recuperado');
  await menu(page, 'b-pend');
  await aviso(page, /Guardado como pendiente/);
  await page.reload();
  await esperarApp(page);
  await page.waitForTimeout(300);
  igual(await page.locator('#borrador.abierto').count(), 0, 'ofrece un borrador ya guardado');
});

prueba('Con la sesión vencida pide entrar de nuevo, sin perder lo cargado', async ({ abrir, base }) => {
  const page = await abrir();
  await cargar(page, { cliente: 'Hugo Paz' });
  base.vencerSesiones();
  await menu(page, 'b-hist');
  await page.waitForSelector('#login.abierto');
  ok(/La sesión venció/.test(await page.textContent('#login-error')), 'no dice que la sesión venció');
  await entrar(page, 'clave');
  await esperarApp(page);
  igual(await page.inputValue('#cliente'), 'Hugo Paz', 'lo cargado después de volver a entrar');
});

prueba('Si sólo venció el token, se renueva solo y no pide entrar', async ({ abrir, base }) => {
  guardado(base);
  const page = await abrir();
  base.tokens.clear();                              // el token vence; el de renovación sigue sirviendo
  await menu(page, 'b-hist');
  await page.locator('#lista .item').first().waitFor();
  igual(await page.locator('#login.abierto').count(), 0, 'pidió entrar de nuevo');
  igual(base.contar('POST', '/auth/v1/token'), 1, 'renovaciones');
});

prueba('El borrador de un usuario no se le ofrece a otro', async ({ abrir, base }) => {
  base.usuarios.push({ email: 'otro@semaforo.test', password: 'clave2', sub: 'usuario-2' });
  const page = await abrir();
  await cargar(page, { cliente: 'De Usuario Uno' });
  await page.waitForFunction(() => localStorage.getItem('semaforo-borrador'));
  await page.evaluate(() => localStorage.removeItem('semaforo-sesion'));
  await page.reload();
  await entrar(page, 'clave2', 'otro@semaforo.test');
  await esperarApp(page);
  await page.waitForTimeout(300);
  igual(await page.locator('#borrador.abierto').count(), 0, 'le ofreció el borrador de otro usuario');
});

/* ===================== correr ===================== */
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const filtro = process.argv[2] ? new RegExp(process.argv[2], 'i') : null;
  let fallas = 0, corridas = 0;
  for(const p of pruebas){
    if(filtro && !filtro.test(p.nombre)) continue;
    corridas++;
    const base = crearBase(p.opciones);
    const abiertas = [];
    const abrir = async o => { const pg = await abrirPagina(browser, base, o); abiertas.push(pg); return pg; };
    try{
      await p.fn({ abrir, base });
      const errores = abiertas.flatMap(pg => pg.errores);
      if(errores.length) throw new Error('error de JavaScript en la página: ' + errores[0]);
      console.log('PASA   ' + p.nombre);
    }catch(e){
      fallas++;
      const donde = (e.message.match(/waiting for .*/) || [''])[0];
      console.log('FALLA  ' + p.nombre + '\n         ' + e.message.split('\n')[0] + (donde ? '\n         ' + donde : ''));
    }finally{
      for(const pg of abiertas) await pg.context().close();
    }
  }
  await browser.close();
  console.log('\n' + (corridas - fallas) + ' de ' + corridas + ' pasan');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
