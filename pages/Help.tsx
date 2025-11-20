
import React from 'react';

const Help: React.FC = () => {
  const faqs = [
      { q: "¿Cómo creo un torneo?", a: "Ve a 'Registro', añade 16 parejas y pulsa 'Empezar Torneo'." },
      { q: "¿Cómo funcionan los grupos?", a: "El sistema asigna aleatoriamente 4 grupos (A, B, C, D). En cada turno (18min) juegan 3 grupos y descansa 1." },
      { q: "¿Puedo editar un resultado?", a: "Sí. En la pestaña 'Directo', pulsa el icono del lápiz en un partido finalizado, o ve a 'Resultados > Grupo > Editar'." },
      { q: "¿Qué hago al terminar?", a: "Cuando la final termine, ve al Inicio (Dashboard) y pulsa 'Finalizar y Archivar' para guardarlo en el historial." },
  ];

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-3xl font-bold text-slate-900">Ayuda & FAQ</h2>
      <div className="space-y-4">
          {faqs.map((item, idx) => (
              <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-emerald-700 mb-2">{item.q}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{item.a}</p>
              </div>
          ))}
      </div>
    </div>
  );
};

export default Help;
