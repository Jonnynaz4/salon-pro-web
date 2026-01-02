import { supabase } from '../api/supabase';

export function useCitas() {
  const agendarCita = async (nuevaCita) => {
    const { data, error } = await supabase
      .from('citas')
      .insert([{
        cliente_id: nuevaCita.cliente_id,
        estilista_id: nuevaCita.estilista_id,
        servicio_id: nuevaCita.servicio_id,
        fecha_inicio: nuevaCita.fecha_inicio,
        duracion_minutos: nuevaCita.duracion_minutos,
        estatus: 'pendiente',
        notas: nuevaCita.notas // <--- ESTA LÍNEA ES LA QUE FALTABA
      }])
      .select();
    return { data, error };
  };

  return { agendarCita };
}