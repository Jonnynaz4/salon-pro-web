import React, { useState, useEffect } from 'react';
import { supabase } from '../../api/supabase';

export const PrestamosEstilistas = () => {
  const [prestamos, setPrestamos] = useState([]);
  const [estilistas, setEstilistas] = useState([]);
  const [nuevoPrestamo, setNuevoPrestamo] = useState({
    id_estilista: '',
    monto_total: '',
    fecha_vencimiento: '',
    notas: ''
  });

  // --- ESTADOS PARA LA VENTANA DE ABONO ---
  const [modalAbono, setModalAbono] = useState(false);
  const [valeSeleccionado, setValeSeleccionado] = useState(null);
  const [montoAbono, setMontoAbono] = useState('');

  useEffect(() => {
    fetchDatos();
  }, []);

  const fetchDatos = async () => {
    const { data: est } = await supabase.from('estilistas').select('*');
    setEstilistas(est || []);
    
    const { data: pres } = await supabase
      .from('prestamos')
      .select('*, estilistas(nombre)')
      .order('fecha_vencimiento', { ascending: true });
    setPrestamos(pres || []);
  };

  const manejarGuardar = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('prestamos').insert([{
      id_estilista: nuevoPrestamo.id_estilista,
      monto_total: parseFloat(nuevoPrestamo.monto_total),
      saldo_pendiente: parseFloat(nuevoPrestamo.monto_total),
      fecha_vencimiento: nuevoPrestamo.fecha_vencimiento,
      notas: nuevoPrestamo.notas,
      estatus: 'pendiente'
    }]);
    
    if (!error) {
      setNuevoPrestamo({ id_estilista: '', monto_total: '', fecha_vencimiento: '', notas: '' });
      fetchDatos();
    }
  };

  // --- LÓGICA PARA REGISTRAR EL ABONO ---
  const manejarAbono = async (e) => {
    e.preventDefault();
    if (!valeSeleccionado || !montoAbono) return;

    const pago = parseFloat(montoAbono);
    const nuevoSaldo = valeSeleccionado.saldo_pendiente - pago;
    const nuevoEstatus = nuevoSaldo <= 0 ? 'pagado' : 'parcial';

    const { error } = await supabase
      .from('prestamos')
      .update({ 
        saldo_pendiente: nuevoSaldo < 0 ? 0 : nuevoSaldo,
        estatus: nuevoEstatus 
      })
      .eq('id', valeSeleccionado.id);

    if (!error) {
      setModalAbono(false);
      setMontoAbono('');
      setValeSeleccionado(null);
      fetchDatos(); // Refresca la tabla automáticamente
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* FORMULARIO PARA CREAR VALE */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-rose-100">
        <h3 className="text-[11px] font-bold text-rose-800 mb-6 uppercase tracking-widest font-serif italic">Registrar Nuevo Vale</h3>
        <form onSubmit={manejarGuardar} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select 
            className="p-4 rounded-2xl border border-rose-100 outline-none focus:ring-2 ring-rose-200 text-sm bg-rose-50/20"
            value={nuevoPrestamo.id_estilista}
            onChange={e => setNuevoPrestamo({...nuevoPrestamo, id_estilista: e.target.value})}
            required
          >
            <option value="">Estilista...</option>
            {estilistas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          <input 
            type="number" placeholder="Monto $"
            className="p-4 rounded-2xl border border-rose-100 outline-none focus:ring-2 ring-rose-200 text-sm"
            value={nuevoPrestamo.monto_total}
            onChange={e => setNuevoPrestamo({...nuevoPrestamo, monto_total: e.target.value})}
            required
          />
          <input 
            type="date"
            className="p-4 rounded-2xl border border-rose-100 outline-none focus:ring-2 ring-rose-200 text-sm text-slate-500"
            value={nuevoPrestamo.fecha_vencimiento}
            onChange={e => setNuevoPrestamo({...nuevoPrestamo, fecha_vencimiento: e.target.value})}
            required
          />
          <button className="bg-rose-400 text-white rounded-2xl hover:bg-rose-500 transition-all uppercase text-[10px] font-bold tracking-widest shadow-lg shadow-rose-100">
            Crear Vale
          </button>
        </form>
      </div>

      {/* TABLA DE VALES CON ACCIONES */}
      <div className="overflow-hidden rounded-[2.5rem] border border-rose-100 bg-white shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-rose-50/50 text-[10px] uppercase tracking-widest text-rose-900">
            <tr>
              <th className="p-6">Estilista</th>
              <th className="p-6">Monto</th>
              <th className="p-6">Saldo</th>
              <th className="p-6">Vencimiento</th>
              <th className="p-6">Estatus</th>
              <th className="p-6 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {prestamos.map(p => (
              <tr key={p.id} className="border-t border-rose-50 hover:bg-rose-50/30 transition-colors">
                <td className="p-6 font-bold text-slate-700">{p.estilistas?.nombre}</td>
                <td className="p-6 text-slate-400 font-light">${p.monto_total}</td>
                <td className="p-6 text-rose-600 font-bold">${p.saldo_pendiente}</td>
                <td className="p-6 text-slate-500">{p.fecha_vencimiento}</td>
                <td className="p-6">
                   <span className={`px-4 py-1 rounded-full text-[9px] uppercase font-bold ${
                     p.estatus === 'pagado' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                   }`}>
                     {p.estatus}
                   </span>
                </td>
                <td className="p-6 text-center">
                  {p.saldo_pendiente > 0 ? (
                    <button 
                      onClick={() => { setValeSeleccionado(p); setModalAbono(true); }}
                      className="bg-rose-400 text-white px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-rose-600 transition-all shadow-md"
                    >
                      Abonar
                    </button>
                  ) : (
                    <span className="text-green-500 font-bold text-[10px] uppercase italic">Liquidado ✓</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* VENTANA EMERGENTE (MODAL) PARA ABONAR */}
      {modalAbono && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-rose-900/10 backdrop-blur-sm p-4">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-rose-100 max-w-sm w-full animate-in zoom-in duration-200">
            <h3 className="font-serif italic text-2xl text-rose-900 mb-1">Registrar Abono</h3>
            <p className="text-[10px] font-bold text-rose-300 uppercase mb-6 tracking-widest">Vale de: {valeSeleccionado?.estilistas?.nombre}</p>
            
            <form onSubmit={manejarAbono} className="space-y-6">
              <div>
                <div className="flex justify-between mb-2 px-1">
                   <label className="text-[10px] font-bold text-rose-900 uppercase">Monto del abono</label>
                   <span className="text-[10px] font-bold text-rose-400 uppercase italic">Resta: ${valeSeleccionado?.saldo_pendiente}</span>
                </div>
                <input 
                  type="number" step="0.01" required autoFocus
                  className="w-full p-4 rounded-2xl border border-rose-100 outline-none focus:ring-2 ring-rose-200 text-lg font-serif italic"
                  value={montoAbono}
                  onChange={(e) => setMontoAbono(e.target.value)}
                  placeholder="0.00"
                  max={valeSeleccionado?.saldo_pendiente}
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setModalAbono(false); setValeSeleccionado(null); }} className="flex-1 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-rose-400 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500 shadow-lg shadow-rose-100 transition-all">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};