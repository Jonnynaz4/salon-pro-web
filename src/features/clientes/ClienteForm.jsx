import React, { useState, useEffect } from 'react';
import { supabase } from '../../api/supabase';

export const ClienteForm = () => {
  const [clientes, setClientes] = useState([]);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');

  const cargarClientes = async () => {
    const { data } = await supabase.from('clientes').select('*').order('nombre');
    setClientes(data || []);
  };

  useEffect(() => { cargarClientes(); }, []);

  const guardar = async (e) => {
    e.preventDefault();
    if (!nombre) return;
    await supabase.from('clientes').insert([{ nombre, telefono }]);
    setNombre(''); setTelefono('');
    cargarClientes();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 md:gap-10 animate-in fade-in pb-20">
      <div className="lg:w-1/3 bg-[#1A1A1A] p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-[#222] h-fit shadow-2xl">
        <h3 className="font-serif italic text-2xl text-[#C5A059] mb-8 text-center border-b border-[#222] pb-6">Nuevo Cliente</h3>
        <form onSubmit={guardar} className="space-y-5">
          <div className="space-y-2">
            <label className="font-bold text-slate-500 uppercase ml-2 tracking-widest" style={{ fontSize: '0.65em' }}>Nombre del Titular</label>
            <input 
              className="w-full p-5 rounded-2xl bg-[#252525] border border-[#333] text-slate-200 font-bold outline-none focus:border-[#C5A059] transition-all" 
              placeholder="Ej. Alejandra Rossi" 
              value={nombre} 
              onChange={e=>setNombre(e.target.value)}
              style={{ fontSize: '0.9em' }}
            />
          </div>
          <div className="space-y-2">
            <label className="font-bold text-slate-500 uppercase ml-2 tracking-widest" style={{ fontSize: '0.65em' }}>WhatsApp</label>
            <input 
              className="w-full p-5 rounded-2xl bg-[#252525] border border-[#333] text-slate-200 font-bold outline-none focus:border-[#C5A059] transition-all" 
              placeholder="55 0000 0000" 
              value={telefono} 
              onChange={e=>setTelefono(e.target.value)}
              style={{ fontSize: '0.9em' }}
            />
          </div>
          <button className="w-full py-5 bg-[#C5A059] text-black font-black rounded-2xl shadow-lg uppercase tracking-[0.1em] hover:bg-[#D4B475] active:scale-95 transition-all mt-4" style={{ fontSize: '0.8em' }}>Registrar</button>
        </form>
      </div>

      <div className="lg:w-2/3 bg-[#141414] rounded-[2.5rem] md:rounded-[3.5rem] border border-[#222] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead className="bg-[#111]">
              <tr>
                <th className="p-6 font-black text-[#C5A059] uppercase tracking-[0.2em]" style={{ fontSize: '0.75em' }}>Nombre del Cliente</th>
                <th className="p-6 font-black text-[#C5A059] uppercase tracking-[0.2em] text-right">Contacto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {clientes.map(c => (
                <tr key={c.id} className="hover:bg-[#1A1A1A] transition-colors group">
                  <td className="p-6 font-serif italic text-xl text-white uppercase tracking-tighter truncate max-w-[200px]">{c.nombre}</td>
                  <td className="p-6 text-slate-500 font-bold text-right tracking-widest group-hover:text-[#C5A059] transition-colors" style={{ fontSize: '0.85em' }}>{c.telefono || '—'}</td>
                </tr>
              ))}
              {clientes.length === 0 && (
                  <tr>
                      <td colSpan="2" className="p-20 text-center text-slate-700 uppercase font-black tracking-widest italic" style={{ fontSize: '0.75em' }}>El directorio está vacío</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};