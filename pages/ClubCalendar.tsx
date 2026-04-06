import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHistory } from '../store/HistoryContext';
import { useAuth } from '../store/AuthContext';
import { supabase } from '../lib/supabase';
import { Modal, useToast, Button } from '../components';
import { CourtConfig, CourtBlock, CourtReservation, ReservationStatus } from '../types';
import {
    ChevronLeft, ChevronRight, Plus, Settings, Check, X,
    Phone, MessageCircle, Clock, User, Trash2, RefreshCw,
    Calendar, Lock, Wrench, AlertTriangle, Edit2, CalendarDays
} from 'lucide-react';
import { THEME } from '../utils/theme';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const PX_PER_HOUR = 80;
const PX_PER_MIN = PX_PER_HOUR / 60;
const GRID_ROW_MINS = 30; // granularidad de la cuadrícula

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_NAMES_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ─── UTILIDADES DE TIEMPO ─────────────────────────────────────────────────────

const timeToMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
};

const minsToTime = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

const toLocalDateStr = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

const buildTimestamp = (dateStr: string, timeStr: string) =>
    new Date(`${dateStr}T${timeStr}:00`).toISOString();

const extractTime = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

const extractDateStr = (iso: string) => iso.split('T')[0];

const isSameDay = (iso: string, dateStr: string) => extractDateStr(iso) === dateStr;

const slotTop = (startIso: string, openTime: string, dateStr: string) => {
    const t = extractTime(startIso);
    const d = extractDateStr(startIso);
    if (d !== dateStr) return -1;
    return (timeToMins(t) - timeToMins(openTime)) * PX_PER_MIN;
};

const slotHeight = (startIso: string, endIso: string) => {
    const startMins = timeToMins(extractTime(startIso));
    const endMins = timeToMins(extractTime(endIso));
    return (endMins - startMins) * PX_PER_MIN;
};

const generateTimeLabels = (openTime: string, closeTime: string) => {
    const labels: string[] = [];
    let t = timeToMins(openTime);
    const end = timeToMins(closeTime);
    while (t < end) {
        labels.push(minsToTime(t));
        t += GRID_ROW_MINS;
    }
    return labels;
};

const totalGridHeight = (openTime: string, closeTime: string) =>
    (timeToMins(closeTime) - timeToMins(openTime)) * PX_PER_MIN;

const formatDateLong = (date: Date) =>
    `${DAY_NAMES_LONG[date.getDay()]} ${date.getDate()} de ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;

const isToday = (date: Date) => toLocalDateStr(date) === toLocalDateStr(new Date());

// ─── COLORES POR ESTADO ───────────────────────────────────────────────────────

const STATUS_STYLES: Record<ReservationStatus, { bg: string; border: string; text: string; label: string }> = {
    pending:   { bg: 'bg-amber-50',   border: 'border-amber-400',  text: 'text-amber-800',  label: 'Pendiente' },
    confirmed: { bg: 'bg-indigo-50',  border: 'border-indigo-400', text: 'text-indigo-800', label: 'Confirmada' },
    rejected:  { bg: 'bg-rose-50',    border: 'border-rose-400',   text: 'text-rose-800',   label: 'Rechazada' },
    cancelled: { bg: 'bg-slate-50',   border: 'border-slate-300',  text: 'text-slate-500',  label: 'Cancelada' },
};

const BLOCK_STYLES: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
    tournament:   { bg: 'bg-slate-800',   text: 'text-white',         label: 'Torneo',          icon: <Calendar size={10}/> },
    maintenance:  { bg: 'bg-orange-100',  text: 'text-orange-800',    label: 'Mantenimiento',   icon: <Wrench size={10}/> },
    manual:       { bg: 'bg-slate-200',   text: 'text-slate-700',     label: 'Bloqueado',       icon: <Lock size={10}/> },
    private:      { bg: 'bg-purple-100',  text: 'text-purple-800',    label: 'Privado',         icon: <Lock size={10}/> },
};

// ─── TIPOS INTERNOS ───────────────────────────────────────────────────────────

interface CreateReservationForm {
    playerName: string;
    playerPhone: string;
    partnerName: string;
    notes: string;
}

interface BlockForm {
    reason: string;
    blockType: 'manual' | 'maintenance' | 'private';
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

const ClubCalendar: React.FC = () => {
    const { clubData } = useHistory();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { success, error: showError } = useToast();

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [courts, setCourts] = useState<CourtConfig[]>([]);
    const [reservations, setReservations] = useState<CourtReservation[]>([]);
    const [blocks, setBlocks] = useState<CourtBlock[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'calendar' | 'setup'>('calendar');
    const [slotMinutes, setSlotMinutes] = useState<60 | 90>(90);

    // Modales
    const [selectedSlot, setSelectedSlot] = useState<{ courtNumber: number; startTime: string } | null>(null);
    const [selectedReservation, setSelectedReservation] = useState<CourtReservation | null>(null);
    const [selectedBlock, setSelectedBlock] = useState<CourtBlock | null>(null);
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [blockSlotData, setBlockSlotData] = useState<{ courtNumber: number; startTime: string } | null>(null);

    // Formularios
    const [createForm, setCreateForm] = useState<CreateReservationForm>({ playerName: '', playerPhone: '', partnerName: '', notes: '' });
    const [blockForm, setBlockForm] = useState<BlockForm>({ reason: '', blockType: 'manual' });
    const [saving, setSaving] = useState(false);

    // Setup
    const [editingCourt, setEditingCourt] = useState<CourtConfig | null>(null);
    const [showCourtModal, setShowCourtModal] = useState(false);

    // Drag & drop
    const dragRef = useRef<{ id: string; startTime: string; endTime: string } | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);

    const dateStr = toLocalDateStr(selectedDate);
    const openTime = courts[0]?.open_time || '08:00';
    const closeTime = courts[0]?.close_time || '22:00';
    const timeLabels = generateTimeLabels(openTime, closeTime);
    const gridHeight = totalGridHeight(openTime, closeTime);

    // ─── CARGA DE DATOS ───────────────────────────────────────────────────────

    const loadCourts = useCallback(async () => {
        if (!clubData.id) return;
        const { data } = await supabase
            .from('court_availability')
            .select('*')
            .eq('club_id', clubData.id)
            .eq('is_active', true)
            .order('sort_order');
        if (data) setCourts(data as CourtConfig[]);
    }, [clubData.id]);

    const loadDayData = useCallback(async () => {
        if (!clubData.id) return;
        setLoading(true);
        // Fetch reservations and blocks for this day ±1 day to handle timezone edge cases
        const from = new Date(selectedDate); from.setDate(from.getDate() - 1);
        const to = new Date(selectedDate); to.setDate(to.getDate() + 1);
        const [resResult, blockResult] = await Promise.all([
            supabase.from('court_reservations').select('*')
                .eq('club_id', clubData.id)
                .gte('start_at', from.toISOString())
                .lte('start_at', to.toISOString()),
            supabase.from('court_blocks').select('*')
                .eq('club_id', clubData.id)
                .gte('start_at', from.toISOString())
                .lte('start_at', to.toISOString()),
        ]);
        if (resResult.data) setReservations(resResult.data as CourtReservation[]);
        if (blockResult.data) setBlocks(blockResult.data as CourtBlock[]);
        setLoading(false);
    }, [clubData.id, selectedDate]);

    useEffect(() => { loadCourts(); }, [loadCourts]);
    useEffect(() => { if (courts.length > 0) loadDayData(); }, [loadDayData, courts.length]);

    // ─── ACCIONES DE RESERVAS ─────────────────────────────────────────────────

    const handleCreateReservation = async () => {
        if (!selectedSlot || !clubData.id || !createForm.playerName.trim()) return;
        setSaving(true);
        const startAt = buildTimestamp(dateStr, selectedSlot.startTime);
        const endAt = buildTimestamp(dateStr, minsToTime(timeToMins(selectedSlot.startTime) + slotMinutes));
        const { error } = await supabase.from('court_reservations').insert([{
            club_id: clubData.id,
            court_number: selectedSlot.courtNumber,
            player_name: createForm.playerName.trim(),
            player_phone: createForm.playerPhone.trim() || null,
            partner_name: createForm.partnerName.trim() || null,
            notes: createForm.notes.trim() || null,
            start_at: startAt, end_at: endAt,
            status: 'confirmed', source: 'admin',
            confirmed_by: user?.id,
        }]);
        setSaving(false);
        if (error) { showError('Error al crear la reserva'); return; }
        success('Reserva creada');
        setSelectedSlot(null);
        setCreateForm({ playerName: '', playerPhone: '', partnerName: '', notes: '' });
        loadDayData();
    };

    const handleConfirmReservation = async (id: string) => {
        const { error } = await supabase.from('court_reservations')
            .update({ status: 'confirmed', confirmed_by: user?.id, confirmed_at: new Date().toISOString() })
            .eq('id', id);
        if (error) { showError('Error'); return; }
        success('Reserva confirmada');
        setSelectedReservation(null);
        loadDayData();
    };

    const handleRejectReservation = async (id: string) => {
        const { error } = await supabase.from('court_reservations')
            .update({ status: 'rejected' }).eq('id', id);
        if (error) { showError('Error'); return; }
        success('Reserva rechazada');
        setSelectedReservation(null);
        loadDayData();
    };

    const handleCancelReservation = async (id: string) => {
        const { error } = await supabase.from('court_reservations')
            .update({ status: 'cancelled' }).eq('id', id);
        if (error) { showError('Error'); return; }
        success('Reserva cancelada');
        setSelectedReservation(null);
        loadDayData();
    };

    const handleCreateBlock = async () => {
        if (!blockSlotData || !clubData.id) return;
        setSaving(true);
        const startAt = buildTimestamp(dateStr, blockSlotData.startTime);
        const endAt = buildTimestamp(dateStr, minsToTime(timeToMins(blockSlotData.startTime) + slotMinutes));
        const { error } = await supabase.from('court_blocks').insert([{
            club_id: clubData.id,
            court_number: blockSlotData.courtNumber,
            reason: blockForm.reason.trim() || 'Bloqueado',
            block_type: blockForm.blockType,
            start_at: startAt, end_at: endAt,
            created_by: user?.id,
        }]);
        setSaving(false);
        if (error) { showError('Error al bloquear'); return; }
        success('Pista bloqueada');
        setShowBlockModal(false);
        setBlockSlotData(null);
        setBlockForm({ reason: '', blockType: 'manual' });
        loadDayData();
    };

    const handleDeleteBlock = async (id: string) => {
        await supabase.from('court_blocks').delete().eq('id', id);
        success('Bloqueo eliminado');
        setSelectedBlock(null);
        loadDayData();
    };

    // ─── DRAG & DROP ──────────────────────────────────────────────────────────

    const handleDragStart = (e: React.DragEvent, res: CourtReservation) => {
        dragRef.current = { id: res.id, startTime: extractTime(res.start_at), endTime: extractTime(res.end_at) };
        setDraggingId(res.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = async (e: React.DragEvent, courtNumber: number, slotTime: string) => {
        e.preventDefault();
        if (!dragRef.current) return;
        const { id, startTime, endTime } = dragRef.current;
        if (slotTime === startTime) { setDraggingId(null); return; }
        const startMins = timeToMins(slotTime);
        const durationMins = timeToMins(endTime) - timeToMins(startTime);
        const newStart = buildTimestamp(dateStr, slotTime);
        const newEnd = buildTimestamp(dateStr, minsToTime(startMins + durationMins));
        await supabase.from('court_reservations').update({
            court_number: courtNumber, start_at: newStart, end_at: newEnd
        }).eq('id', id);
        setDraggingId(null);
        dragRef.current = null;
        loadDayData();
    };

    // ─── GESTIÓN DE PISTAS (SETUP) ────────────────────────────────────────────

    const handleSaveCourt = async (court: Partial<CourtConfig>) => {
        if (!clubData.id) return;
        setSaving(true);
        if (court.id) {
            await supabase.from('court_availability').update({
                court_name: court.court_name, slot_minutes: court.slot_minutes,
                open_time: court.open_time, close_time: court.close_time,
                active_days: court.active_days, sort_order: court.sort_order,
            }).eq('id', court.id);
        } else {
            const maxNum = courts.length > 0 ? Math.max(...courts.map(c => c.court_number)) + 1 : 1;
            await supabase.from('court_availability').insert([{
                club_id: clubData.id, court_number: maxNum,
                court_name: court.court_name || `Pista ${maxNum}`,
                slot_minutes: court.slot_minutes || 90,
                open_time: court.open_time || '08:00',
                close_time: court.close_time || '22:00',
                active_days: court.active_days || [0,1,2,3,4,5,6],
                sort_order: courts.length,
            }]);
        }
        setSaving(false);
        success(court.id ? 'Pista actualizada' : 'Pista añadida');
        setShowCourtModal(false);
        setEditingCourt(null);
        loadCourts();
    };

    const handleDeleteCourt = async (id: string) => {
        await supabase.from('court_availability').update({ is_active: false }).eq('id', id);
        success('Pista eliminada');
        loadCourts();
    };

    // ─── RENDER ───────────────────────────────────────────────────────────────

    if (!clubData.id) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-4">
                <CalendarDays size={48} className="opacity-30"/>
                <p className="font-bold">Completa la configuración de tu club primero</p>
                <button
                    onClick={() => navigate('/club')}
                    className="px-5 py-2.5 bg-violet-600 text-white text-sm font-black rounded-xl hover:bg-violet-700 transition-colors"
                >
                    Ir a configuración del club
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-20">
            {/* ── HEADER ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-900">Calendario</h2>
                    <p className="text-xs text-slate-400 font-medium">{courts.length} pistas configuradas</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab(activeTab === 'calendar' ? 'setup' : 'calendar')}
                        className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                    >
                        <Settings size={18}/>
                    </button>
                    <button onClick={loadDayData} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 transition-colors">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>
                    </button>
                </div>
            </div>

            {/* ── TABS ── */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setActiveTab('calendar')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'calendar' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                    Calendario
                </button>
                <button onClick={() => setActiveTab('setup')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'setup' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                    Configurar Pistas
                </button>
            </div>

            {/* ════════════ VISTA CALENDARIO ════════════ */}
            {activeTab === 'calendar' && (
                <div className="space-y-4">
                    {/* NAVEGACIÓN DE FECHA */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d); }} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                <ChevronLeft size={20}/>
                            </button>
                            <div className="text-center">
                                <div className="font-black text-slate-900 text-sm">{formatDateLong(selectedDate)}</div>
                                {isToday(selectedDate) && <div className="text-[10px] font-bold uppercase text-indigo-500 tracking-wider">Hoy</div>}
                            </div>
                            <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d); }} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                <ChevronRight size={20}/>
                            </button>
                        </div>
                        {/* Mini week strip */}
                        <WeekStrip selectedDate={selectedDate} onSelect={setSelectedDate} />
                        {/* Duración de slot */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                            <span className="text-xs font-bold text-slate-500">Slot:</span>
                            {([60, 90] as const).map(m => (
                                <button key={m} onClick={() => setSlotMinutes(m)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${slotMinutes === m ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                                    style={slotMinutes === m ? { backgroundColor: THEME.cta } : {}}
                                >
                                    {m} min
                                </button>
                            ))}
                            <span className="text-[10px] text-slate-400 ml-auto">{openTime} — {closeTime}</span>
                        </div>
                    </div>

                    {/* NO COURTS */}
                    {courts.length === 0 && !loading && (
                        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                            <CalendarDays size={48} className="mx-auto text-slate-200 mb-4"/>
                            <h3 className="font-bold text-slate-700 mb-2">Sin pistas configuradas</h3>
                            <p className="text-sm text-slate-400 mb-4">Añade tus pistas para empezar a gestionar reservas</p>
                            <button onClick={() => setActiveTab('setup')} style={{ backgroundColor: THEME.cta }} className="px-6 py-2 rounded-xl text-white font-bold text-sm">
                                Configurar Pistas
                            </button>
                        </div>
                    )}

                    {/* GRID DEL CALENDARIO */}
                    {courts.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            {/* Leyenda */}
                            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex-wrap">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Leyenda:</span>
                                <LegendDot color="bg-white border border-dashed border-slate-300" label="Libre"/>
                                <LegendDot color="bg-amber-100 border border-amber-300" label="Pendiente"/>
                                <LegendDot color="bg-indigo-100 border border-indigo-300" label="Confirmada"/>
                                <LegendDot color="bg-slate-700" label="Bloqueado"/>
                            </div>
                            {/* SCROLL CONTAINER — horizontal en móvil */}
                            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '70vh' }}>
                                <div style={{ minWidth: Math.max(320, courts.length * 120 + 64) }}>
                                    {/* HEADER: pistas */}
                                    <div className="flex sticky top-0 z-20 bg-white border-b border-slate-200">
                                        <div className="w-16 shrink-0 border-r border-slate-100 bg-slate-50"/>
                                        {courts.map(c => (
                                            <div key={c.id} className="flex-1 min-w-[120px] px-2 py-3 text-center border-r border-slate-100 last:border-r-0 bg-white">
                                                <div className="font-black text-slate-800 text-sm truncate">{c.court_name}</div>
                                                <div className="text-[10px] text-slate-400 font-medium">{c.slot_minutes} min</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* BODY: tiempo × pistas */}
                                    <div className="flex">
                                        {/* Eje de tiempo */}
                                        <div className="w-16 shrink-0 border-r border-slate-100 relative" style={{ height: gridHeight }}>
                                            {timeLabels.map((label, i) => (
                                                <div key={label} className="absolute w-full flex items-start justify-end pr-2"
                                                    style={{ top: i * GRID_ROW_MINS * PX_PER_MIN - 8, height: GRID_ROW_MINS * PX_PER_MIN }}>
                                                    <span className="text-[10px] font-bold text-slate-400">{label}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Columnas de pistas */}
                                        {courts.map(court => {
                                            const courtRes = reservations.filter(r => r.court_number === court.court_number && isSameDay(r.start_at, dateStr));
                                            const courtBlocks = blocks.filter(b => b.court_number === court.court_number && isSameDay(b.start_at, dateStr));
                                            return (
                                                <CourtColumn
                                                    key={court.id}
                                                    court={court}
                                                    dateStr={dateStr}
                                                    openTime={openTime}
                                                    closeTime={closeTime}
                                                    slotMinutes={slotMinutes}
                                                    gridHeight={gridHeight}
                                                    timeLabels={timeLabels}
                                                    reservations={courtRes}
                                                    blocks={courtBlocks}
                                                    draggingId={draggingId}
                                                    onSlotClick={(startTime) => {
                                                        setSelectedSlot({ courtNumber: court.court_number, startTime });
                                                        setCreateForm({ playerName: '', playerPhone: '', partnerName: '', notes: '' });
                                                    }}
                                                    onBlockSlot={(startTime) => {
                                                        setBlockSlotData({ courtNumber: court.court_number, startTime });
                                                        setShowBlockModal(true);
                                                    }}
                                                    onReservationClick={setSelectedReservation}
                                                    onBlockClick={setSelectedBlock}
                                                    onDragStart={handleDragStart}
                                                    onDrop={handleDrop}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LISTA DE RESERVAS PENDIENTES */}
                    {reservations.filter(r => r.status === 'pending' && isSameDay(r.start_at, dateStr)).length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                            <h3 className="text-xs font-black text-amber-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <AlertTriangle size={14}/> Pendientes de confirmación
                            </h3>
                            <div className="space-y-2">
                                {reservations.filter(r => r.status === 'pending' && isSameDay(r.start_at, dateStr)).map(r => (
                                    <div key={r.id} onClick={() => setSelectedReservation(r)}
                                        className="bg-white rounded-xl p-3 border border-amber-100 flex justify-between items-center cursor-pointer hover:shadow-sm transition-shadow">
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm">{r.player_name}</div>
                                            <div className="text-xs text-slate-500">Pista {r.court_number} · {extractTime(r.start_at)}–{extractTime(r.end_at)}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={e => { e.stopPropagation(); handleConfirmReservation(r.id); }} className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"><Check size={14}/></button>
                                            <button onClick={e => { e.stopPropagation(); handleRejectReservation(r.id); }} className="p-1.5 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors"><X size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ════════════ CONFIGURACIÓN DE PISTAS ════════════ */}
            {activeTab === 'setup' && (
                <SetupTab
                    courts={courts}
                    onAdd={() => { setEditingCourt(null); setShowCourtModal(true); }}
                    onEdit={c => { setEditingCourt(c); setShowCourtModal(true); }}
                    onDelete={handleDeleteCourt}
                />
            )}

            {/* ════════════ MODALES ════════════ */}

            {/* CREAR RESERVA */}
            <Modal isOpen={!!selectedSlot} onClose={() => setSelectedSlot(null)} title="Nueva Reserva" size="sm"
                actions={[
                    { label: 'Cancelar', onClick: () => setSelectedSlot(null), variant: 'secondary' },
                    { label: 'Crear Reserva', onClick: handleCreateReservation, variant: 'primary', loading: saving },
                ]}>
                {selectedSlot && (
                    <div className="space-y-4">
                        <div className="bg-indigo-50 rounded-xl p-3 flex items-center gap-3">
                            <Calendar size={18} className="text-indigo-600 shrink-0"/>
                            <div>
                                <div className="text-xs font-bold text-indigo-600 uppercase">Pista {selectedSlot.courtNumber}</div>
                                <div className="font-black text-slate-800 text-sm">
                                    {selectedSlot.startTime} — {minsToTime(timeToMins(selectedSlot.startTime) + slotMinutes)} · {slotMinutes} min
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nombre del jugador *</label>
                            <input value={createForm.playerName} onChange={e => setCreateForm(f => ({...f, playerName: e.target.value}))}
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-indigo-400 outline-none" placeholder="Ej: Juan García"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Teléfono</label>
                            <input value={createForm.playerPhone} onChange={e => setCreateForm(f => ({...f, playerPhone: e.target.value}))}
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-indigo-400 outline-none" placeholder="600 000 000"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Acompañante</label>
                            <input value={createForm.partnerName} onChange={e => setCreateForm(f => ({...f, partnerName: e.target.value}))}
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-indigo-400 outline-none" placeholder="Nombre del compañero/a"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Notas</label>
                            <input value={createForm.notes} onChange={e => setCreateForm(f => ({...f, notes: e.target.value}))}
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-indigo-400 outline-none" placeholder="Opcional"/>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => {
                                if (!selectedSlot) return;
                                const text = `Hola, quiero reservar Pista ${selectedSlot.courtNumber} el ${formatDateLong(selectedDate)} de ${selectedSlot.startTime} a ${minsToTime(timeToMins(selectedSlot.startTime) + slotMinutes)}. ¿Está disponible?`;
                                window.open(`https://wa.me/${clubData.phone?.replace(/\s/g,'')}?text=${encodeURIComponent(text)}`, '_blank');
                            }} className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors">
                                <MessageCircle size={14}/> WhatsApp
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* VER RESERVA */}
            <Modal isOpen={!!selectedReservation} onClose={() => setSelectedReservation(null)} title="Reserva"
                size="sm">
                {selectedReservation && (
                    <div className="space-y-4">
                        <div className={`rounded-xl p-3 border-l-4 ${STATUS_STYLES[selectedReservation.status].bg} ${STATUS_STYLES[selectedReservation.status].border}`}>
                            <div className={`text-xs font-bold uppercase mb-1 ${STATUS_STYLES[selectedReservation.status].text}`}>
                                {STATUS_STYLES[selectedReservation.status].label}
                            </div>
                            <div className="font-black text-slate-800">
                                Pista {selectedReservation.court_number} · {extractTime(selectedReservation.start_at)}–{extractTime(selectedReservation.end_at)}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                                {selectedReservation.source === 'whatsapp' ? '📱 Vía WhatsApp' : selectedReservation.source === 'admin' ? '⚙️ Creada por admin' : '📲 Desde la app'}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <InfoRow icon={<User size={14}/>} label="Jugador" value={selectedReservation.player_name || '—'}/>
                            {selectedReservation.player_phone && <InfoRow icon={<Phone size={14}/>} label="Teléfono" value={selectedReservation.player_phone}/>}
                            {selectedReservation.partner_name && <InfoRow icon={<User size={14}/>} label="Acompañante" value={selectedReservation.partner_name}/>}
                            {selectedReservation.notes && <InfoRow icon={<Clock size={14}/>} label="Notas" value={selectedReservation.notes}/>}
                        </div>
                        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                            {selectedReservation.status === 'pending' && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleConfirmReservation(selectedReservation.id)} className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors">
                                        <Check size={16}/> Confirmar
                                    </button>
                                    <button onClick={() => handleRejectReservation(selectedReservation.id)} className="flex-1 py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors">
                                        <X size={16}/> Rechazar
                                    </button>
                                </div>
                            )}
                            {selectedReservation.player_phone && (
                                <a href={`https://wa.me/${selectedReservation.player_phone.replace(/\s/g,'')}?text=${encodeURIComponent(`Hola ${selectedReservation.player_name}, tu reserva de Pista ${selectedReservation.court_number} el ${formatDateLong(selectedDate)} a las ${extractTime(selectedReservation.start_at)} está ${selectedReservation.status === 'confirmed' ? 'CONFIRMADA ✅' : 'pendiente ⏳'}.`)}`}
                                    target="_blank" rel="noreferrer"
                                    className="flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-sm hover:bg-emerald-100 transition-colors">
                                    <MessageCircle size={16}/> Notificar por WhatsApp
                                </a>
                            )}
                            {(selectedReservation.status === 'confirmed' || selectedReservation.status === 'pending') && (
                                <button onClick={() => handleCancelReservation(selectedReservation.id)} className="py-2 text-slate-400 text-xs font-bold hover:text-rose-500 transition-colors">
                                    Cancelar reserva
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* BLOQUEAR SLOT */}
            <Modal isOpen={showBlockModal} onClose={() => setShowBlockModal(false)} title="Bloquear Pista" size="sm"
                icon={<Lock size={24}/>} iconColor="danger"
                actions={[
                    { label: 'Cancelar', onClick: () => setShowBlockModal(false), variant: 'secondary' },
                    { label: 'Bloquear', onClick: handleCreateBlock, variant: 'danger', loading: saving },
                ]}>
                <div className="space-y-4">
                    {blockSlotData && (
                        <div className="bg-slate-50 rounded-xl p-3 text-sm font-medium text-slate-600">
                            Pista {blockSlotData.courtNumber} · {blockSlotData.startTime}–{minsToTime(timeToMins(blockSlotData.startTime) + slotMinutes)}
                        </div>
                    )}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Motivo</label>
                        <input value={blockForm.reason} onChange={e => setBlockForm(f => ({...f, reason: e.target.value}))}
                            className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-rose-400 outline-none" placeholder="Ej: Torneo de tarde"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Tipo</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['manual', 'maintenance', 'private'] as const).map(t => (
                                <button key={t} onClick={() => setBlockForm(f => ({...f, blockType: t}))}
                                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${blockForm.blockType === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>
                                    {t === 'manual' ? 'Bloqueo' : t === 'maintenance' ? 'Mantenim.' : 'Privado'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* VER BLOQUEO */}
            <Modal isOpen={!!selectedBlock} onClose={() => setSelectedBlock(null)} title="Bloqueo" size="sm"
                actions={[
                    { label: 'Cerrar', onClick: () => setSelectedBlock(null), variant: 'secondary' },
                    { label: 'Eliminar Bloqueo', onClick: () => selectedBlock && handleDeleteBlock(selectedBlock.id), variant: 'danger' },
                ]}>
                {selectedBlock && (
                    <div className="space-y-3">
                        <div className={`rounded-xl p-3 ${BLOCK_STYLES[selectedBlock.block_type]?.bg || 'bg-slate-100'}`}>
                            <div className={`font-black text-sm ${BLOCK_STYLES[selectedBlock.block_type]?.text || 'text-slate-700'}`}>
                                {selectedBlock.reason}
                            </div>
                            <div className="text-xs opacity-70 mt-0.5">
                                Pista {selectedBlock.court_number} · {extractTime(selectedBlock.start_at)}–{extractTime(selectedBlock.end_at)}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* CONFIGURAR PISTA */}
            <CourtEditModal
                isOpen={showCourtModal}
                court={editingCourt}
                onClose={() => { setShowCourtModal(false); setEditingCourt(null); }}
                onSave={handleSaveCourt}
                saving={saving}
            />
        </div>
    );
};

// ─── SUB-COMPONENTES ──────────────────────────────────────────────────────────

const LegendDot: React.FC<{ color: string; label: string }> = ({ color, label }) => (
    <div className="flex items-center gap-1">
        <div className={`w-3 h-3 rounded-sm ${color}`}/>
        <span className="text-[10px] text-slate-500 font-medium">{label}</span>
    </div>
);

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
    <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400 shrink-0">{icon}</span>
        <span className="text-slate-400 text-xs w-20 shrink-0">{label}</span>
        <span className="font-bold text-slate-800 truncate">{value}</span>
    </div>
);

const WeekStrip: React.FC<{ selectedDate: Date; onSelect: (d: Date) => void }> = ({ selectedDate, onSelect }) => {
    const today = new Date();
    // Mostrar 7 días centrados en hoy
    const days: Date[] = [];
    for (let i = -3; i <= 3; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        days.push(d);
    }
    return (
        <div className="flex gap-1 justify-between">
            {days.map(d => {
                const isSelected = toLocalDateStr(d) === toLocalDateStr(selectedDate);
                const isTodayDay = toLocalDateStr(d) === toLocalDateStr(today);
                return (
                    <button key={d.toISOString()} onClick={() => onSelect(new Date(d))}
                        className={`flex-1 flex flex-col items-center py-1.5 rounded-xl transition-all text-center ${isSelected ? 'text-white' : isTodayDay ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                        style={isSelected ? { backgroundColor: THEME.cta } : {}}>
                        <span className={`text-[9px] font-bold uppercase ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>{DAY_NAMES[d.getDay()]}</span>
                        <span className={`text-sm font-black ${isSelected ? 'text-white' : 'text-slate-700'}`}>{d.getDate()}</span>
                    </button>
                );
            })}
        </div>
    );
};

// ─── COLUMNA DE PISTA ─────────────────────────────────────────────────────────

interface CourtColumnProps {
    court: CourtConfig;
    dateStr: string;
    openTime: string;
    closeTime: string;
    slotMinutes: 60 | 90;
    gridHeight: number;
    timeLabels: string[];
    reservations: CourtReservation[];
    blocks: CourtBlock[];
    draggingId: string | null;
    onSlotClick: (startTime: string) => void;
    onBlockSlot: (startTime: string) => void;
    onReservationClick: (r: CourtReservation) => void;
    onBlockClick: (b: CourtBlock) => void;
    onDragStart: (e: React.DragEvent, r: CourtReservation) => void;
    onDrop: (e: React.DragEvent, courtNumber: number, slotTime: string) => void;
}

const CourtColumn: React.FC<CourtColumnProps> = ({
    court, dateStr, openTime, closeTime, slotMinutes, gridHeight,
    timeLabels, reservations, blocks, draggingId,
    onSlotClick, onBlockSlot, onReservationClick, onBlockClick, onDragStart, onDrop
}) => {
    const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

    // Genera slots libres evitando los que ya tienen reserva o bloqueo
    const occupiedRanges = [
        ...reservations.filter(r => r.status !== 'rejected' && r.status !== 'cancelled')
            .map(r => ({ start: timeToMins(extractTime(r.start_at)), end: timeToMins(extractTime(r.end_at)) })),
        ...blocks.map(b => ({ start: timeToMins(extractTime(b.start_at)), end: timeToMins(extractTime(b.end_at)) })),
    ];

    const isOccupied = (startMins: number, endMins: number) =>
        occupiedRanges.some(r => startMins < r.end && endMins > r.start);

    const freeSlots: string[] = [];
    let t = timeToMins(openTime);
    const end = timeToMins(closeTime);
    while (t + slotMinutes <= end) {
        const slotStart = minsToTime(t);
        if (!isOccupied(t, t + slotMinutes)) freeSlots.push(slotStart);
        t += slotMinutes;
    }

    return (
        <div className="flex-1 min-w-[120px] border-r border-slate-100 last:border-r-0 relative" style={{ height: gridHeight }}>
            {/* Grid lines */}
            {timeLabels.map((label, i) => (
                <div key={label} className="absolute w-full border-t border-slate-100"
                    style={{ top: i * GRID_ROW_MINS * PX_PER_MIN, height: GRID_ROW_MINS * PX_PER_MIN }}
                />
            ))}

            {/* Free slots — clicables */}
            {freeSlots.map(startTime => {
                const top = (timeToMins(startTime) - timeToMins(openTime)) * PX_PER_MIN;
                const height = slotMinutes * PX_PER_MIN - 2;
                const isHovered = hoveredSlot === startTime;
                return (
                    <div key={startTime}
                        className="absolute left-0.5 right-0.5 rounded-lg border border-dashed border-slate-200 cursor-pointer transition-all flex flex-col items-center justify-center group"
                        style={{ top: top + 1, height }}
                        onMouseEnter={() => setHoveredSlot(startTime)}
                        onMouseLeave={() => setHoveredSlot(null)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => onDrop(e, court.court_number, startTime)}
                        onClick={() => onSlotClick(startTime)}
                        onContextMenu={e => { e.preventDefault(); onBlockSlot(startTime); }}
                    >
                        {isHovered && (
                            <div className="flex flex-col items-center gap-0.5 pointer-events-none">
                                <Plus size={14} className="text-indigo-400"/>
                                <span className="text-[10px] font-bold text-indigo-400">{startTime}</span>
                            </div>
                        )}
                        {!isHovered && (
                            <span className="text-[9px] font-medium text-slate-300 group-hover:text-indigo-300">{startTime}</span>
                        )}
                    </div>
                );
            })}

            {/* Reservas */}
            {reservations.filter(r => r.status !== 'rejected' && r.status !== 'cancelled').map(res => {
                const top = slotTop(res.start_at, openTime, dateStr);
                if (top < 0) return null;
                const h = slotHeight(res.start_at, res.end_at) - 2;
                const style = STATUS_STYLES[res.status];
                const isDragging = draggingId === res.id;
                return (
                    <div key={res.id}
                        draggable
                        onDragStart={e => onDragStart(e, res)}
                        onDragEnd={() => {}}
                        onClick={() => onReservationClick(res)}
                        className={`absolute left-0.5 right-0.5 rounded-lg border-l-4 px-2 py-1 cursor-pointer hover:brightness-95 transition-all overflow-hidden ${style.bg} ${style.border} ${isDragging ? 'opacity-40' : ''}`}
                        style={{ top: top + 1, height: h }}
                    >
                        <div className={`text-[10px] font-black uppercase tracking-wide ${style.text}`}>{style.label}</div>
                        <div className="text-xs font-bold text-slate-800 truncate leading-tight">{res.player_name}</div>
                        {res.partner_name && <div className="text-[9px] text-slate-500 truncate">+ {res.partner_name}</div>}
                        <div className={`text-[9px] font-bold mt-0.5 ${style.text} opacity-70`}>
                            {extractTime(res.start_at)}–{extractTime(res.end_at)}
                        </div>
                    </div>
                );
            })}

            {/* Bloqueos */}
            {blocks.map(block => {
                const top = slotTop(block.start_at, openTime, dateStr);
                if (top < 0) return null;
                const h = slotHeight(block.start_at, block.end_at) - 2;
                const bStyle = BLOCK_STYLES[block.block_type] || BLOCK_STYLES.manual;
                return (
                    <div key={block.id}
                        onClick={() => onBlockClick(block)}
                        className={`absolute left-0.5 right-0.5 rounded-lg px-2 py-1 cursor-pointer hover:brightness-95 transition-all flex flex-col justify-center overflow-hidden ${bStyle.bg}`}
                        style={{ top: top + 1, height: h - 1 }}>
                        <div className={`flex items-center gap-1 ${bStyle.text}`}>
                            {bStyle.icon}
                            <span className="text-[10px] font-black uppercase">{bStyle.label}</span>
                        </div>
                        {block.reason !== bStyle.label && (
                            <span className={`text-[9px] truncate ${bStyle.text} opacity-70`}>{block.reason}</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ─── PANEL DE CONFIGURACIÓN ───────────────────────────────────────────────────

const SetupTab: React.FC<{
    courts: CourtConfig[];
    onAdd: () => void;
    onEdit: (c: CourtConfig) => void;
    onDelete: (id: string) => void;
}> = ({ courts, onAdd, onEdit, onDelete }) => (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
                Configura tus pistas, horarios y duración de slots. Puedes tener hasta 12 pistas.
            </p>
            <button onClick={onAdd} disabled={courts.length >= 12}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white disabled:opacity-40 transition-all"
                style={{ backgroundColor: THEME.cta }}>
                <Plus size={16}/> Añadir
            </button>
        </div>
        {courts.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-400 font-medium mb-4">No hay pistas configuradas</p>
                <button onClick={onAdd} style={{ backgroundColor: THEME.cta }} className="px-6 py-2 rounded-xl text-white font-bold text-sm">
                    Añadir primera pista
                </button>
            </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {courts.map(c => (
                <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex justify-between items-start">
                    <div>
                        <div className="font-black text-slate-900">{c.court_name}</div>
                        <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                            <div><Clock size={10} className="inline mr-1"/>{c.open_time} – {c.close_time}</div>
                            <div>Slots de <span className="font-bold">{c.slot_minutes} min</span></div>
                            <div>{c.active_days.map(d => DAY_NAMES[d]).join(' · ')}</div>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={() => onEdit(c)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 size={16}/></button>
                        <button onClick={() => onDelete(c.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// ─── MODAL DE EDICIÓN DE PISTA ────────────────────────────────────────────────

const CourtEditModal: React.FC<{
    isOpen: boolean;
    court: CourtConfig | null;
    onClose: () => void;
    onSave: (c: Partial<CourtConfig>) => void;
    saving: boolean;
}> = ({ isOpen, court, onClose, onSave, saving }) => {
    const [form, setForm] = useState({
        court_name: 'Pista',
        slot_minutes: 90 as 60 | 90,
        open_time: '08:00',
        close_time: '22:00',
        active_days: [0,1,2,3,4,5,6],
    });

    useEffect(() => {
        if (court) {
            setForm({ court_name: court.court_name, slot_minutes: court.slot_minutes, open_time: court.open_time, close_time: court.close_time, active_days: court.active_days });
        } else {
            setForm({ court_name: 'Pista', slot_minutes: 90, open_time: '08:00', close_time: '22:00', active_days: [0,1,2,3,4,5,6] });
        }
    }, [court, isOpen]);

    const toggleDay = (day: number) => {
        setForm(f => ({
            ...f,
            active_days: f.active_days.includes(day) ? f.active_days.filter(d => d !== day) : [...f.active_days, day].sort()
        }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={court ? 'Editar Pista' : 'Nueva Pista'} size="sm"
            actions={[
                { label: 'Cancelar', onClick: onClose, variant: 'secondary' },
                { label: court ? 'Guardar' : 'Añadir Pista', onClick: () => onSave({ ...form, id: court?.id }), variant: 'primary', loading: saving },
            ]}>
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nombre</label>
                    <input value={form.court_name} onChange={e => setForm(f => ({...f, court_name: e.target.value}))}
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-indigo-400 outline-none" placeholder="Ej: Pista Central"/>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Duración del slot</label>
                    <div className="flex gap-2">
                        {([60, 90] as const).map(m => (
                            <button key={m} onClick={() => setForm(f => ({...f, slot_minutes: m}))}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${form.slot_minutes === m ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200'}`}
                                style={form.slot_minutes === m ? { backgroundColor: THEME.cta } : {}}>
                                {m} min
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Apertura</label>
                        <input type="time" value={form.open_time} onChange={e => setForm(f => ({...f, open_time: e.target.value}))}
                            className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-indigo-400 outline-none"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Cierre</label>
                        <input type="time" value={form.close_time} onChange={e => setForm(f => ({...f, close_time: e.target.value}))}
                            className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-indigo-400 outline-none"/>
                    </div>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Días activos</label>
                    <div className="flex gap-1">
                        {DAY_NAMES.map((name, i) => (
                            <button key={i} onClick={() => toggleDay(i)}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-black border transition-all ${form.active_days.includes(i) ? 'text-white border-transparent' : 'bg-white text-slate-400 border-slate-200'}`}
                                style={form.active_days.includes(i) ? { backgroundColor: THEME.cta } : {}}>
                                {name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ClubCalendar;
