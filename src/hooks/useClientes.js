import { useState, useEffect } from 'react';
import { supabase } from '../api/supabase';

export function useClientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchClientes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre', { ascending: true });
    
    if (error) console.error('Error al obtener clientes:', error);
    else setClientes(data);
    setLoading(false);
  };

  const agregarCliente = async (cliente) => {
    const { data, error } = await supabase
      .from('clientes')
      .insert([cliente])
      .select();
    
    if (!error) setClientes([...clientes, data[0]]);
    return { data, error };
  };

  useEffect(() => { fetchClientes(); }, []);

  return { clientes, loading, agregarCliente, refrescar: fetchClientes };
}