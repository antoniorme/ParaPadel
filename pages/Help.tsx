
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, BookOpen, Settings, Users, RefreshCw, Table, Sliders, Calculator, ShieldAlert } from 'lucide-react';

const Help: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
      {
        q: "1. Pasos para crear un torneo",
        a: "1. Ve a 'Mis Torneos' y pulsa 'Nuevo'.\n2. Completa los detalles del evento (precio, fecha, premios).\n3. En la fase de **Configuración**, gestiona las inscripciones hasta llegar al cupo.\n4. Pulsa 'GENERAR CUADROS Y EMPEZAR' y elige el método de sorteo.\n5. El torneo pasará a fase **En Juego** y podrás ir a la pantalla de 'Directo' para gestionar los partidos."
      },
      {
        q: "2. Jugadores vs Parejas: ¿Cuál es la diferencia?",
        a: "Esta es una distinción clave:\n• **Jugadores:** Se guardan en la base de datos de tu club para siempre. Tienen su historial, ELO y estadísticas acumuladas. Los gestionas en 'Gestión Jugadores'.\n• **Parejas:** Son temporales y existen solo para el torneo actual. Al archivar un torneo, la pareja se disuelve, pero los jugadores siguen existiendo. \n\n*Nota:* Si eliminas una pareja del registro, los jugadores NO se borran."
      },
      {
          q: "3. Sustitución de Parejas (Reservas)",
          a: "Si una pareja titular no puede jugar o se lesiona, puedes sustituirla por una reserva sin alterar el calendario:\n1. Ve a la pestaña 'Control'.\n2. En la tarjeta de la pareja titular, pulsa el icono de refrescar (🔄).\n3. Selecciona qué pareja reserva entrará en su lugar.\n\nLa nueva pareja heredará los partidos ya jugados, los puntos y la posición en el grupo."
      },
      {
        q: "4. Métodos de Generación: ¿Cuál elijo?",
        a: "• NIVEL (Equilibrado): Ordena a las parejas por ELO. Las mejores van al Grupo A (Champions) y las de menor nivel al Grupo D (Europa). Ideal si quieres niveles homogéneos dentro de cada grupo.\n\n• MIX (Mezclado): Usa un sistema de 'bombos' o cremallera. Reparte a los mejores equitativamente entre todos los grupos (1º al A, 2º al B, 3º al C...). Ideal para que todos los grupos tengan una dificultad similar.\n\n• LLEGADA: Orden estricto de inscripción.\n\n• MANUAL: Se abrirá un asistente para que tú elijas dedo a dedo quién va a cada grupo."
      },
      { 
        q: "5. Formatos y Lógica", 
        a: "Elige el formato según el número de inscritos:\n\n• **Mini 16:** 4 Grupos de 4. Si tienes <8 pistas, es rotativo con descansos (4 rondas). Si tienes >=8 pistas, es simultáneo (3 rondas).\n• **Mini 12:** 3 Grupos de 4. Pasan a cuartos los 2 primeros de cada grupo y los 2 mejores terceros.\n• **Mini 10:** 2 Grupos de 5. Juegan todos contra todos (5 partidos). Los cruces de cuartos son A vs B.\n• **Mini 8:** 2 Grupos de 4. Formato rápido con cruces directos." 
      },
      { 
        q: "6. Botón de Pánico (Reiniciar)", 
        a: "Si te has equivocado al crear el torneo (ej. elegiste 'Nivel' y querías 'Mix'), ve a la pantalla de Directo y pulsa el icono de engranaje ⚙️. Allí verás 'Reiniciar Configuración'. Esto borrará los partidos generados y te devolverá a la fase de Configuración." 
      },
      { 
        q: "7. ¿Cómo funcionan los Puntos (ELO)?", 
        a: "Hemos actualizado el sistema a una escala de 0 a 6000 puntos para mayor claridad. Cada categoría representa un salto de 1000 puntos. Consulta la tabla detallada abajo." 
      },
  ];

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-2xl font-bold text-slate-900">Ayuda & Lógica</h2>
      
      {/* Introduction */}
      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex gap-4 items-start">
          <div className="bg-white p-2 rounded-full text-emerald-600 shadow-sm"><BookOpen size={24}/></div>
          <div>
              <h3 className="font-bold text-emerald-800">Manual del Organizador</h3>
              <p className="text-sm text-emerald-700 mt-1">Aquí explicamos cómo el algoritmo decide los cruces y gestiona los tiempos de tu torneo.</p>
          </div>
      </div>

      {/* FAQ Section */}
      <div className="space-y-3">
          {faqs.map((item, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <button 
                    onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                    className="w-full flex justify-between items-center p-5 text-left bg-white hover:bg-slate-50 transition-colors"
                  >
                      <span className="font-bold text-slate-800 text-sm md:text-base pr-4">{item.q}</span>
                      {openIndex === idx ? <ChevronUp size={20} className="text-slate-400 flex-shrink-0"/> : <ChevronDown size={20} className="text-slate-400 flex-shrink-0"/>}
                  </button>
                  {openIndex === idx && (
                      <div className="p-5 pt-0 text-slate-600 text-sm leading-relaxed border-t border-slate-50 whitespace-pre-line">
                          <div className="pt-4">{item.a}</div>
                      </div>
                  )}
              </div>
          ))}
      </div>

      {/* DETAILED ELO EXPLANATION CARD */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden mt-8">
          <div className="bg-slate-900 p-5 text-white flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-lg text-blue-300">
                  <TrendingUp size={24} />
              </div>
              <div>
                  <h3 className="font-bold text-lg">Cómo funcionan los Puntos</h3>
                  <p className="text-xs text-slate-400">Guía rápida del Sistema 0-6000</p>
              </div>
          </div>
          
          <div className="p-6 space-y-8">
              
              {/* SECCIÓN 1: TABLA DE CATEGORÍAS */}
              <div>
                  <div className="flex items-center gap-2 mb-3 text-blue-600 font-bold uppercase text-xs tracking-wider">
                      <Table size={16}/> 1. Categorías y Rangos
                  </div>
                  <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                      El sistema asigna una puntuación base en el <strong>punto medio</strong> de cada categoría.
                  </p>
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                              <tr>
                                  <th className="px-4 py-3">Categoría</th>
                                  <th className="px-4 py-3 text-right">Rango</th>
                                  <th className="px-4 py-3 text-right">Base</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                              <tr><td className="px-4 py-2 font-medium">Iniciación</td><td className="px-4 py-2 text-right text-slate-400 font-mono">0 - 1000</td><td className="px-4 py-2 text-right font-bold">500</td></tr>
                              <tr><td className="px-4 py-2 font-medium">5ª Categoría</td><td className="px-4 py-2 text-right text-slate-400 font-mono">1000 - 2000</td><td className="px-4 py-2 text-right font-bold">1500</td></tr>
                              <tr><td className="px-4 py-2 font-medium">4ª Categoría</td><td className="px-4 py-2 text-right text-slate-400 font-mono">2000 - 3000</td><td className="px-4 py-2 text-right font-bold">2500</td></tr>
                              <tr><td className="px-4 py-2 font-medium">3ª Categoría</td><td className="px-4 py-2 text-right text-slate-400 font-mono">3000 - 4000</td><td className="px-4 py-2 text-right font-bold">3500</td></tr>
                              <tr><td className="px-4 py-2 font-medium">2ª Categoría</td><td className="px-4 py-2 text-right text-slate-400 font-mono">4000 - 5000</td><td className="px-4 py-2 text-right font-bold">4500</td></tr>
                              <tr><td className="px-4 py-2 font-medium">1ª Categoría</td><td className="px-4 py-2 text-right text-slate-400 font-mono">5000 - 6000</td><td className="px-4 py-2 text-right font-bold">5500</td></tr>
                          </tbody>
                      </table>
                  </div>
              </div>

              {/* SECCIÓN 2: AJUSTE MANUAL */}
              <div>
                  <div className="flex items-center gap-2 mb-3 text-amber-600 font-bold uppercase text-xs tracking-wider">
                      <Sliders size={16}/> 2. Ajuste Fino (+/- 400)
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                      El slider del 1 al 10 te permite mover al jugador dentro de su franja sin saltar de categoría.
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600 list-disc pl-5">
                      <li><strong>Nivel 5 (Neutro):</strong> Se queda con los puntos base.</li>
                      <li><strong>Nivel 10 (Tope):</strong> Suma +400 puntos (casi sube de nivel).</li>
                      <li><strong>Nivel 1 (Suelo):</strong> Resta -400 puntos.</li>
                  </ul>
              </div>

              {/* SECCIÓN 3: PARTIDOS */}
              <div>
                  <div className="flex items-center gap-2 mb-3 text-emerald-600 font-bold uppercase text-xs tracking-wider">
                      <RefreshCw size={16}/> 3. Puntos por Partido
                  </div>
                  <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                      Al aumentar la escala, los puntos por victoria también han subido.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <span className="font-bold text-slate-800 block mb-1">Victoria Normal</span>
                          <p className="text-xs text-slate-500">
                              Entre <strong>50 y 100 puntos</strong> dependiendo del rival.
                          </p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <span className="font-bold text-slate-800 block mb-1">Límite Seguro</span>
                          <p className="text-xs text-slate-500">
                              Máximo <strong>150 puntos</strong> por partido para evitar saltos locos.
                          </p>
                      </div>
                  </div>
              </div>

          </div>
      </div>
    </div>
  );
};

export default Help;
