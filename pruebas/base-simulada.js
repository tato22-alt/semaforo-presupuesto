/* Una imitación de Supabase en memoria, para probar la página sin tocar la base real.

   Copia de la base lo que la página usa: las cuatro tablas con sus columnas, los
   controles (CHECK, únicos, claves foráneas), la vista vw_presupuestos, la numeración
   y la política que sólo deja borrar pendientes. Todo sale de las migraciones de
   tato22-alt/semaforo-modelo-datos; si la base cambia, esto también.

   Lo que NO puede garantizar: que la sintaxis que manda la página la acepte el
   PostgREST de verdad. Acá se entiende lo que la página usa hoy; una consulta mal
   escrita puede pasar acá y fallar allá. Eso sólo lo confirma la base real.

   A propósito, es estricta: si la página pide una columna que no existe, contesta
   400 igual que PostgREST, en vez de devolver cualquier cosa. */

'use strict';

const COLUMNAS = {
  clientes:      ['id_cliente', 'nombre', 'nombre_norm', 'telefono', 'direccion', 'email', 'cuit', 'creado_en'],
  vehiculos:     ['id_vehiculo', 'patente', 'patente_norm', 'descripcion', 'chasis', 'id_cliente_ultimo', 'creado_en'],
  trabajos:      ['id_trabajo', 'numero_presupuesto', 'id_cliente', 'id_vehiculo', 'fecha_presupuesto',
                  'txt_cliente', 'txt_direccion', 'txt_telefono', 'txt_vehiculo', 'txt_patente',
                  'monto_mano_obra', 'no_concretado', 'origen', 'creado_en', 'modificado_en', 'origen_carga',
                  'txt_chasis', 'observaciones', 'detalle_mano_obra'],
  trabajo_items: ['id_item', 'id_trabajo', 'orden', 'detalle', 'importe'],
  vw_presupuestos: ['id_trabajo', 'numero_presupuesto', 'fecha_presupuesto', 'id_cliente', 'cliente_actual',
                  'txt_cliente', 'id_vehiculo', 'patente_norm', 'txt_vehiculo', 'subtotal_conceptos',
                  'monto_mano_obra', 'monto_total', 'cantidad_conceptos', 'no_concretado', 'origen',
                  'creado_en', 'modificado_en', 'cliente_norm', 'txt_chasis', 'observaciones', 'detalle_mano_obra'],
};
const CLAVE      = { clientes: 'id_cliente', vehiculos: 'id_vehiculo', trabajos: 'id_trabajo', trabajo_items: 'id_item' };
const GENERADAS  = { clientes: ['nombre_norm'], vehiculos: ['patente_norm'] };

/* Las relaciones que PostgREST deduce de las claves foráneas. */
const EMBEBIBLES = {
  trabajos:  { trabajo_items: { muchos: true, de: 'id_trabajo', a: 'id_trabajo' },
               clientes:      { de: 'id_cliente', a: 'id_cliente' },
               vehiculos:     { de: 'id_vehiculo', a: 'id_vehiculo' } },
  vehiculos: { clientes:      { de: 'id_cliente_ultimo', a: 'id_cliente' } },
};

/* Las mismas normalizaciones que la base (fn_normalizar_nombre, fn_normalizar_patente). */
const normNombre  = t => t == null ? null :
  t.replace(/\s+/g, ' ').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const normPatente = t => t == null ? null : t.replace(/[\s.\-]/g, '').toUpperCase();
const centavos    = n => Math.round(Number(n) * 100) / 100;

function crearBase(opciones = {}){
  const t = { clientes: [], vehiculos: [], trabajos: [], trabajo_items: [] };
  const siguienteId = { clientes: 1, vehiculos: 1, trabajos: 1, trabajo_items: 1 };
  const base = {
    maxRows: opciones.maxRows || 1000,          // Supabase corta cada respuesta acá, sin avisar
    usuarios: [{ email: 'taller@semaforo.test', password: 'clave', sub: 'usuario-1' }],
    numero: 16000,                              // seq_numero_presupuesto: start with 16000
    tokens: new Set(), refrescos: new Map(),
    pedidos: [],                                // todo lo que pidió la página, para controlar
    fallas: [],                                 // respuestas de error preparadas por la prueba
    tablas: t,
    alResponder: null,                          // gancho para cambiar datos en medio de una consulta
    sinRed: false,                              // true: correr.js corta la conexión, como sin señal
  };

  /* ---------- filas ---------- */
  function conGeneradas(tabla, f){
    if(tabla === 'clientes')  return { ...f, nombre_norm: normNombre(f.nombre) };
    if(tabla === 'vehiculos') return { ...f, patente_norm: normPatente(f.patente) };
    return f;
  }

  function vista(){
    return t.trabajos.map(tr => {
      const c = t.clientes.find(x => x.id_cliente === tr.id_cliente);
      const v = t.vehiculos.find(x => x.id_vehiculo === tr.id_vehiculo);
      const items = t.trabajo_items.filter(i => i.id_trabajo === tr.id_trabajo);
      const sub = centavos(items.reduce((s, i) => s + i.importe, 0));
      return {
        id_trabajo: tr.id_trabajo, numero_presupuesto: tr.numero_presupuesto,
        fecha_presupuesto: tr.fecha_presupuesto, id_cliente: tr.id_cliente,
        cliente_actual: c ? c.nombre : null, txt_cliente: tr.txt_cliente, id_vehiculo: tr.id_vehiculo,
        patente_norm: v ? normPatente(v.patente) : null, txt_vehiculo: tr.txt_vehiculo,
        subtotal_conceptos: sub, monto_mano_obra: tr.monto_mano_obra,
        monto_total: centavos(sub + tr.monto_mano_obra), cantidad_conceptos: items.length,
        no_concretado: tr.no_concretado, origen: tr.origen, creado_en: tr.creado_en,
        modificado_en: tr.modificado_en, cliente_norm: c ? normNombre(c.nombre) : null,
        txt_chasis: tr.txt_chasis, observaciones: tr.observaciones, detalle_mano_obra: tr.detalle_mano_obra,
      };
    });
  }

  const filas = tabla => tabla === 'vw_presupuestos' ? vista() : t[tabla].map(f => conGeneradas(tabla, f));

  /* ---------- controles de la base ---------- */
  class ErrorBase extends Error {
    constructor(status, code, message){ super(message); this.status = status; this.code = code; }
  }

  function controlar(tabla, f){
    const existe = (tb, col, v) => v == null || t[tb].some(x => x[col] === v);
    if(tabla === 'clientes' && !(f.nombre && f.nombre.trim()))
      throw new ErrorBase(400, '23514', 'clientes_nombre_no_vacio');
    if(tabla === 'vehiculos'){
      if(!(f.patente && f.patente.trim())) throw new ErrorBase(400, '23514', 'vehiculos_patente_no_vacia');
      if(t.vehiculos.some(x => x !== f && normPatente(x.patente) === normPatente(f.patente)))
        throw new ErrorBase(409, '23505', 'ux_vehiculos_patente_norm');
      if(!existe('clientes', 'id_cliente', f.id_cliente_ultimo)) throw new ErrorBase(409, '23503', 'vehiculos_id_cliente_ultimo_fkey');
    }
    if(tabla === 'trabajos'){
      if(f.numero_presupuesto != null && f.numero_presupuesto < 16000)
        throw new ErrorBase(400, '23514', 'trabajos_numero_presupuesto_rango');
      if(f.numero_presupuesto != null && t.trabajos.some(x => x !== f && x.numero_presupuesto === f.numero_presupuesto))
        throw new ErrorBase(409, '23505', 'ux_trabajos_numero_presupuesto');
      if(f.monto_mano_obra == null) throw new ErrorBase(400, '23502', 'null value in column "monto_mano_obra" violates not-null constraint');
      if(!(f.monto_mano_obra >= 0)) throw new ErrorBase(400, '23514', 'trabajos_monto_mano_obra_no_negativo');
      if(f.origen != null && !['particular', 'siniestro'].includes(f.origen))
        throw new ErrorBase(400, '23514', 'trabajos_origen_dominio');
      if(!['presupuesto_web', 'manual', 'importacion'].includes(f.origen_carga))
        throw new ErrorBase(400, '23514', 'trabajos_origen_carga_dominio');
      if(!existe('clientes', 'id_cliente', f.id_cliente))   throw new ErrorBase(409, '23503', 'trabajos_id_cliente_fkey');
      if(!existe('vehiculos', 'id_vehiculo', f.id_vehiculo)) throw new ErrorBase(409, '23503', 'trabajos_id_vehiculo_fkey');
    }
    if(tabla === 'trabajo_items'){
      if(!t.trabajos.some(x => x.id_trabajo === f.id_trabajo)) throw new ErrorBase(409, '23503', 'trabajo_items_id_trabajo_fkey');
      if(f.importe == null) throw new ErrorBase(400, '23502', 'null value in column "importe" violates not-null constraint');
      if(!(f.orden >= 0)) throw new ErrorBase(400, '23514', 'trabajo_items_orden_no_negativo');
    }
  }

  function revisarColumnas(tabla, datos){
    for(const col of Object.keys(datos)){
      if(!COLUMNAS[tabla].includes(col)) throw new ErrorBase(400, 'PGRST204', `Could not find the '${col}' column of '${tabla}'`);
      if(col === CLAVE[tabla] || (GENERADAS[tabla] || []).includes(col))
        throw new ErrorBase(400, '428C9', `cannot insert a non-DEFAULT value into column "${col}"`);
    }
  }

  function normalizarValores(tabla, f){
    if('importe' in f && f.importe != null) f.importe = centavos(f.importe);
    if('monto_mano_obra' in f && f.monto_mano_obra != null) f.monto_mano_obra = centavos(f.monto_mano_obra);
    return f;
  }

  function insertar(tabla, datos){
    revisarColumnas(tabla, datos);
    const ahora = new Date().toISOString();
    const defectos = {
      clientes: { telefono: null, direccion: null, email: null, cuit: null, creado_en: ahora },
      vehiculos: { descripcion: null, chasis: null, id_cliente_ultimo: null, creado_en: ahora },
      trabajos: Object.fromEntries(COLUMNAS.trabajos.map(c => [c, null])),
      trabajo_items: { detalle: null, importe: 0 },
    }[tabla];
    if(tabla === 'trabajos') Object.assign(defectos, { monto_mano_obra: 0, no_concretado: false, creado_en: ahora, modificado_en: ahora });
    const f = normalizarValores(tabla, { ...defectos, ...datos, [CLAVE[tabla]]: siguienteId[tabla] });
    delete f.nombre_norm; delete f.patente_norm;
    controlar(tabla, f);
    siguienteId[tabla]++;
    t[tabla].push(f);
    return f;
  }

  /* ---------- lo que entiende de la sintaxis de PostgREST ---------- */
  /* Separa por comas que no estén entre paréntesis ni entre comillas dobles. */
  function partirArriba(texto){
    const partes = []; let nivel = 0, comillas = false, actual = '';
    for(let i = 0; i < texto.length; i++){
      const ch = texto[i];
      if(comillas && ch === '\\'){ actual += ch + (texto[i + 1] || ''); i++; continue; }
      if(ch === '"') comillas = !comillas;
      if(!comillas && ch === '(') nivel++;
      if(!comillas && ch === ')') nivel--;
      if(ch === ',' && nivel === 0 && !comillas){ partes.push(actual); actual = ''; }
      else actual += ch;
    }
    if(actual) partes.push(actual);
    return partes;
  }

  /* Un valor entre comillas dobles es literal: adentro \" es una comilla y \\ una barra. */
  const sacarComillas = v => /^".*"$/s.test(v) ? v.slice(1, -1).replace(/\\(.)/g, '$1') : v;

  /* Las columnas enteras: PostgREST le pasa el valor a Postgres, que lo convierte a
     número. "016000" encuentra el 16000, y uno que no entra en un integer da error. */
  const ENTERAS = ['id_cliente', 'id_vehiculo', 'id_trabajo', 'id_item', 'id_cliente_ultimo',
                   'numero_presupuesto', 'orden', 'cantidad_conceptos'];

  function proyectar(tabla, fila, select){
    const salida = {};
    for(const parte of partirArriba(select || '*')){
      const m = /^(\w+)\((.*)\)$/.exec(parte);
      if(m){
        const rel = (EMBEBIBLES[tabla] || {})[m[1]];
        if(!rel) throw new ErrorBase(400, 'PGRST200', `Could not find a relationship between '${tabla}' and '${m[1]}'`);
        const relacionadas = filas(m[1]).filter(x => x[rel.a] === fila[rel.de]);
        salida[m[1]] = rel.muchos ? relacionadas.map(x => proyectar(m[1], x, m[2]))
                                  : (relacionadas[0] ? proyectar(m[1], relacionadas[0], m[2]) : null);
      }else if(parte === '*'){
        for(const c of COLUMNAS[tabla]) salida[c] = fila[c];
      }else{
        if(!COLUMNAS[tabla].includes(parte)) throw new ErrorBase(400, '42703', `column ${tabla}.${parte} does not exist`);
        salida[parte] = fila[parte];
      }
    }
    return salida;
  }

  function condicion(tabla, col, expr){
    if(!COLUMNAS[tabla].includes(col)) throw new ErrorBase(400, '42703', `column ${tabla}.${col} does not exist`);
    const m = /^(eq|ilike|is|in)\.(.*)$/s.exec(expr);
    if(!m) throw new ErrorBase(400, 'PGRST100', `failed to parse filter (${expr})`);
    const op = m[1], valor = sacarComillas(m[2]);
    if(op === 'eq' && ENTERAS.includes(col)){
      if(!/^\s*[+-]?\d+\s*$/.test(valor)) throw new ErrorBase(400, '22P02', `invalid input syntax for type integer: "${valor}"`);
      if(Math.abs(Number(valor)) > 2147483647) throw new ErrorBase(400, '22003', `value "${valor}" is out of range for type integer`);
      return f => f[col] === Number(valor);
    }
    if(op === 'eq')    return f => f[col] != null && String(f[col]) === valor;
    if(op === 'is')    return f => valor === 'null' ? f[col] == null : String(f[col]) === valor;
    if(op === 'in')    { const vs = valor.replace(/^\(|\)$/g, '').split(','); return f => vs.includes(String(f[col])); }
    const re = new RegExp('^' + valor.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i');
    return f => f[col] != null && re.test(String(f[col]));
  }

  function filtrar(tabla, params){
    const conds = [];
    for(const [clave, valor] of params){
      if(['select', 'order', 'limit', 'offset'].includes(clave)) continue;
      if(clave === 'or'){
        const m = /^\((.*)\)$/s.exec(valor);
        if(!m) throw new ErrorBase(400, 'PGRST100', 'failed to parse logic tree');
        const alts = partirArriba(m[1]).map(p => {
          const k = /^(\w+)\.(.*)$/s.exec(p);
          if(!k) throw new ErrorBase(400, 'PGRST100', `failed to parse logic tree (${valor})`);
          return condicion(tabla, k[1], k[2]);
        });
        conds.push(f => alts.some(c => c(f)));
      }else conds.push(condicion(tabla, clave, valor));
    }
    return filas(tabla).filter(f => conds.every(c => c(f)));
  }

  function ordenar(tabla, lista, order){
    if(!order) return lista;
    const claves = order.split(',').map(o => {
      const [col, dir = 'asc', nulls] = o.split('.');
      if(!COLUMNAS[tabla].includes(col)) throw new ErrorBase(400, '42703', `column ${tabla}.${col} does not exist`);
      return { col, desc: dir === 'desc', nullsPrimero: nulls ? nulls === 'nullsfirst' : dir === 'desc' };
    });
    return lista.slice().sort((a, b) => {
      for(const k of claves){
        const x = a[k.col], y = b[k.col];
        if(x == null && y == null) continue;
        if(x == null) return k.nullsPrimero ? -1 : 1;
        if(y == null) return k.nullsPrimero ? 1 : -1;
        if(x < y) return k.desc ? 1 : -1;
        if(x > y) return k.desc ? -1 : 1;
      }
      return 0;
    });
  }

  /* ---------- auth ---------- */
  function emitirSesion(sub){
    const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
    const access = b64({ alg: 'HS256' }) + '.' + b64({ sub, role: 'authenticated', n: Math.random() }) + '.firma';
    const refresh = 'refresh-' + Math.random().toString(36).slice(2);
    base.tokens.add(access);
    base.refrescos.set(refresh, sub);
    return { access_token: access, refresh_token: refresh, expires_in: 3600, token_type: 'bearer' };
  }

  /* Una sesión ya iniciada, para no pasar por el login en cada prueba. */
  base.sesionPara = (sub = 'usuario-1') => {
    const s = emitirSesion(sub);
    return { access_token: s.access_token, refresh_token: s.refresh_token, expira_en: Date.now() + 3600e3 };
  };
  base.vencerSesiones = () => { base.tokens.clear(); base.refrescos.clear(); };

  /* ---------- la respuesta a cada pedido ---------- */
  base.responder = (metodo, url, headers, cuerpo) => {
    const u = new URL(url);
    base.pedidos.push({ metodo, ruta: u.pathname, query: u.search, cuerpo });
    const falla = base.fallas.find(x => x.metodo === metodo && u.pathname.startsWith(x.ruta) && x.veces > 0);
    if(falla){ falla.veces--; return { status: falla.status || 500, cuerpo: { message: 'falla preparada por la prueba' } }; }

    try{
      /* El gateway de Supabase pide la apikey en /auth/v1 igual que en /rest/v1. */
      if(!headers.apikey) return { status: 401, cuerpo: { message: 'No API key found in request' } };
      if(u.pathname === '/auth/v1/token'){
        const d = JSON.parse(cuerpo || '{}');
        if(u.searchParams.get('grant_type') === 'password'){
          const us = base.usuarios.find(x => x.email === d.email && x.password === d.password);
          /* Así contesta hoy Supabase Auth cuando la página no manda X-Supabase-Api-Version. */
          if(!us) return { status: 400, cuerpo: { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' } };
          return { status: 200, cuerpo: emitirSesion(us.sub) };
        }
        const sub = base.refrescos.get(d.refresh_token);
        if(!sub) return { status: 400, cuerpo: { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' } };
        base.refrescos.delete(d.refresh_token);           // Supabase rota el refresh token
        return { status: 200, cuerpo: emitirSesion(sub) };
      }

      const token = (headers.authorization || '').replace(/^Bearer /, '');
      if(!base.tokens.has(token)) return { status: 401, cuerpo: { code: 'PGRST301', message: 'JWT expired' } };

      if(u.pathname === '/rest/v1/rpc/fn_proximo_numero_presupuesto' && metodo === 'POST')
        return { status: 200, cuerpo: base.numero++ };

      const tabla = u.pathname.replace('/rest/v1/', '');
      if(!COLUMNAS[tabla]) return { status: 404, cuerpo: { code: '42P01', message: `relation "${tabla}" does not exist` } };
      const p = u.searchParams;
      const prefer = headers.prefer || '';
      const devolver = /return=representation/.test(prefer);

      if(metodo === 'GET'){
        let lista = ordenar(tabla, filtrar(tabla, p), p.get('order'));
        const total = lista.length;
        const desde = Number(p.get('offset') || 0);
        const cuantos = Math.min(Number(p.get('limit') || Infinity), base.maxRows);
        lista = lista.slice(desde, desde + cuantos);
        const salida = lista.map(f => proyectar(tabla, f, p.get('select')));
        const rango = lista.length ? desde + '-' + (desde + lista.length - 1) : '*';
        const extra = { 'Content-Range': rango + '/' + (/count=exact/.test(prefer) ? total : '*') };
        if(base.alResponder) base.alResponder({ metodo, tabla, query: p });
        return { status: 200, cuerpo: salida, headers: extra };
      }
      if(tabla === 'vw_presupuestos') return { status: 405, cuerpo: { message: 'la vista es de sólo lectura' } };

      if(metodo === 'POST'){
        const datos = JSON.parse(cuerpo);
        const nuevas = (Array.isArray(datos) ? datos : [datos]).map(d => insertar(tabla, d));
        return { status: 201, cuerpo: devolver ? nuevas.map(f => proyectar(tabla, conGeneradas(tabla, f), p.get('select'))) : null };
      }

      const elegidas = filtrar(tabla, p).map(f => t[tabla].find(x => x[CLAVE[tabla]] === f[CLAVE[tabla]]));
      if(metodo === 'PATCH'){
        const cambio = JSON.parse(cuerpo);
        revisarColumnas(tabla, cambio);
        for(const f of elegidas){
          const antes = { ...f };
          Object.assign(f, normalizarValores(tabla, { ...cambio }));
          try{ controlar(tabla, f); }catch(e){ Object.assign(f, antes); throw e; }
        }
        return { status: devolver ? 200 : 204, cuerpo: devolver ? elegidas.map(f => proyectar(tabla, conGeneradas(tabla, f), p.get('select'))) : null };
      }
      if(metodo === 'DELETE'){
        /* La base real sí deja borrar clientes y vehículos; la página nunca lo hace,
           así que acá se rechaza para que un borrado nuevo no pase sin que se note. */
        if(tabla === 'clientes' || tabla === 'vehiculos')
          return { status: 403, cuerpo: { code: '42501', message: `permission denied for table ${tabla}` } };
        /* trabajos_borrar_solo_sin_numero es RESTRICTIVA: lo que no cumple no da
           error, simplemente no se borra (RF-507). */
        const borrables = tabla === 'trabajos' ? elegidas.filter(f => f.numero_presupuesto == null) : elegidas;
        t[tabla] = t[tabla].filter(f => !borrables.includes(f));
        if(tabla === 'trabajos'){                          // on delete cascade
          const ids = borrables.map(f => f.id_trabajo);
          t.trabajo_items = t.trabajo_items.filter(i => !ids.includes(i.id_trabajo));
        }
        return { status: devolver ? 200 : 204, cuerpo: devolver ? borrables.map(f => proyectar(tabla, conGeneradas(tabla, f), p.get('select'))) : null };
      }
      return { status: 405, cuerpo: { message: 'método no soportado' } };
    }catch(e){
      if(e instanceof ErrorBase) return { status: e.status, cuerpo: { code: e.code, message: e.message } };
      throw e;
    }
  };

  /* ---------- atajos para preparar datos en las pruebas ---------- */
  base.agregar = (tabla, datos) => conGeneradas(tabla, insertar(tabla, datos));
  base.fallarUnaVez = (metodo, ruta, status = 500) => base.fallas.push({ metodo, ruta, status, veces: 1 });
  base.contar = (metodo, ruta) => base.pedidos.filter(x => x.metodo === metodo && x.ruta === ruta).length;
  base.vista = vista;

  return base;
}

module.exports = { crearBase, normNombre, normPatente };
