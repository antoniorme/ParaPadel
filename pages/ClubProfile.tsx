
import React, { useState } from 'react';
import { useHistory } from '../store/HistoryContext';
import { Save, Building } from 'lucide-react';

const ClubProfile: React.FC = () => {
  const { clubData, updateClubData } = useHistory();
  const [form, setForm] = useState(clubData);

  const handleSave = (e: React.FormEvent) => {
      e.preventDefault();
      updateClubData(form);
      alert("Datos guardados correctamente");
  };

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-3xl font-bold text-slate-900">Datos del Club</h2>
      
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-xl">
              <Building size={32} className="text-slate-400" />
              <div>
                  <h3 className="font-bold text-slate-800">Configuración General</h3>
                  <p className="text-xs text-slate-500">Esta información aparecerá en la cabecera.</p>
              </div>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
              <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre del Club</label>
                  <input 
                    required
                    value={form.name} 
                    onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl p-4 mt-2 outline-none focus:border-emerald-500 font-bold text-lg" 
                  />
              </div>
              <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Dirección</label>
                  <input 
                    value={form.address || ''} 
                    onChange={e => setForm({...form, address: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl p-4 mt-2 outline-none focus:border-emerald-500" 
                  />
              </div>
              <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Teléfono</label>
                  <input 
                    value={form.phone || ''} 
                    onChange={e => setForm({...form, phone: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl p-4 mt-2 outline-none focus:border-emerald-500" 
                  />
              </div>

              <button type="submit" className="w-full bg-emerald-600 py-4 rounded-xl font-bold text-white text-lg shadow-lg mt-6 flex items-center justify-center gap-2">
                  <Save size={20}/> Guardar Cambios
              </button>
          </form>
      </div>
    </div>
  );
};

export default ClubProfile;
