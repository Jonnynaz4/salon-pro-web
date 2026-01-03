import React, { useState, useEffect } from 'react';
import { supabase } from '../../api/supabase';

export const Reportes = () => {
  const [loading, setLoading] = useState(true);
  const [fechaInicio, setFechaInicio] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  
  const [detalles, setDetalles] = useState([]);
  const [estilistas, setEstilistas] = useState([]);
  const [prestamos, setPrestamos] = useState([]);
  const [usoInterno, setUsoInterno] = useState([]);
  const [stockAlerta, setStockAlerta] = useState([]); 

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const { data: eData } = await supabase.from('estilistas').select('*').eq('activo', true);
      setEstilistas(eData || []);

      const { data: dData, error: dError } = await supabase
        .from('ventas_detalles')
        .select(`
          *,
          inventario(nombre, tipo, precio_compra),
          ventas!inner(fecha, estilista_id, monto_total_mxn, monto_total_usd, metodo_pago, moneda_pago)
        `)
        .gte('ventas.fecha', `${fechaInicio}T00:00:00Z`)
        .lte('ventas.fecha', `${fechaFin}T23:59:59Z`);

      if (dError) throw dError;
      setDetalles(dData || []);

      const { data: pData } = await supabase.from('prestamos').select('*').neq('estatus', 'pagado');
      setPrestamos(pData || []);

      const { data: uData } = await supabase
        .from('uso_interno')
        .select('*, inventario(precio_compra)')
        .gte('fecha_uso', `${fechaInicio}T00:00:00Z`)
        .lte('fecha_uso', `${fechaFin}T23:59:59Z`);
      setUsoInterno(uData || []);

      const { data: invData } = await supabase
        .from('inventario')
        .select('id, nombre, stock_actual, stock_minimo')
        .eq('tipo', 'producto');

      const alertasPromesas = (invData || [])
        .filter(item => item.stock_actual <= item.stock_minimo)
        .map(async (item) => {
          const { data: ultimaCompra } = await supabase
            .from('compras')
            .select('fecha_compra')
            .eq('id_producto', item.id)
            .order('fecha_compra', { ascending: false })
            .limit(1)
            .single();
          
          return {
            ...item,
            ultima_fecha: ultimaCompra ? new Date(ultimaCompra.fecha_compra).toLocaleDateString() : 'Sin registro'
          };
        });

      const alertasResueltas = await Promise.all(alertasPromesas);
      setStockAlerta(alertasResueltas);

    } catch (err) {
      console.error("Error en Reportes:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarDatos(); }, [fechaInicio, fechaFin]);

  const ventasPorDia = detalles.reduce((acc, d) => {
    const f = new Date(d.ventas.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    const ventaId = d.venta_id;
    if (!acc.procesadas) acc.procesadas = new Set();
    if (!acc.procesadas.has(ventaId)) {
      acc[f] = (acc[f] || 0) + parseFloat(d.ventas.monto_total_mxn || 0);
      acc.procesadas.add(ventaId);
    }
    return acc;
  }, {});
  delete ventasPorDia.procesadas;

  const dataGrafica = Object.entries(ventasPorDia)
    .map(([fecha, total]) => ({ fecha, total }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const maxVenta = Math.max(...dataGrafica.map(d => d.total), 500);

  const corteCaja = detalles.reduce((acc, d) => {
    const v = d.ventas;
    if (!acc.procesadas) acc.procesadas = new Set();
    if (!acc.procesadas.has(d.venta_id)) {
      const llave = `${v.moneda_pago || 'MXN'} - ${v.metodo_pago || 'Efectivo'}`;
      acc[llave] = (acc[llave] || 0) + (v.moneda_pago === 'MXN' ? parseFloat(v.monto_total_mxn || 0) : parseFloat(v.monto_total_usd || 0));
      acc.procesadas.add(d.venta_id);
    }
    return acc;
  }, {});
  delete corteCaja.procesadas;

  const nominaMaestra = estilistas.map(est => {
    const servicios = detalles.filter(d => d.ventas.estilista_id === est.id && d.tipo === 'servicio');
    const totalComision = servicios.reduce((sum, d) => sum + (parseFloat(d.subtotal || 0) * ((est.comision_porcentaje || 0) / 100)), 0);
    const costoUso = usoInterno
      .filter(u => u.id_estilista === est.id)
      .reduce((sum, u) => sum + (u.cantidad * (parseFloat(u.inventario?.precio_compra || 0))), 0);
    const deudaVales = prestamos
      .filter(p => p.id_estilista === est.id)
      .reduce((sum, p) => sum + parseFloat(p.saldo_pendiente || 0), 0);

    return {
      nombre: est.nombre,
      comision: totalComision,
      usoInterno: costoUso,
      subtotal: totalComision - costoUso,
      vales: deudaVales,
      neto: (totalComision - costoUso) - deudaVales
    };
  });

  const resumenDeudas = estilistas.map(est => {
    const deuda = prestamos
      .filter(p => p.id_estilista === est.id && p.saldo_pendiente > 0)
      .reduce((sum, p) => sum + parseFloat(p.saldo_pendiente || 0), 0);
    return { nombre: est.nombre, total: deuda };
  }).filter(r => r.total > 0);

  const obtenerTop5 = (tipo) => {
    const agrupado = detalles.filter(d => d.tipo === tipo).reduce((acc, d) => {
      const nom = d.inventario?.nombre || 'Desconocido';
      if (!acc[nom]) acc[nom] = { total: 0, cantidad: 0 };
      acc[nom].total += parseFloat(d.subtotal || 0);
      acc[nom].cantidad += (d.cantidad || 1);
      return acc;
    }, {});
    return Object.entries(agrupado)
      .map(([nombre, info]) => ({ nombre, ...info }))
      .sort((a, b) => b.total - a.total).slice(0, 5);
  };

  if (loading) return <div className="p-20 text-center text-[var(--color-acento)] font-black uppercase tracking-[0.3em]" style={{ fontSize: '0.9em' }}>Cargando Analíticas...</div>;

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      
      {/* HEADER DINÁMICO */}
      <div className="bg-[var(--color-componente)] p-10 rounded-[3rem] shadow-2xl border border-[var(--color-borde)] flex flex-col lg:flex-row justify-between items-center gap-8">
        <div>
          <h2 className="font-serif italic text-4xl text-[var(--color-texto-componente)] leading-tight">Estadísticas <br/> <span className="text-[var(--color-acento)]">de Venta</span></h2>
          <p className="font-bold opacity-40 uppercase tracking-[0.4em] mt-3 text-[var(--color-texto-componente)]" style={{ fontSize: '0.7em' }}>Control de ingresos y capital humano</p>
        </div>
        <div className="flex gap-4 bg-[var(--color-secundario)] p-4 rounded-[2rem] border border-[var(--color-borde)] shadow-inner">
          <input type="date" value={fechaInicio} onChange={(e)=>setFechaInicio(e.target.value)} className="bg-[var(--color-fondo)] rounded-xl font-bold text-[var(--color-texto-componente)] p-3 outline-none border border-[var(--color-borde)] focus:border-[var(--color-acento)]" style={{ fontSize: '0.85em' }} />
          <input type="date" value={fechaFin} onChange={(e)=>setFechaFin(e.target.value)} className="bg-[var(--color-fondo)] rounded-xl font-bold text-[var(--color-texto-componente)] p-3 outline-none border border-[var(--color-borde)] focus:border-[var(--color-acento)]" style={{ fontSize: '0.85em' }} />
        </div>
      </div>

      {/* GRÁFICA DINÁMICA */}
      <div className="bg-[var(--color-componente)] p-12 rounded-[4rem] shadow-2xl border border-[var(--color-borde)] relative">
        <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.4em] mb-16" style={{ fontSize: '0.85em' }}>Rendimiento Diario (MXN)</h3>
        <div className="relative h-[400px] w-full flex items-end justify-between gap-4 border-b border-[var(--color-borde)] pb-2">
          {dataGrafica.map((item, idx) => (
            <div key={idx} className="flex-grow flex flex-col items-center group relative z-10">
              <div className="absolute -top-16 bg-[var(--color-acento)] text-[var(--color-texto-acento)] p-3 rounded-2xl opacity-0 group-hover:opacity-100 transition-all shadow-xl text-center min-w-[80px] font-black">
                <p className="font-serif italic text-lg">${item.total.toFixed(0)}</p>
              </div>
              <div className="w-full max-w-[60px] bg-gradient-to-t from-[var(--color-acento)] to-[var(--color-acento)] opacity-20 group-hover:opacity-100 rounded-t-2xl transition-all duration-700"
                style={{ height: `${(item.total / maxVenta) * 350}px`, minHeight: '10px' }}></div>
              <span className="font-bold opacity-40 uppercase mt-6 tracking-tighter text-[var(--color-texto-componente)]" style={{ fontSize: '0.75em' }}>{item.fecha}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ALERTAS DINÁMICAS */}
      <div className="bg-[var(--color-componente)] p-10 rounded-[3rem] shadow-2xl border border-[var(--color-borde)]">
        <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.4em] mb-8" style={{ fontSize: '0.85em' }}>⚠️ Alerta de Inventario Crítico</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stockAlerta.length > 0 ? stockAlerta.map((item, i) => (
            <div key={i} className="bg-[var(--color-secundario)] p-6 rounded-[2rem] border border-[var(--color-borde)] flex flex-col justify-between hover:border-[var(--color-acento)] transition-all">
              <div>
                <h4 className="font-serif italic text-xl text-[var(--color-texto-componente)] leading-tight mb-1">{item.nombre}</h4>
                <p className="font-bold text-[var(--color-acento)] uppercase tracking-widest opacity-60" style={{ fontSize: '0.65em' }}>Última: {item.ultima_fecha}</p>
              </div>
              <div className="mt-6 flex items-end justify-between text-[var(--color-texto-componente)]">
                <div>
                  <p className="font-black opacity-30 uppercase" style={{ fontSize: '0.65em' }}>Stock</p>
                  <p className="text-3xl font-black text-[var(--color-acento)] leading-none">{item.stock_actual}</p>
                </div>
                <div className="text-right">
                  <p className="font-black opacity-30 uppercase" style={{ fontSize: '0.65em' }}>Mínimo</p>
                  <p className="text-lg font-bold opacity-60 leading-none">{item.stock_minimo}</p>
                </div>
              </div>
            </div>
          )) : (
            <div className="col-span-full p-10 bg-[var(--color-secundario)] rounded-[2rem] border border-emerald-900/30 text-center">
                <p className="font-bold text-emerald-500 uppercase tracking-widest" style={{ fontSize: '0.85em' }}>✅ Inventario en niveles óptimos</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        <div className="bg-[var(--color-componente)] p-10 rounded-[3rem] shadow-2xl border border-[var(--color-borde)]">
          <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.4em] mb-8" style={{ fontSize: '0.85em' }}>Flujo de Caja</h3>
          <div className="space-y-4">
            {Object.entries(corteCaja).map(([llave, total]) => (
              <div key={llave} className="flex justify-between items-center bg-[var(--color-secundario)] p-5 rounded-2xl border border-[var(--color-borde)]">
                <span className="font-black opacity-40 text-[var(--color-texto-componente)] uppercase tracking-widest" style={{ fontSize: '0.75em' }}>{llave}</span>
                <span className="font-serif italic text-2xl text-[var(--color-acento)]">${total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-2 bg-[var(--color-componente)] p-10 rounded-[3rem] shadow-2xl border border-[var(--color-borde)]">
          <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.4em] mb-8" style={{ fontSize: '0.85em' }}>Liquidación de Personal</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="font-black opacity-30 uppercase border-b border-[var(--color-borde)] text-[var(--color-texto-componente)]" style={{ fontSize: '0.75em' }}>
                  <th className="pb-4">Estilista</th>
                  <th className="pb-4 text-center">Comisión</th>
                  <th className="pb-4 text-center">Deducción</th>
                  <th className="pb-4 text-right text-[var(--color-acento)]">Neto Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-borde)]">
                {nominaMaestra.map((est, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors group">
                    <td className="py-4 font-serif italic text-xl text-[var(--color-texto-componente)]">{est.nombre}</td>
                    <td className="py-4 text-center font-bold text-emerald-500" style={{ fontSize: '0.95em' }}>${est.comision.toFixed(2)}</td>
                    <td className="py-4 text-center font-bold text-rose-500" style={{ fontSize: '0.95em' }}>${(est.usoInterno + est.vales).toFixed(2)}</td>
                    <td className="py-4 text-right font-black text-[var(--color-acento)] text-xl group-hover:scale-110 transition-transform origin-right">${est.neto.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-componente)] p-12 rounded-[4rem] shadow-2xl border border-[var(--color-borde)] border-l-8 border-l-[var(--color-acento)]">
        <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.4em] mb-10" style={{ fontSize: '0.85em' }}>Deudas Pendientes</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {resumenDeudas.length > 0 ? resumenDeudas.map((res, i) => (
            <div key={i} className="bg-[var(--color-secundario)] p-8 rounded-[2.5rem] border border-[var(--color-borde)] flex justify-between items-center">
              <div>
                <h4 className="font-serif italic text-2xl text-[var(--color-texto-componente)]">{res.nombre}</h4>
                <p className="font-bold opacity-30 uppercase mt-1 tracking-widest text-[var(--color-texto-componente)]" style={{ fontSize: '0.7em' }}>Saldo</p>
              </div>
              <div className="text-right"><span className="font-bold text-3xl text-rose-500">${res.total.toFixed(2)}</span></div>
            </div>
          )) : <p className="opacity-30 italic uppercase tracking-widest text-[var(--color-texto-componente)]" style={{ fontSize: '0.75em' }}>No hay deudas activas.</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        <div className="bg-[var(--color-componente)] p-12 rounded-[4rem] shadow-2xl border border-[var(--color-borde)]">
          <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.4em] mb-8" style={{ fontSize: '0.85em' }}>Top 5 Servicios</h3>
          <table className="w-full text-left text-[var(--color-texto-componente)]">
            <thead>
              <tr className="font-black opacity-30 uppercase border-b border-[var(--color-borde)]" style={{ fontSize: '0.75em' }}>
                <th className="pb-4">Nombre</th>
                <th className="pb-4">Vendidos</th>
                <th className="pb-4 text-right text-[var(--color-acento)]">Total</th>
              </tr>
            </thead>
            <tbody>
              {obtenerTop5('servicio').map((s, i) => (
                <tr key={i} className="border-b border-[var(--color-borde)] hover:bg-white/5 transition-all">
                  <td className="py-4 font-serif italic text-xl">{s.nombre}</td>
                  <td className="py-4" style={{ fontSize: '0.85em' }}>{s.cantidad}</td>
                  <td className="py-4 text-right font-serif text-xl text-[var(--color-acento)]">${s.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-[var(--color-componente)] p-12 rounded-[4rem] shadow-2xl border border-[var(--color-borde)]">
          <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.4em] mb-8" style={{ fontSize: '0.85em' }}>Top 5 Productos</h3>
          <table className="w-full text-left text-[var(--color-texto-componente)]">
            <thead>
              <tr className="font-black opacity-30 uppercase border-b border-[var(--color-borde)]" style={{ fontSize: '0.75em' }}>
                <th className="pb-4">Nombre</th>
                <th className="pb-4">Vendidos</th>
                <th className="pb-4 text-right text-[var(--color-acento)]">Total</th>
              </tr>
            </thead>
            <tbody>
              {obtenerTop5('producto').map((p, i) => (
                <tr key={i} className="border-b border-[var(--color-borde)] hover:bg-white/5 transition-all">
                  <td className="py-4 font-serif italic text-xl">{p.nombre}</td>
                  <td className="py-4" style={{ fontSize: '0.85em' }}>{p.cantidad}</td>
                  <td className="py-4 text-right font-serif text-xl text-[var(--color-acento)]">${p.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};