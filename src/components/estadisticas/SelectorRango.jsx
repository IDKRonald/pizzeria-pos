// src/components/estadisticas/SelectorRango.jsx
// Selector de rango de fechas compartido por las pestañas de Estadísticas.
import { useState, useEffect } from 'react';

const inputStyle = { background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#fff' };
const pad = (n) => String(n).padStart(2, '0');
const hoyStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

function inicioSemana() {
  const d = new Date();
  const dia = d.getDay(); // 0=domingo
  const offset = dia === 0 ? 6 : dia - 1; // retrocede hasta el lunes
  const lunes = new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
  return `${lunes.getFullYear()}-${pad(lunes.getMonth() + 1)}-${pad(lunes.getDate())}`;
}
function inicioMes() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

const PRESETS = [
  { id: 'hoy', label: 'Hoy', desde: hoyStr, hasta: hoyStr },
  { id: 'semana', label: 'Esta semana', desde: inicioSemana, hasta: hoyStr },
  { id: 'mes', label: 'Este mes', desde: inicioMes, hasta: hoyStr },
  { id: 'personalizado', label: 'Personalizado' },
];

export default function SelectorRango({ onChange }) {
  const [activo, setActivo] = useState('hoy');
  const [desde, setDesde] = useState(hoyStr());
  const [hasta, setHasta] = useState(hoyStr());

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onChange({ desde: hoyStr(), hasta: hoyStr() }); }, []);

  const elegirPreset = (preset) => {
    setActivo(preset.id);
    if (preset.id === 'personalizado') return;
    const d = preset.desde(); const h = preset.hasta();
    setDesde(d); setHasta(h);
    onChange({ desde: d, hasta: h });
  };

  const aplicarPersonalizado = () => onChange({ desde, hasta });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <button key={p.id} onClick={() => elegirPreset(p)}
          className="px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{
            background: activo === p.id ? 'rgb(249,115,22)' : '#1e1e2d',
            color: activo === p.id ? '#fff' : '#94a3b8',
            border: activo === p.id ? '1px solid rgb(249,115,22)' : '1px solid #2a2a3a',
          }}>
          {p.label}
        </button>
      ))}
      {activo === 'personalizado' && (
        <div className="flex items-center gap-1.5">
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="px-2 py-1.5 rounded-lg text-xs" style={inputStyle} />
          <span className="text-xs" style={{ color: '#64748b' }}>a</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="px-2 py-1.5 rounded-lg text-xs" style={inputStyle} />
          <button onClick={aplicarPersonalizado} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'rgb(249,115,22)' }}>Aplicar</button>
        </div>
      )}
    </div>
  );
}
