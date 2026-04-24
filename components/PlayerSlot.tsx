import React, { useState, useEffect, useRef } from 'react';
import { Player } from '../types';
import { PlayerSelector } from './PlayerSelector';
import { PP } from '../utils/theme';
import { Search, Plus, X, User } from 'lucide-react';

interface PlayerSlotProps {
  slotNumber: number;
  selectedId: string;
  onSelect: (id: string) => void;
  excludeIds?: string[];
  players: Player[];
  onAddPlayer: (p: Partial<Player>) => Promise<string | null>;
  formatName: (p?: Player) => string;
}

export const PlayerSlot: React.FC<PlayerSlotProps> = ({
  slotNumber,
  selectedId,
  onSelect,
  excludeIds = [],
  players,
  onAddPlayer,
  formatName,
}) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'search' | 'new'>('search');
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = players.find(p => p.id === selectedId);
  const available = players.filter(p => !excludeIds.includes(p.id));

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const openWith = (t: 'search' | 'new') => {
    setTab(t);
    setOpen(true);
  };

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  const handleAdd = async (p: Partial<Player>) => {
    const id = await onAddPlayer(p);
    if (id) setOpen(false);
    return id;
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* ── Trigger ── */}
      {selected ? (
        // Jugador seleccionado → chip compacto
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 10,
          border: `1.5px solid ${PP.primary}`, background: PP.primaryTint,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: PP.primary, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
          }}>
            <User size={14} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: PP.mute, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Jugador {slotNumber}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: PP.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {formatName(selected)}
            </div>
          </div>
          <button
            onClick={() => onSelect('')}
            style={{ background: 'none', border: 0, cursor: 'pointer', color: PP.muteSoft, display: 'flex', alignItems: 'center', padding: 2 }}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        // Sin jugador → placeholder + botones
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 10px', borderRadius: 10,
          border: `1.5px dashed ${PP.hair}`, background: PP.bg,
        }}>
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: PP.muteSoft, fontFamily: PP.font }}>
            Jugador {slotNumber}
          </div>
          <button
            onClick={() => openWith('search')}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 8, border: `1px solid ${PP.hair}`,
              background: PP.card, fontSize: 11, fontWeight: 700, color: PP.ink2, cursor: 'pointer',
              fontFamily: PP.font,
            }}
          >
            <Search size={11} /> Buscar
          </button>
          <button
            onClick={() => openWith('new')}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 8, border: 0,
              background: PP.primary, fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer',
              fontFamily: PP.font,
            }}
          >
            <Plus size={11} /> Crear
          </button>
        </div>
      )}

      {/* ── Dropdown con PlayerSelector ── */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 500,
          background: PP.card, borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          border: `1px solid ${PP.hair}`,
          overflow: 'hidden',
        }}>
          <PlayerSelector
            label=""
            selectedId={selectedId}
            onSelect={handleSelect}
            otherSelectedId=""
            players={available}
            onAddPlayer={handleAdd}
            formatName={formatName}
            initialTab={tab}
          />
        </div>
      )}
    </div>
  );
};
