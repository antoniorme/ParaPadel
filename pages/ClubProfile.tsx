
import React, { useState } from 'react';
import { useHistory } from '../store/HistoryContext';
import { useAuth } from '../store/AuthContext';
import { THEME } from '../utils/theme';
import { Save, Building, Image as ImageIcon, Upload, MapPin, Check, Trash2, AlertTriangle } from 'lucide-react';
import { Modal } from '../components';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const ClubProfile: React.FC = () => {
  const { clubData, updateClubData } = useHistory();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [form, setForm] = useState(clubData);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = (e: React.FormEvent) => {
      e.preventDefault();
      updateClubData(form);
      setShowSuccess(true);
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

  const handleDeleteClub = async () => {
      if (!user) return;
      try {
          // Delete from clubs table - RLS/Constraint must allow owner to delete
          const { error } = await supabase.from('clubs').delete().eq('owner_id', user.id);
          if (error) {
              // error handled silently; user is signed out regardless
          }
          await signOut();
          navigate('/');
      } catch (e) {
          // error handled silently
      }
  };

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-2xl font-bold text-slate-900">Datos del Club</h2>
      
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
                    className="w-full bg-white border border-slate-300 rounded-xl p-4 mt-2 outline-none focus:border-[#575AF9] font-bold text-lg" 
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
                    className="w-full bg-white border border-slate-300 rounded-xl p-4 mt-2 outline-none focus:border-[#575AF9] font-bold text-lg text-center" 
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
                    className="w-full bg-white border border-slate-300 rounded-xl p-4 mt-2 outline-none focus:border-[#575AF9]" 
                  />
              </div>

              <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1"><MapPin size={12}/> Link Google Maps</label>
                  <input 
                    value={form.mapsUrl || ''} 
                    onChange={e => setForm({...form, mapsUrl: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl p-4 mt-2 outline-none focus:border-[#575AF9] text-sm text-blue-600" 
                    placeholder="https://maps.google.com/..."
                  />
              </div>

              <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Teléfono</label>
                  <input 
                    value={form.phone || ''} 
                    onChange={e => setForm({...form, phone: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl p-4 mt-2 outline-none focus:border-[#575AF9]" 
                  />
              </div>

              <button type="submit" style={{ backgroundColor: THEME.cta }} className="w-full py-4 rounded-xl font-bold text-white text-lg shadow-lg mt-6 flex items-center justify-center gap-2 hover:opacity-90">
                  <Save size={20}/> Guardar Cambios
              </button>
          </form>
      </div>

      <div className="pt-6 border-t border-slate-200">
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-4 rounded-xl border-2 border-rose-100 bg-rose-50 text-rose-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-rose-100 hover:border-rose-200 transition-colors"
          >
              <Trash2 size={18}/> Darse de Baja (Club)
          </button>
      </div>

      <Modal
          isOpen={showSuccess}
          onClose={() => setShowSuccess(false)}
          title="¡Guardado!"
          body="Los datos del club se han actualizado correctamente."
          icon={<Check size={28} />}
          iconColor="success"
          actions={[{ label: 'Entendido', onClick: () => setShowSuccess(false), variant: 'primary' }]}
      />

      <Modal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title="¿Darse de Baja?"
          icon={<AlertTriangle size={28} />}
          iconColor="danger"
          actions={[
              { label: 'Cancelar', onClick: () => setShowDeleteConfirm(false), variant: 'secondary' },
              { label: 'Confirmar Baja', onClick: handleDeleteClub, variant: 'danger' },
          ]}
      >
          <div className="text-slate-600 text-sm space-y-2 text-left bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p><strong>1. Acceso:</strong> Perderás el acceso inmediato al panel de gestión del club.</p>
              <p><strong>2. Datos:</strong> Los jugadores, torneos y estadísticas <strong>SE CONSERVARÁN</strong> en la base de datos para no afectar a los rankings globales, pero dejarán de estar visibles para ti.</p>
          </div>
      </Modal>
    </div>
  );
};

export default ClubProfile;