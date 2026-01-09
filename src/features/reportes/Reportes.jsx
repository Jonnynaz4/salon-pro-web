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

      const { data: invData } = await supabase.from('inventario').select('id, nombre, stock_actual, stock_minimo').eq('tipo', 'producto');
      const alertasPromesas = (invData || []).filter(item => item.stock_actual <= item.stock_minimo).map(async (item) => {
          const { data: uc } = await supabase.from('compras').select('fecha_compra').eq('id_producto', item.id).order('fecha_compra', { ascending: false }).limit(1).single();
          return { ...item, ultima_fecha: uc ? new Date(uc.fecha_compra).toLocaleDateString() : 'Sin registro' };
      });
      const alertasResueltas = await Promise.all(alertasPromesas);
      setStockAlerta(alertasResueltas);
    } catch (err) { console.error(err); } finally { setLoading(false); }
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

  const dataGrafica = Object.entries(ventasPorDia).map(([fecha, total]) => ({ fecha, total })).sort((a, b) => a.fecha.localeCompare(b.fecha));
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
    const costoUso = usoInterno.filter(u => u.id_estilista === est.id).reduce((sum, u) => sum + (u.cantidad * (parseFloat(u.inventario?.precio_compra || 0))), 0);
    const deudaVales = prestamos.filter(p => p.id_estilista === est.id).reduce((sum, p) => sum + parseFloat(p.saldo_pendiente || 0), 0);
    return { nombre: est.nombre, comision: totalComision, usoInterno: costoUso, neto: (totalComision - costoUso) - deudaVales, vales: deudaVales };
  });

  const obtenerTop5 = (tipo) => {
    const agrupado = detalles.filter(d => d.tipo === tipo).reduce((acc, d) => {
      const nom = d.inventario?.nombre || 'Desconocido';
      if (!acc[nom]) acc[nom] = { total: 0, cantidad: 0 };
      acc[nom].total += parseFloat(d.subtotal || 0);
      acc[nom].cantidad += (d.cantidad || 1);
      return acc;
    }, {});
    return Object.entries(agrupado).map(([nombre, info]) => ({ nombre, ...info })).sort((a, b) => b.total - a.total).slice(0, 5);
  };

  if (loading) return <div className="p-20 text-center text-[var(--color-acento)] font-black uppercase" style={{ fontSize: '0.9em' }}>Cargando Analíticas...</div>;

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in pb-20">
      
      {/* HEADER */}
      <div className="bg-[var(--color-componente)] p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl border border-[var(--color-borde)] flex flex-col lg:flex-row justify-between items-center gap-6">
        <div className="text-center lg:text-left">
          <h2 className="font-serif italic text-3xl md:text-4xl text-[var(--color-texto-componente)] leading-tight">Estadísticas de <span className="text-[var(--color-acento)]">Venta</span></h2>
          <p className="font-bold opacity-40 uppercase tracking-[0.2em] mt-2 text-[var(--color-texto-componente)]" style={{ fontSize: '0.65em' }}>Control de ingresos y personal</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 bg-[var(--color-secundario)] p-3 rounded-2xl border border-[var(--color-borde)] w-full lg:w-auto">
          <input type="date" value={fechaInicio} onChange={(e)=>setFechaInicio(e.target.value)} className="bg-[var(--color-fondo)] rounded-xl font-bold text-[var(--color-texto-componente)] p-2 outline-none w-full" style={{ fontSize: '0.8em' }} />
          <input type="date" value={fechaFin} onChange={(e)=>setFechaFin(e.target.value)} className="bg-[var(--color-fondo)] rounded-xl font-bold text-[var(--color-texto-componente)] p-2 outline-none w-full" style={{ fontSize: '0.8em' }} />
        </div>
      </div>

      {/* GRÁFICA */}
      <div className="bg-[var(--color-componente)] p-6 md:p-12 rounded-[2.5rem] md:rounded-[4rem] shadow-2xl border border-[var(--color-borde)]">
        <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.3em] mb-10" style={{ fontSize: '0.8em' }}>Ingresos Diarios (MXN)</h3>
        <div className="overflow-x-auto pb-4 custom-scrollbar">
          <div className="relative h-[300px] flex items-end justify-between gap-4 border-b border-[var(--color-borde)] pb-2 min-w-[600px]">
            {dataGrafica.map((item, idx) => (
              <div key={idx} className="flex-grow flex flex-col items-center group relative z-10">
                <div className="absolute -top-12 bg-[var(--color-acento)] text-[var(--color-texto-acento)] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-[0.8em] font-black">${item.total.toFixed(0)}</div>
                <div className="w-full max-w-[40px] bg-gradient-to-t from-[var(--color-acento)]/40 to-[var(--color-acento)] rounded-t-xl transition-all" style={{ height: `${(item.total / maxVenta) * 250}px`, minHeight: '5px' }}></div>
                <span className="font-bold opacity-40 uppercase mt-4 text-[var(--color-texto-componente)]" style={{ fontSize: '0.6em' }}>{item.fecha}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ALERTAS */}
      <div className="bg-[var(--color-componente)] p-6 md:p-10 rounded-[2.5rem] shadow-2xl border border-[var(--color-borde)]">
        <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.3em] mb-8" style={{ fontSize: '0.8em' }}>⚠️ Stock Crítico</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stockAlerta.length > 0 ? stockAlerta.map((item, i) => (
            <div key={i} className="bg-[var(--color-secundario)] p-5 rounded-[1.5rem] border border-[var(--color-borde)] flex flex-col justify-between">
              <div>
                <h4 className="font-serif italic text-lg text-[var(--color-texto-componente)] truncate">{item.nombre}</h4>
                <p className="font-bold text-[var(--color-acento)] uppercase opacity-60" style={{ fontSize: '0.6em' }}>Última: {item.ultima_fecha}</p>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div><p className="text-[0.6em] font-black opacity-30 uppercase">Stock</p><p className="text-2xl font-black text-[var(--color-acento)]">{item.stock_actual}</p></div>
                <div className="text-right"><p className="text-[0.6em] font-black opacity-30 uppercase">Min</p><p className="text-sm font-bold opacity-60">{item.stock_minimo}</p></div>
              </div>
            </div>
          )) : <div className="col-span-full p-8 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 text-center text-emerald-500 font-bold" style={{ fontSize: '0.8em' }}>✅ Inventario Óptimo</div>}
        </div>
      </div>

      {/* CAJA Y NÓMINA */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-10">
        <div className="bg-[var(--color-componente)] p-6 md:p-10 rounded-[2.5rem] shadow-2xl border border-[var(--color-borde)]">
          <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.3em] mb-8" style={{ fontSize: '0.8em' }}>Flujo de Caja</h3>
          <div className="space-y-3">
            {Object.entries(corteCaja).map(([llave, total]) => (
              <div key={llave} className="flex justify-between items-center bg-[var(--color-secundario)] p-4 rounded-xl border border-[var(--color-borde)]">
                <span className="font-black opacity-40 uppercase truncate mr-2" style={{ fontSize: '0.7em' }}>{llave}</span>
                <span className="font-serif italic text-xl text-[var(--color-acento)]">${total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-2 bg-[var(--color-componente)] p-6 md:p-10 rounded-[2.5rem] shadow-2xl border border-[var(--color-borde)]">
          <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.3em] mb-8" style={{ fontSize: '0.8em' }}>Liquidación Personal</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="font-black opacity-30 uppercase border-b border-[var(--color-borde)] text-[var(--color-texto-componente)]" style={{ fontSize: '0.7em' }}>
                  <th className="pb-4">Estilista</th><th className="pb-4 text-center">Comisión</th><th className="pb-4 text-center">Deduc.</th><th className="pb-4 text-right">Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-borde)]">
                {nominaMaestra.map((est, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="py-4 font-serif italic text-lg">{est.nombre}</td>
                    <td className="py-4 text-center text-emerald-500 font-bold" style={{ fontSize: '0.9em' }}>${est.comision.toFixed(2)}</td>
                    <td className="py-4 text-center text-rose-500 font-bold" style={{ fontSize: '0.9em' }}>${(est.usoInterno + est.vales).toFixed(2)}</td>
                    <td className="py-4 text-right font-black text-[var(--color-acento)] text-lg">${est.neto.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* TOP 5 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
        {['servicio', 'producto'].map(tipo => (
          <div key={tipo} className="bg-[var(--color-componente)] p-6 md:p-10 rounded-[2.5rem] shadow-2xl border border-[var(--color-borde)]">
            <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.3em] mb-8" style={{ fontSize: '0.8em' }}>Top 5 {tipo}s</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[400px]">
                <thead>
                  <tr className="font-black opacity-30 uppercase border-b border-[var(--color-borde)] text-[var(--color-texto-componente)]" style={{ fontSize: '0.7em' }}>
                    <th className="pb-4">Nombre</th><th className="pb-4 text-center">#</th><th className="pb-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {obtenerTop5(tipo).map((s, i) => (
                    <tr key={i} className="border-b border-[var(--color-borde)] last:border-0">
                      <td className="py-4 font-serif italic text-lg truncate max-w-[150px]">{s.nombre}</td>
                      <td className="py-4 text-center opacity-60" style={{ fontSize: '0.8em' }}>{s.cantidad}</td>
                      <td className="py-4 text-right font-serif text-xl text-[var(--color-acento)]">${s.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};