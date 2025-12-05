
import React, { useState } from 'react';
import { useHistory } from '../store/HistoryContext';
import { Save, Building, Image as ImageIcon, Upload } from 'lucide-react';

const ClubProfile: React.FC = () => {
  const { clubData, updateClubData } = useHistory();
  const [form, setForm] = useState(clubData);

  const handleSave = (e: React.FormEvent) => {
      e.preventDefault();
      updateClubData(form);
      alert("Datos guardados correctamente");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setForm(prev => ({ ...prev, logoUrl: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-3xl font-bold text-slate-900">Datos del Club</h2>
      
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-xl">
              <Building size={32} className="text-slate-400" />
              <div>
                  <h3 className="font-bold text-slate-800">Configuración General</h3>
                  <p className="text-xs text-slate-500">Esta información es vital para la lógica del torneo.</p>
              </div>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
              
              {/* LOGO UPLOAD SECTION */}
              <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Logo del Club</label>
                  <div className="mt-2 flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden relative">
                          {form.logoUrl ? (
                              <img src={form.logoUrl} alt="Club Logo" className="w-full h-full object-contain" />
                          ) : (
                              <ImageIcon size={24} className="text-slate-300" />
                          )}
                      </div>
                      <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 cursor-pointer shadow-sm transition-colors">
                          <Upload size={16} />
                          <span>Subir Imagen</span>
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                  </div>
              </div>

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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Número de Pistas</label>
                  <input 
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={form.courtCount} 
                    onChange={e => setForm({...form, courtCount: parseInt(e.target.value) || 0})}
                    className="w-full bg-white border border-slate-300 rounded-xl p-4 mt-2 outline-none focus:border-emerald-500 font-bold text-lg text-center" 
                  />
                  <div className="mt-2 p-3 bg-blue-50 text-blue-800 text-xs rounded-lg border border-blue-100">
                      <strong>Nota Importante:</strong> Si el club tiene <strong>8 pistas o más</strong>, los torneos de 16 parejas se jugarán en modo "Simultáneo" (sin descansos). Con menos de 8 pistas, se aplicará el sistema de rotación con descansos.
                  </div>
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