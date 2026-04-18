import React, { useState, useEffect } from 'react';
import { supabase } from '../../api/supabase';
import { 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Activity } from 'lucide-react';

export const Reportes = () => {
  const [loading, setLoading] = useState(true);
  const [tipoCambio, setTipoCambio] = useState(18.50);
  const [fechaInicio, setFechaInicio] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  
  // Estados temporales para el filtro
  const [tempFechaInicio, setTempFechaInicio] = useState(fechaInicio);
  const [tempFechaFin, setTempFechaFin] = useState(fechaFin);

  const [detalles, setDetalles] = useState([]);
  const [citas, setCitas] = useState([]);
  const [estilistas, setEstilistas] = useState([]);
  const [prestamos, setPrestamos] = useState([]);
  const [usoInterno, setUsoInterno] = useState([]);
  const [stockAlerta, setStockAlerta] = useState([]); 

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const { data: config } = await supabase.from('configuracion').select('*').eq('clave', 'tipo_cambio').single();
      if (config) setTipoCambio(config.valor);

      const { data: eData } = await supabase.from('estilistas').select('*').eq('activo', true);
      setEstilistas(eData || []);

      const { data: dData, error: dError } = await supabase
        .from('ventas_detalles')
        .select(`
          *,
          inventario(nombre, tipo, precio_compra),
          ventas!inner(id, fecha, estilista_id, monto_total_mxn, monto_total_usd, metodo_pago, moneda_pago, cita_id)
        `)
        .gte('ventas.fecha', `${fechaInicio}T00:00:00Z`)
        .lte('ventas.fecha', `${fechaFin}T23:59:59Z`);

      if (dError) throw dError;
      setDetalles(dData || []);

      const { data: cData } = await supabase
        .from('citas')
        .select('*')
        .gte('fecha_inicio', `${fechaInicio}T00:00:00Z`)
        .lte('fecha_inicio', `${fechaFin}T23:59:59Z`);
      setCitas(cData || []);

      const { data: pData } = await supabase.from('prestamos')
        .select('*')
        .not('estatus', 'in', '("pagado","inactivo")');
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

  // --- CALCULOS DE KPIs ---
  const ventasUnicas = Array.from(new Set(detalles.map(d => d.venta_id))).map(id => {
    const v = detalles.find(d => d.venta_id === id).ventas;
    return { ...v, total_real_mxn: parseFloat(v.monto_total_mxn || 0) + (parseFloat(v.monto_total_usd || 0) * tipoCambio) };
  });

  const ingresoTotal = ventasUnicas.reduce((sum, v) => sum + v.total_real_mxn, 0);
  const ticketPromedio = ventasUnicas.length > 0 ? ingresoTotal / ventasUnicas.length : 0;
  const totalOperaciones = ventasUnicas.length;

  const revenueMix = detalles.reduce((acc, d) => {
    acc[d.tipo] = (acc[d.tipo] || 0) + parseFloat(d.subtotal || 0);
    return acc;
  }, { servicio: 0, producto: 0 });

  const totalRevenueItems = revenueMix.servicio + revenueMix.producto;
  const percServicios = totalRevenueItems > 0 ? (revenueMix.servicio / totalRevenueItems) * 100 : 0;

  // --- CÁLCULOS OPERATIVOS ---
  const citasBooked = citas.length;
  const citasPaid = citas.filter(c => c.estatus === 'pagada').length;
  const percEfectividad = citasBooked > 0 ? (citasPaid / citasBooked) * 100 : 0;

  const ventasDesdeCita = ventasUnicas.filter(v => v.cita_id).length;
  const ventasDirectas = totalOperaciones - ventasDesdeCita;
  const percVentasCita = totalOperaciones > 0 ? (ventasDesdeCita / totalOperaciones) * 100 : 0;

  // --- FILTROS RAPIDOS ---
  const setRango = (dias) => {
    const fin = new Date().toISOString().split('T')[0];
    const inicio = new Date(new Date().setDate(new Date().getDate() - dias)).toISOString().split('T')[0];
    setFechaFin(fin);
    setFechaInicio(inicio);
    setTempFechaFin(fin);
    setTempFechaInicio(inicio);
  };

  const ventasPorDia = ventasUnicas.reduce((acc, v) => {
    const f = new Date(v.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    if (!acc[f]) acc[f] = { total: 0, count: 0 };
    acc[f].total += v.total_real_mxn;
    acc[f].count += 1;
    return acc;
  }, {});

  const dataGrafica = Object.entries(ventasPorDia).map(([fecha, info]) => ({ fecha, total: info.total, count: info.count })).sort((a, b) => a.fecha.localeCompare(b.fecha));

  const dataOrigen = Object.entries(ventasUnicas.reduce((acc, v) => {
    const f = new Date(v.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    if (!acc[f]) acc[f] = { fecha: f, desdeCita: 0, ventaDirecta: 0 };
    if (v.cita_id) acc[f].desdeCita += 1;
    else acc[f].ventaDirecta += 1;
    return acc;
  }, {})).map(([_, val]) => val).sort((a, b) => a.fecha.localeCompare(b.fecha));

  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const concurrenciaSemanal = citas.reduce((acc, c) => {
    const day = new Date(c.fecha_inicio).getDay();
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0});
  const maxConcurrencia = Math.max(...Object.values(concurrenciaSemanal), 1);

  const corteCaja = ventasUnicas.reduce((acc, v) => {
    const llave = `${v.moneda_pago || 'MXN'} - ${v.metodo_pago || 'Efectivo'}`;
    acc[llave] = (acc[llave] || 0) + (v.moneda_pago === 'MXN' ? parseFloat(v.monto_total_mxn || 0) : parseFloat(v.monto_total_usd || 0));
    return acc;
  }, {});

  const nominaMaestra = estilistas.map(est => {
    const servicios = detalles.filter(d => d.ventas.estilista_id === est.id && d.tipo === 'servicio');
    const totalVentaEstilista = servicios.reduce((sum, d) => sum + parseFloat(d.subtotal || 0), 0);
    const totalComision = servicios.reduce((sum, d) => sum + (parseFloat(d.subtotal || 0) * ((est.comision_porcentaje || 0) / 100)), 0);
    const costoUso = usoInterno.filter(u => u.id_estilista === est.id).reduce((sum, u) => sum + (u.cantidad * (parseFloat(u.inventario?.precio_compra || 0))), 0);
    const deudaVales = prestamos.filter(p => p.id_estilista === est.id).reduce((sum, p) => sum + parseFloat(p.saldo_pendiente || 0), 0);
    const numCitas = new Set(servicios.map(s => s.venta_id)).size;
    
    return { 
      nombre: est.nombre, 
      totalVenta: totalVentaEstilista,
      comision: totalComision, 
      vales: deudaVales 
    };
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


  if (loading && detalles.length === 0) return (
    <div className="p-20 text-center text-[var(--color-acento)] font-black uppercase flex flex-col items-center gap-4 animate-pulse">
      <div className="w-12 h-12 border-4 border-[var(--color-acento)] border-t-transparent rounded-full animate-spin"></div>
      <span style={{ fontSize: '0.9em' }}>Iniciando Analíticas...</span>
    </div>
  );

  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in pb-20 relative">
      {/* OVERLAY DE CARGA (SUAVE) */}
      {loading && (
        <div className="fixed top-24 right-10 z-[200] bg-[var(--color-acento)] text-black px-4 py-2 rounded-full font-black uppercase text-[10px] flex items-center gap-2 shadow-2xl animate-bounce">
          <div className="w-2 h-2 bg-black rounded-full animate-ping"></div>
          Actualizando...
        </div>
      )}

      {/* HEADER & FILTERS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h2 className="font-serif italic text-4xl md:text-5xl text-[var(--color-texto-componente)] leading-tight">Tablero de <span className="text-[var(--color-acento)]">Control</span></h2>
          <p className="font-bold opacity-30 uppercase tracking-[0.3em] mt-2 text-[var(--color-texto-componente)]" style={{ fontSize: '0.6em' }}>Análisis estratégico en tiempo real</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 bg-[var(--color-componente)] p-3 rounded-[2rem] border border-[var(--color-borde)] w-full xl:w-auto shadow-xl">
          <div className="flex gap-1 bg-black/20 p-1 rounded-xl">
            <button type="button" onClick={() => setRango(0)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${fechaInicio === fechaFin ? 'bg-[var(--color-acento)] text-black' : 'opacity-40'}`}>Hoy</button>
            <button type="button" onClick={() => setRango(7)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${new Date(fechaInicio).getTime() === new Date(new Date().setDate(new Date().getDate() - 7)).getTime() ? 'bg-[var(--color-acento)] text-black' : 'opacity-40'}`}>7d</button>
            <button type="button" onClick={() => setRango(30)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${new Date(fechaInicio).getTime() === new Date(new Date().setDate(new Date().getDate() - 30)).getTime() ? 'bg-[var(--color-acento)] text-black' : 'opacity-40'}`}>30d</button>
          </div>
          <div className="flex gap-2 items-center">
            <input 
              type="date" 
              value={tempFechaInicio} 
              onChange={(e) => setTempFechaInicio(e.target.value)} 
              className="bg-[var(--color-secundario)] rounded-xl font-bold text-[var(--color-texto-componente)] p-2 outline-none text-[10px]" 
            />
            <span className="opacity-30">/</span>
            <input 
              type="date" 
              value={tempFechaFin} 
              onChange={(e) => setTempFechaFin(e.target.value)} 
              className="bg-[var(--color-secundario)] rounded-xl font-bold text-[var(--color-texto-componente)] p-2 outline-none text-[10px]" 
            />
            <button 
              type="button" 
              onClick={() => {
                setFechaInicio(tempFechaInicio);
                setFechaFin(tempFechaFin);
              }}
              className="bg-[var(--color-acento)] text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:scale-105 transition-all shadow-lg"
            >
              Filtrar
            </button>
          </div>
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {[
          { label: 'Ingreso Total', val: `$${ingresoTotal.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, sub: 'MXN unificado', icon: '💰', color: 'text-emerald-400' },
          { label: 'Ticket Promedio', val: `$${ticketPromedio.toFixed(0)}`, sub: 'Por cliente', icon: '🎫', color: 'text-amber-400' },
          { label: 'Operaciones', val: totalOperaciones, sub: 'Ventas realizadas', icon: '⚡', color: 'text-sky-400' },
          { label: 'Mix Servicios', val: `${percServicios.toFixed(0)}%`, sub: 'Frente a productos', icon: '🎭', color: 'text-rose-400' },
        ].map((kpi, i) => (
          <div key={i} className="bg-[var(--color-componente)] p-6 md:p-8 rounded-[2.5rem] shadow-2xl border border-[var(--color-borde)] group hover:border-[var(--color-acento)]/50 transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 text-4xl opacity-[0.05] grayscale group-hover:grayscale-0 group-hover:opacity-10 transition-all">{kpi.icon}</div>
            <p className="font-black opacity-30 uppercase tracking-widest mb-2" style={{ fontSize: '0.65em' }}>{kpi.label}</p>
            <p className={`text-4xl font-serif italic ${kpi.color}`}>{kpi.val}</p>
            <p className="text-[10px] font-bold opacity-30 uppercase mt-2 tracking-tighter">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* OPERATIONAL ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[var(--color-componente)] p-8 rounded-[3.5rem] shadow-2xl border border-[var(--color-borde)] flex items-center gap-8 relative overflow-hidden">
          <div className="relative w-32 h-32 flex-shrink-0">
             <svg className="w-full h-full transform -rotate-90">
               <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
               <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="364.4" strokeDashoffset={364.4 - (364.4 * percEfectividad) / 100} className="text-[var(--color-acento)] transition-all duration-1000" strokeLinecap="round" />
             </svg>
             <div className="absolute inset-0 flex flex-col items-center justify-center">
               <span className="text-2xl font-serif italic text-white">{percEfectividad.toFixed(0)}%</span>
             </div>
          </div>
          <div>
            <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.3em] mb-2" style={{ fontSize: '0.8em' }}>Eficiencia de Agenda</h3>
            <p className="text-[11px] font-medium opacity-40 uppercase leading-relaxed max-w-[200px]">Citas concretadas frente al total de agendadas.</p>
            <div className="mt-4 flex gap-6">
              <div><p className="text-[9px] font-black opacity-30 uppercase">Agendadas</p><p className="text-xl font-serif text-white">{citasBooked}</p></div>
              <div><p className="text-[9px] font-black opacity-30 uppercase">Cobradas</p><p className="text-xl font-serif text-emerald-500">{citasPaid}</p></div>
            </div>
          </div>
        </div>

        <div className="bg-[var(--color-componente)] p-8 rounded-[3.5rem] shadow-2xl border border-[var(--color-borde)] flex items-center gap-8 relative overflow-hidden">
           <div className="flex-grow">
              <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.3em] mb-4" style={{ fontSize: '0.8em' }}>Mapa de Calor de Concurrencia</h3>
              <div className="grid grid-cols-7 gap-2">
                 {diasSemana.map((dia, i) => {
                    const valor = concurrenciaSemanal[i];
                    const intensidad = (valor / maxConcurrencia);
                    return (
                      <div key={dia} className="flex flex-col items-center gap-2">
                         <div 
                           className="w-full aspect-square rounded-xl border border-white/5 flex items-center justify-center relative group transition-all duration-500"
                           style={{ 
                             backgroundColor: `rgba(197, 160, 89, ${0.05 + intensidad * 0.8})`,
                             boxShadow: intensidad > 0.7 ? '0 0 20px rgba(197, 160, 89, 0.2)' : 'none'
                           }}
                         >
                            <span className={`text-[10px] font-black ${intensidad > 0.5 ? 'text-black' : 'text-white'}`}>{valor}</span>
                            {/* TOOLTIP SIMPLE */}
                            <div className="absolute bottom-full mb-2 bg-white text-black text-[8px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none uppercase">
                               {valor} citas
                            </div>
                         </div>
                         <span className="text-[9px] font-black opacity-30 uppercase">{dia}</span>
                      </div>
                    );
                 })}
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* GRÁFICA PRINCIPAL: TENDENCIA PROFESIONAL (RECHARTS) */}
        <div className="xl:col-span-2 bg-[var(--color-componente)] p-8 md:p-12 rounded-[3.5rem] shadow-2xl border border-[var(--color-borde)]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
            <div>
              <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.3em] flex items-center gap-2" style={{ fontSize: '0.82em' }}>
                <Activity size={18} className="text-[var(--color-acento)]" />
                Tendencia de Rendimiento
              </h3>
              <p className="text-[9px] font-black opacity-30 mt-1 uppercase">Correlación entre ingresos y volumen</p>
            </div>
          </div>
          
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataGrafica} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-acento)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-acento)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="fecha" 
                  stroke="rgba(255,255,255,0.2)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontWeight: 'bold' }}
                  dy={10}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="var(--color-acento)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `$${val.toLocaleString('es-MX', { notation: 'compact' })}`}
                  tick={{ fill: 'var(--color-acento)', opacity: 0.5, fontWeight: 'bold' }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="#38bdf8" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: '#38bdf8', opacity: 0.5, fontWeight: 'bold' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(20, 20, 20, 0.95)', 
                    borderRadius: '24px', 
                    border: '1px solid var(--color-borde)', 
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(8px)',
                    padding: '16px'
                  }} 
                  itemStyle={{ fontWeight: 'bold', fontSize: '13px', padding: '2px 0' }}
                  labelStyle={{ color: 'rgba(255,255,255,0.4)', fontWeight: 'black', textTransform: 'uppercase', fontSize: '10px', marginBottom: '8px', letterSpacing: '0.1em' }}
                  formatter={(value, name) => [
                    name === 'total' ? `$${value.toLocaleString()}` : `${value} servicios`,
                    name === 'total' ? 'Ingresos' : 'Citas'
                  ]}
                />
                <Area 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="total" 
                  stroke="var(--color-acento)" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorTotal)" 
                  activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--color-acento)' }}
                />
                <Area 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="count" 
                  stroke="#38bdf8" 
                  strokeWidth={3} 
                  strokeDasharray="5 5"
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#38bdf8' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* REVENUE MIX & ALERTS */}
        <div className="space-y-8">
           <div className="bg-[var(--color-componente)] p-8 rounded-[3rem] shadow-2xl border border-[var(--color-borde)] h-[350px] relative overflow-hidden flex flex-col">
             <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.3em] mb-4" style={{ fontSize: '0.8em' }}>Origen de Venta</h3>
             <div className="flex-grow w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={dataOrigen} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis 
                        dataKey="fecha" 
                        stroke="rgba(255,255,255,0.2)" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        tick={{ fill: 'rgba(255,255,255,0.3)', fontWeight: 'bold' }}
                      />
                      <YAxis 
                        stroke="rgba(255,255,255,0.2)" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        tick={{ fill: 'rgba(255,255,255,0.3)', fontWeight: 'bold' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(20, 20, 20, 0.95)', 
                          borderRadius: '16px', 
                          border: '1px solid var(--color-borde)',
                          fontSize: '10px'
                        }}
                      />
                      <Bar dataKey="desdeCita" name="Desde Cita" stackId="a" fill="var(--color-acento)" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="ventaDirecta" name="Venta Directa" stackId="a" fill="rgba(255,255,255,0.1)" radius={[4, 4, 0, 0]} />
                   </BarChart>
                </ResponsiveContainer>
             </div>
             <div className="mt-4 flex justify-between items-center text-[10px] font-black uppercase opacity-40">
                <span>Total Citas: {ventasDesdeCita}</span>
                <span>Total Directas: {ventasDirectas}</span>
             </div>
           </div>

           <div className="bg-[var(--color-componente)] p-8 rounded-[3rem] shadow-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/[0.03] to-transparent">
             <h3 className="font-black text-rose-500 uppercase tracking-widest mb-6 flex items-center gap-2" style={{ fontSize: '0.75em' }}>
               <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span> Peligro Stock
             </h3>
             <div className="space-y-4 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
               {stockAlerta.length > 0 ? stockAlerta.map((item, i) => (
                 <div key={i} className="flex justify-between items-center bg-black/20 p-3 rounded-2xl border border-white/5">
                   <div className="truncate pr-4"><p className="font-serif italic text-[var(--color-texto-componente)] leading-none mb-1">{item.nombre}</p><p className="text-[8px] font-black opacity-30 uppercase tracking-widest">{item.stock_actual} en almacén</p></div>
                   <div className="text-right font-black text-rose-500" style={{ fontSize: '1em' }}>!</div>
                 </div>
               )) : <div className="text-center py-6 opacity-20 uppercase font-black" style={{ fontSize: '0.6em' }}>Inventario saludable</div>}
             </div>
           </div>
        </div>
      </div>

      {/* LIQUIDACIÓN PERSONAL & TOP 5 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-[var(--color-componente)] p-8 md:p-10 rounded-[3.5rem] shadow-2xl border border-[var(--color-borde)]">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.3em]" style={{ fontSize: '0.8em' }}>Top Eficiencia Personal</h3>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar">
            <table className="w-full text-left min-w-[500px]">
              <thead>
                <tr className="font-black opacity-20 uppercase border-b border-white/5 text-[var(--color-texto-componente)]" style={{ fontSize: '0.65em' }}>
                  <th className="pb-4">Estilista</th>
                  <th className="pb-4 text-center">Venta Total</th>
                  <th className="pb-4 text-center">Comisión</th>
                  <th className="pb-4 text-right">Total en Vales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {nominaMaestra.map((est, i) => (
                  <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="py-5 font-serif italic text-xl group-hover:text-[var(--color-acento)] transition-colors">{est.nombre}</td>
                    <td className="py-5 text-center font-black text-amber-500/60" style={{ fontSize: '0.85em' }}>${est.totalVenta.toFixed(0)}</td>
                    <td className="py-5 text-center text-emerald-500/80 font-bold" style={{ fontSize: '0.85em' }}>${est.comision.toFixed(2)}</td>
                    <td className="py-5 text-right font-black text-rose-500 text-xl">${est.vales.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-[var(--color-componente)] p-8 md:p-10 rounded-[3.5rem] shadow-2xl border border-[var(--color-borde)] flex flex-col">
          <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.3em] mb-8" style={{ fontSize: '0.8em' }}>Servicios Estrella</h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
             {obtenerTop5('servicio').map((s, i) => (
               <div key={i} className="flex items-center gap-4 bg-black/20 p-4 rounded-3xl group hover:bg-[var(--color-acento)]/10 transition-all border border-transparent hover:border-[var(--color-acento)]/20">
                 <div className="w-12 h-12 rounded-2xl bg-[var(--color-secundario)] flex items-center justify-center font-black text-[var(--color-acento)] text-xl shadow-inner">{i+1}</div>
                 <div className="flex-grow">
                   <p className="font-serif italic text-xl text-[var(--color-texto-componente)]">{s.nombre}</p>
                   <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest">{s.cantidad} realizados este periodo</p>
                 </div>
                 <div className="text-right">
                   <p className="font-serif italic text-xl text-[var(--color-acento)]">${s.total.toLocaleString()}</p>
                   <p className="text-[9px] font-black opacity-20 uppercase">Acumulado</p>
                 </div>
               </div>
             ))}
          </div>
          
          <div className="mt-8 pt-8 border-t border-white/5">
             <h3 className="font-bold text-[var(--color-acento)] uppercase tracking-[0.3em] mb-4" style={{ fontSize: '0.7em' }}>KPI de Mix de Servicio</h3>
             <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div><span className="text-[10px] font-black inline-block py-1 px-3 uppercase rounded-full bg-[var(--color-acento)] text-black">Servicios</span></div>
                  <div className="text-right flex items-center gap-2"><span className="text-2xl font-serif italic text-[var(--color-acento)]">{percServicios.toFixed(0)}%</span></div>
                </div>
                <div className="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-white/5">
                  <div style={{ width: `${percServicios}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-[var(--color-acento)] transition-all duration-1000"></div>
                </div>
             </div>
             <div className="flex justify-between items-center opacity-40">
                <span className="text-[10px] font-black uppercase">Venta Productos</span>
                <span className="font-serif italic text-lg">{(100 - percServicios).toFixed(0)}%</span>
             </div>
          </div>
        </div>
      </div>

    </div>
  );
};