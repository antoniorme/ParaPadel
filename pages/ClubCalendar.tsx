import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHistory } from '../store/HistoryContext';
import { useAuth } from '../store/AuthContext';
import { supabase } from '../lib/supabase';
import { Modal, useToast } from '../components';
import { CourtConfig, CourtBlock, CourtReservation, ReservationStatus } from '../types';
import {
    ChevronLeft, ChevronRight, Plus, Settings, Check, X,
    Phone, MessageCircle, Clock, User, Trash2, RefreshCw,
    Calendar, Lock, Wrench, AlertTriangle, Edit2, CalendarDays,
    Repeat, Ban, Swords, BarChart2
} from 'lucide-react';
import { MATCH_LEVELS } from '../utils/categories';
import { generateClubMatchesText, openWhatsApp } from '../utils/whatsapp';
import { THEME, PP } from '../utils/theme';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const PX_PER_HOUR = 56;
const PX_PER_MIN = PX_PER_HOUR / 60;
const GRID_ROW_MINS = 30;

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_NAMES_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTH_NAMES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// ─── TIPOS LOCALES ────────────────────────────────────────────────────────────

interface RecurringSlot {
    id: string;
    club_id: string;
    court_number: number;
    day_of_week: number; // 0=Dom … 6=Sáb
    start_time: string;  // "HH:MM"
    end_time: string;    // "HH:MM"
    player_name: string;
    player_phone?: string;
    partner_name?: string;
    notes?: string;
    start_date: string;       // "YYYY-MM-DD"
    end_date?: string | null;
    color: string;
    is_active: boolean;
}

interface RecurringException {
    id: string;
    recurring_slot_id: string;
    exception_date: string; // "YYYY-MM-DD"
    reason?: string;
}

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

interface RecurringForm {
    court_number: number;
    day_of_week: number;
    start_time: string;
    end_time: string;
    player_name: string;
    player_phone: string;
    partner_name: string;
    notes: string;
    start_date: string;
    end_date: string;
}

// ─── UTILIDADES ───────────────────────────────────────────────────────────────

const timeToMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const minsToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toLocalDateStr = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const buildTimestamp = (dateStr: string, timeStr: string) => new Date(`${dateStr}T${timeStr}:00`).toISOString();
const extractTime = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
const extractDateStr = (iso: string) => iso.split('T')[0];
const isSameDay = (iso: string, dateStr: string) => extractDateStr(iso) === dateStr;
const isToday = (date: Date) => toLocalDateStr(date) === toLocalDateStr(new Date());

const slotTop = (startIso: string, openTime: string, dateStr: string) => {
    if (extractDateStr(startIso) !== dateStr) return -1;
    return (timeToMins(extractTime(startIso)) - timeToMins(openTime)) * PX_PER_MIN;
};
const slotHeight = (startIso: string, endIso: string) =>
    (timeToMins(extractTime(endIso)) - timeToMins(extractTime(startIso))) * PX_PER_MIN;

const generateTimeLabels = (openTime: string, closeTime: string) => {
    const labels: string[] = [];
    let t = timeToMins(openTime);
    while (t < timeToMins(closeTime)) { labels.push(minsToTime(t)); t += GRID_ROW_MINS; }
    return labels;
};
const totalGridHeight = (open: string, close: string) => (timeToMins(close) - timeToMins(open)) * PX_PER_MIN;
const formatDateLong = (date: Date) => `${DAY_NAMES_LONG[date.getDay()]} ${date.getDate()} de ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;

// Week helpers
const getWeekDays = (date: Date): Date[] => {
    const d = new Date(date);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return Array.from({ length: 7 }, (_, i) => { const x = new Date(monday); x.setDate(monday.getDate() + i); return x; });
};

const formatWeekRange = (date: Date): string => {
    const days = getWeekDays(date);
    const s = days[0]; const e = days[6];
    if (s.getMonth() === e.getMonth())
        return `${s.getDate()}–${e.getDate()} de ${MONTH_NAMES[e.getMonth()]} ${e.getFullYear()}`;
    return `${s.getDate()} ${MONTH_NAMES_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTH_NAMES_SHORT[e.getMonth()]} ${e.getFullYear()}`;
};

// ─── ESTILOS ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ReservationStatus, { bg: string; border: string; text: string; label: string }> = {
    pending:   { bg: 'bg-amber-50',  border: 'border-amber-400',  text: 'text-amber-800',  label: 'Pendiente' },
    confirmed: { bg: 'bg-indigo-50', border: 'border-indigo-400', text: 'text-indigo-800', label: 'Confirmada' },
    rejected:  { bg: 'bg-rose-50',   border: 'border-rose-400',   text: 'text-rose-800',   label: 'Rechazada' },
    cancelled: { bg: 'bg-slate-50',  border: 'border-slate-300',  text: 'text-slate-500',  label: 'Cancelada' },
};
const BLOCK_STYLES: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
    tournament:  { bg: 'bg-slate-800',  text: 'text-white',      label: 'Torneo',        icon: <Calendar size={10}/> },
    maintenance: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Mantenimiento', icon: <Wrench size={10}/> },
    manual:      { bg: 'bg-slate-200',  text: 'text-slate-700',  label: 'Bloqueado',     icon: <Lock size={10}/> },
    private:     { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Privado',       icon: <Lock size={10}/> },
};

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
    const [recurringSlots, setRecurringSlots] = useState<RecurringSlot[]>([]);
    const [recurringExceptions, setRecurringExceptions] = useState<RecurringException[]>([]);
    const [loading, setLoading] = useState(true);
    const [showConfig, setShowConfig] = useState(false);
    const [selectedDuration, setSelectedDuration] = useState<60 | 90>(90);

    // Menú de elección de acción al pulsar un slot libre
    const [slotChoiceData, setSlotChoiceData] = useState<{ courtNumber: number; startTime: string } | null>(null);

    // Modal de partido abierto desde pista
    const [showOpenMatchModal, setShowOpenMatchModal] = useState(false);
    const [openMatchSlot, setOpenMatchSlot] = useState<{ courtNumber: number; startTime: string } | null>(null);
    const [openMatchLevel, setOpenMatchLevel] = useState('');
    const [openMatchNotes, setOpenMatchNotes] = useState('');

    // Modales de reserva / bloqueo
    const [selectedSlot, setSelectedSlot] = useState<{ courtNumber: number; startTime: string } | null>(null);
    const [selectedReservation, setSelectedReservation] = useState<CourtReservation | null>(null);
    const [selectedBlock, setSelectedBlock] = useState<CourtBlock | null>(null);
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [blockSlotData, setBlockSlotData] = useState<{ courtNumber: number; startTime: string } | null>(null);

    // Modal de recurrente
    const [showRecurringModal, setShowRecurringModal] = useState(false);
    const [recurringSlotCtx, setRecurringSlotCtx] = useState<{ courtNumber: number; startTime: string } | null>(null);
    const [selectedRecurring, setSelectedRecurring] = useState<RecurringSlot | null>(null);

    // Formularios
    const [createForm, setCreateForm] = useState<CreateReservationForm>({ playerName: '', playerPhone: '', partnerName: '', notes: '' });
    const [blockForm, setBlockForm] = useState<BlockForm>({ reason: '', blockType: 'manual' });
    const [saving, setSaving] = useState(false);
    const today = toLocalDateStr(new Date());
    const [recurringForm, setRecurringForm] = useState<RecurringForm>({
        court_number: 1, day_of_week: new Date().getDay(), start_time: '09:00', end_time: '10:30',
        player_name: '', player_phone: '', partner_name: '', notes: '', start_date: today, end_date: '',
    });

    // Setup de pistas
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

    // ─── CARGA ────────────────────────────────────────────────────────────────

    const loadCourts = useCallback(async () => {
        if (!clubData.id) return;
        const { data } = await supabase.from('court_availability').select('*')
            .eq('club_id', clubData.id).eq('is_active', true).order('sort_order');
        if (data) setCourts(data as CourtConfig[]);
    }, [clubData.id]);

    const loadDayData = useCallback(async () => {
        if (!clubData.id) return;
        setLoading(true);
        const from = new Date(selectedDate); from.setDate(from.getDate() - 1);
        const to = new Date(selectedDate); to.setDate(to.getDate() + 1);
        const [resRes, blkRes] = await Promise.all([
            supabase.from('court_reservations').select('*').eq('club_id', clubData.id)
                .gte('start_at', from.toISOString()).lte('start_at', to.toISOString()),
            supabase.from('court_blocks').select('*').eq('club_id', clubData.id)
                .gte('start_at', from.toISOString()).lte('start_at', to.toISOString()),
        ]);
        if (resRes.data) setReservations(resRes.data as CourtReservation[]);
        if (blkRes.data) setBlocks(blkRes.data as CourtBlock[]);
        setLoading(false);
    }, [clubData.id, selectedDate]);

    const loadRecurringData = useCallback(async () => {
        if (!clubData.id) return;
        const { data: slots } = await supabase.from('recurring_slots').select('*')
            .eq('club_id', clubData.id).eq('is_active', true);
        if (!slots) return;
        setRecurringSlots(slots as RecurringSlot[]);
        if (slots.length === 0) return;
        const weekDays = getWeekDays(selectedDate);
        const weekStart = toLocalDateStr(weekDays[0]);
        const weekEnd = toLocalDateStr(weekDays[6]);
        const { data: exceptions } = await supabase.from('recurring_exceptions').select('*')
            .in('recurring_slot_id', slots.map((s: any) => s.id))
            .gte('exception_date', weekStart).lte('exception_date', weekEnd);
        if (exceptions) setRecurringExceptions(exceptions as RecurringException[]);
    }, [clubData.id, selectedDate]);

    useEffect(() => { loadCourts(); }, [loadCourts]);
    useEffect(() => { if (courts.length > 0) { loadDayData(); loadRecurringData(); } }, [loadDayData, loadRecurringData, courts.length]);

    // Recurring slots aplicables a una fecha concreta
    const getRecurringSlotsForDate = (courtNumber: number, ds: string): RecurringSlot[] => {
        const date = new Date(ds + 'T12:00:00');
        const dow = date.getDay();
        return recurringSlots.filter(rs => {
            if (rs.court_number !== courtNumber) return false;
            if (rs.day_of_week !== dow) return false;
            if (rs.start_date > ds) return false;
            if (rs.end_date && rs.end_date < ds) return false;
            return !recurringExceptions.some(ex => ex.recurring_slot_id === rs.id && ex.exception_date === ds);
        });
    };

    // ─── ACCIONES ─────────────────────────────────────────────────────────────

    const handleCreateReservation = async () => {
        if (!selectedSlot || !clubData.id || !createForm.playerName.trim()) return;
        setSaving(true);
        const startAt = buildTimestamp(dateStr, selectedSlot.startTime);
        const endAt = buildTimestamp(dateStr, minsToTime(timeToMins(selectedSlot.startTime) + selectedDuration));
        const { error } = await supabase.from('court_reservations').insert([{
            club_id: clubData.id, court_number: selectedSlot.courtNumber,
            player_name: createForm.playerName.trim(), player_phone: createForm.playerPhone.trim() || null,
            partner_name: createForm.partnerName.trim() || null, notes: createForm.notes.trim() || null,
            start_at: startAt, end_at: endAt, status: 'confirmed', source: 'admin', confirmed_by: user?.id,
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
            .update({ status: 'confirmed', confirmed_by: user?.id, confirmed_at: new Date().toISOString() }).eq('id', id);
        if (error) { showError('Error'); return; }
        success('Reserva confirmada'); setSelectedReservation(null); loadDayData();
    };
    const handleRejectReservation = async (id: string) => {
        const res = reservations.find(r => r.id === id);
        await supabase.from('court_reservations').update({ status: 'rejected' }).eq('id', id);
        if (res?.notes?.startsWith('match:')) {
            const matchId = res.notes.replace('match:', '');
            await supabase.from('free_matches').update({ status: 'cancelled' }).eq('id', matchId);
        }
        success('Reserva rechazada'); setSelectedReservation(null); loadDayData();
    };
    const handleCancelReservation = async (id: string) => {
        const res = reservations.find(r => r.id === id);
        await supabase.from('court_reservations').update({ status: 'cancelled' }).eq('id', id);
        // Si esta reserva está vinculada a un partido, cancelarlo también
        if (res?.notes?.startsWith('match:')) {
            const matchId = res.notes.replace('match:', '');
            await supabase.from('free_matches').update({ status: 'cancelled' }).eq('id', matchId);
        }
        success('Reserva cancelada'); setSelectedReservation(null); loadDayData();
    };

    const handleCreateBlock = async () => {
        if (!blockSlotData || !clubData.id) return;
        setSaving(true);
        const startAt = buildTimestamp(dateStr, blockSlotData.startTime);
        const endAt = buildTimestamp(dateStr, minsToTime(timeToMins(blockSlotData.startTime) + selectedDuration));
        const { error } = await supabase.from('court_blocks').insert([{
            club_id: clubData.id, court_number: blockSlotData.courtNumber,
            reason: blockForm.reason.trim() || 'Bloqueado', block_type: blockForm.blockType,
            start_at: startAt, end_at: endAt, created_by: user?.id,
        }]);
        setSaving(false);
        if (error) { showError('Error al bloquear'); return; }
        success('Pista bloqueada'); setShowBlockModal(false); setBlockSlotData(null);
        setBlockForm({ reason: '', blockType: 'manual' }); loadDayData();
    };

    const handleDeleteBlock = async (id: string) => {
        await supabase.from('court_blocks').delete().eq('id', id);
        success('Bloqueo eliminado'); setSelectedBlock(null); loadDayData();
    };

    const handleCreateRecurringSlot = async () => {
        if (!clubData.id || !recurringForm.player_name.trim()) return;
        setSaving(true);
        const { error } = await supabase.from('recurring_slots').insert([{
            club_id: clubData.id,
            court_number: recurringForm.court_number,
            day_of_week: recurringForm.day_of_week,
            start_time: recurringForm.start_time,
            end_time: recurringForm.end_time,
            player_name: recurringForm.player_name.trim(),
            player_phone: recurringForm.player_phone.trim() || null,
            partner_name: recurringForm.partner_name.trim() || null,
            notes: recurringForm.notes.trim() || null,
            start_date: recurringForm.start_date,
            end_date: recurringForm.end_date || null,
            color: 'amber',
            is_active: true,
        }]);
        setSaving(false);
        if (error) { showError('Error al crear el slot recurrente'); return; }
        success('Slot recurrente creado');
        setShowRecurringModal(false);
        setRecurringSlotCtx(null);
        loadRecurringData();
    };

    const handleAddException = async (recurringSlotId: string, exceptionDate: string) => {
        const { error } = await supabase.from('recurring_exceptions').insert([{
            recurring_slot_id: recurringSlotId,
            exception_date: exceptionDate,
            reason: 'Cancelado por admin',
        }]);
        if (error) { showError('Error al cancelar'); return; }
        success('Reserva recurrente cancelada para esta semana');
        setSelectedRecurring(null);
        loadRecurringData();
    };

    const handleDeleteRecurringSlot = async (id: string) => {
        await supabase.from('recurring_slots').update({ is_active: false }).eq('id', id);
        success('Slot recurrente eliminado'); setSelectedRecurring(null); loadRecurringData();
    };

    const handleCreateOpenMatch = async () => {
        if (!openMatchSlot || !clubData.id) return;
        setSaving(true);
        const scheduledAt = buildTimestamp(dateStr, openMatchSlot.startTime);
        const { data: matchData, error } = await supabase.from('free_matches').insert({
            club_id: clubData.id,
            scheduled_at: scheduledAt,
            court: courts.find(c => c.court_number === openMatchSlot.courtNumber)?.court_name || `Pista ${openMatchSlot.courtNumber}`,
            level: openMatchLevel || null,
            notes: openMatchNotes || null,
            max_players: 4,
            status: 'open',
        }).select('id, share_token').single();
        setSaving(false);
        if (error || !matchData) { showError('Error al crear el partido'); return; }

        // Bloquear el slot en court_reservations (fuente única de verdad para pistas)
        const endAt = buildTimestamp(dateStr, minsToTime(timeToMins(openMatchSlot!.startTime) + 90));
        await supabase.from('court_reservations').insert({
            club_id: clubData.id,
            court_number: openMatchSlot!.courtNumber,
            start_at: scheduledAt,
            end_at: endAt,
            status: 'confirmed',
            source: 'admin',
            notes: `match:${matchData.id}`,
        });

        success('Partido abierto creado');
        setShowOpenMatchModal(false);
        setOpenMatchSlot(null);
        setOpenMatchLevel('');
        setOpenMatchNotes('');
        loadDayData(); // Refrescar el calendario para mostrar el slot bloqueado
        // Ofrecer WhatsApp con todos los partidos del club
        if (clubData.name && clubData.id && matchData) {
            const { data: allOpen } = await supabase
                .from('free_matches')
                .select('id, scheduled_at, level, court, max_players, match_participants(id, attendance_status)')
                .eq('club_id', clubData.id).eq('status', 'open')
                .gte('scheduled_at', new Date().toISOString());
            if (allOpen && allOpen.length > 0) {
                const text = generateClubMatchesText(clubData.name, clubData.id, allOpen.map((m: any) => ({
                    scheduled_at: m.scheduled_at,
                    level: m.level,
                    court: m.court,
                    max_players: m.max_players || 4,
                    spots_taken: (m.match_participants || []).filter((p: any) => ['joined','confirmed'].includes(p.attendance_status)).length,
                })));
                openWhatsApp(text);
            }
        }
    };

    // ─── DRAG & DROP ──────────────────────────────────────────────────────────

    const handleDragStart = (e: React.DragEvent, res: CourtReservation) => {
        dragRef.current = { id: res.id, startTime: extractTime(res.start_at), endTime: extractTime(res.end_at) };
        setDraggingId(res.id); e.dataTransfer.effectAllowed = 'move';
    };
    const handleDrop = async (e: React.DragEvent, courtNumber: number, slotTime: string) => {
        e.preventDefault();
        if (!dragRef.current) return;
        const { id, startTime, endTime } = dragRef.current;
        if (slotTime === startTime) { setDraggingId(null); return; }
        const durationMins = timeToMins(endTime) - timeToMins(startTime);
        await supabase.from('court_reservations').update({
            court_number: courtNumber,
            start_at: buildTimestamp(dateStr, slotTime),
            end_at: buildTimestamp(dateStr, minsToTime(timeToMins(slotTime) + durationMins)),
        }).eq('id', id);
        setDraggingId(null); dragRef.current = null; loadDayData();
    };

    // ─── GESTIÓN PISTAS ───────────────────────────────────────────────────────

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
        setShowCourtModal(false); setEditingCourt(null); loadCourts();
    };

    const handleDeleteCourt = async (id: string) => {
        await supabase.from('court_availability').update({ is_active: false }).eq('id', id);
        success('Pista eliminada'); loadCourts();
    };

    // ─── RENDER ───────────────────────────────────────────────────────────────

    if (!clubData.id) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-4">
                <CalendarDays size={48} className="opacity-30"/>
                <p className="font-bold">Completa la configuración de tu club primero</p>
                <button onClick={() => navigate('/club')}
                    className="px-5 py-2.5 bg-violet-600 text-white text-sm font-black rounded-xl hover:bg-violet-700 transition-colors">
                    Ir a configuración del club
                </button>
            </div>
        );
    }

    const weekDays = getWeekDays(selectedDate);
    const pendingToday = reservations.filter(r => r.status === 'pending' && isSameDay(r.start_at, dateStr));

    return (
        <div className="space-y-4 pb-20" style={{ fontFamily: PP.font }}>

            {/* ── HEADER ── */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 4 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: PP.ink, letterSpacing: -0.8, lineHeight: 1.05 }}>Pistas</h1>
                    <p style={{ fontSize: 13.5, color: PP.mute, fontWeight: 500, marginTop: 6 }}>
                        Calendario semanal · {courts.length} pistas · {formatDateLong(selectedDate)}
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Week nav */}
                    <div style={{ display: 'flex', background: PP.card, border: `1px solid ${PP.hair}`, borderRadius: 10, height: 36 }}>
                        <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 7); setSelectedDate(d); }}
                            style={{ width: 34, background: 'none', border: 0, color: PP.ink2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ChevronLeft size={16}/>
                        </button>
                        <div style={{ width: 1, background: PP.hair }}/>
                        <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 7); setSelectedDate(d); }}
                            style={{ width: 34, background: 'none', border: 0, color: PP.ink2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ChevronRight size={16}/>
                        </button>
                    </div>
                    <button onClick={() => setSelectedDate(new Date())}
                        style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${PP.hairStrong}`, background: PP.card, color: PP.ink2, fontFamily: PP.font, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        Hoy
                    </button>
                    <button onClick={() => { setRecurringSlotCtx(null); setShowRecurringModal(true); }}
                        style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid #FDE68A`, background: '#FFFBEB', color: '#92400E', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        title="Añadir slot recurrente">
                        <Repeat size={16}/>
                    </button>
                    <button onClick={() => setShowConfig(v => !v)}
                        style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${showConfig ? PP.ink : PP.hairStrong}`, background: showConfig ? PP.ink : PP.card, color: showConfig ? '#fff' : PP.ink2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Settings size={16}/>
                    </button>
                    <button onClick={() => { loadDayData(); loadRecurringData(); }}
                        style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${PP.hairStrong}`, background: PP.card, color: PP.ink2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
                    </button>
                    <button onClick={() => setSlotChoiceData({ courtNumber: courts[0]?.court_number || 1, startTime: '09:00' })}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, border: 0, background: PP.primary, color: '#fff', fontFamily: PP.font, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        <Plus size={15}/> Nueva reserva
                    </button>
                </div>
            </div>

            {/* ── PANEL DE CONFIGURACIÓN ── */}
            {showConfig && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
                    <div className="flex items-center justify-between">
                        <span className="font-black text-slate-800 text-sm">Configuración de Pistas</span>
                        <button onClick={() => setShowConfig(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"><X size={16}/></button>
                    </div>

                    {/* Gestión de pistas */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Pistas</label>
                            <button onClick={() => { setEditingCourt(null); setShowCourtModal(true); }} disabled={courts.length >= 12}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs text-white disabled:opacity-40 transition-all"
                                style={{ backgroundColor: THEME.cta }}>
                                <Plus size={14}/> Añadir
                            </button>
                        </div>
                        {courts.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-4">No hay pistas configuradas</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {courts.map(c => (
                                    <div key={c.id} className="bg-slate-50 rounded-xl border border-slate-100 p-3 flex justify-between items-center">
                                        <div>
                                            <div className="font-black text-slate-800 text-sm">{c.court_name}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                <Clock size={9} className="inline mr-1"/>{c.open_time}–{c.close_time}
                                                <span className="mx-1">·</span>{c.active_days.map(d => DAY_NAMES[d]).join(' ')}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => { setEditingCourt(c); setShowCourtModal(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 size={14}/></button>
                                            <button onClick={() => handleDeleteCourt(c.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── WEEK STRIP ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: PP.ink, letterSpacing: -0.2, marginRight: 4 }}>
                    {new Date(selectedDate).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
                </div>
                {weekDays.map(d => {
                    const isSelected = toLocalDateStr(d) === dateStr;
                    const isTodayDay = isToday(d);
                    return (
                        <button key={d.toISOString()} onClick={() => setSelectedDate(new Date(d))}
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                padding: '8px 14px', borderRadius: 10, border: `1px solid ${isSelected ? PP.ink : PP.hair}`,
                                background: isSelected ? PP.ink : (isTodayDay ? PP.hairStrong : PP.card),
                                color: isSelected ? '#fff' : PP.ink2,
                                cursor: 'pointer', minWidth: 52,
                            }}>
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, opacity: isSelected ? 0.7 : 1, color: isSelected ? 'rgba(255,255,255,0.7)' : PP.mute }}>{DAY_NAMES[d.getDay()]}</span>
                            <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>{d.getDate()}</span>
                            {isTodayDay && !isSelected && <div style={{ width: 4, height: 4, borderRadius: 2, background: PP.primary, marginTop: 2 }}/>}
                        </button>
                    );
                })}
            </div>

            {/* ── PENDIENTES ── */}
            {pendingToday.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <h3 className="text-xs font-black text-amber-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <AlertTriangle size={14}/> {pendingToday.length} pendiente{pendingToday.length > 1 ? 's' : ''} de confirmación
                    </h3>
                    <div className="space-y-2">
                        {pendingToday.map(r => (
                            <div key={r.id} onClick={() => setSelectedReservation(r)}
                                className="bg-white rounded-xl p-3 border border-amber-100 flex justify-between items-center cursor-pointer hover:shadow-sm transition-shadow">
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">{r.player_name}</div>
                                    <div className="text-xs text-slate-500">Pista {r.court_number} · {extractTime(r.start_at)}–{extractTime(r.end_at)}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={e => { e.stopPropagation(); handleConfirmReservation(r.id); }} className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"><Check size={14}/></button>
                                    <button onClick={e => { e.stopPropagation(); handleRejectReservation(r.id); }} className="p-1.5 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200"><X size={14}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── SIN PISTAS ── */}
            {courts.length === 0 && !loading && (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                    <CalendarDays size={48} className="mx-auto text-slate-200 mb-4"/>
                    <h3 className="font-bold text-slate-700 mb-2">Sin pistas configuradas</h3>
                    <p className="text-sm text-slate-400 mb-4">Añade tus pistas para empezar a gestionar reservas</p>
                    <button onClick={() => setShowConfig(true)} style={{ backgroundColor: THEME.cta }} className="px-6 py-2 rounded-xl text-white font-bold text-sm">
                        Configurar Pistas
                    </button>
                </div>
            )}

            {/* ── GRID CALENDARIO ── */}
            {courts.length > 0 && (
                <div style={{ background: PP.card, border: `1px solid ${PP.hair}`, borderRadius: 14, boxShadow: PP.shadow, overflow: 'hidden' }}>
                    {/* Leyenda */}
                    <div className="flex items-center gap-3 px-4 py-2 flex-wrap" style={{ borderBottom: `1px solid ${PP.hair}`, background: '#FAFBFD' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: PP.mute, textTransform: 'uppercase', letterSpacing: 1 }}>Leyenda:</span>
                        <LegendDot color="bg-white border border-dashed border-slate-300" label="Libre"/>
                        <LegendDot color="bg-amber-50 border border-amber-300" label="Pendiente"/>
                        <LegendDot color="bg-indigo-50 border border-indigo-300" label="Confirmada"/>
                        <LegendDot color="bg-amber-200 border border-amber-500" label="Recurrente"/>
                        <LegendDot color="bg-slate-700" label="Bloqueado"/>
                    </div>
                    {/* SCROLL */}
                    <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '75vh' }}>
                        <div style={{ minWidth: Math.max(320, courts.length * 140 + 56) }}>
                            {/* Header pistas */}
                            <div className="flex sticky top-0 z-20 bg-white border-b border-slate-200">
                                <div className="w-14 shrink-0 border-r border-slate-100 bg-slate-50"/>
                                {courts.map(c => (
                                    <div key={c.id} className="flex-1 min-w-[140px] px-2 py-2.5 text-center border-r border-slate-100 last:border-r-0 bg-white">
                                        <div className="font-black text-slate-800 text-sm truncate">{c.court_name}</div>
                                    </div>
                                ))}
                            </div>
                            {/* Body */}
                            <div className="flex">
                                {/* Eje tiempo */}
                                <div className="w-14 shrink-0 border-r border-slate-100 relative" style={{ height: gridHeight }}>
                                    {timeLabels.map((label, i) => (
                                        <div key={label} className="absolute w-full flex items-start justify-end pr-2"
                                            style={{ top: i * GRID_ROW_MINS * PX_PER_MIN - 7, height: GRID_ROW_MINS * PX_PER_MIN }}>
                                            <span className="text-[9px] font-bold text-slate-400">{label}</span>
                                        </div>
                                    ))}
                                </div>
                                {/* Columnas */}
                                {courts.map(court => {
                                    const courtRes = reservations.filter(r => r.court_number === court.court_number && isSameDay(r.start_at, dateStr));
                                    const courtBlocks = blocks.filter(b => b.court_number === court.court_number && isSameDay(b.start_at, dateStr));
                                    const courtRecurring = getRecurringSlotsForDate(court.court_number, dateStr);
                                    return (
                                        <CourtColumn
                                            key={court.id}
                                            court={court} dateStr={dateStr}
                                            openTime={openTime} closeTime={closeTime}
                                            gridHeight={gridHeight} timeLabels={timeLabels}
                                            reservations={courtRes} blocks={courtBlocks}
                                            recurringSlots={courtRecurring}
                                            draggingId={draggingId}
                                            onSlotClick={(startTime) => {
                                                setSlotChoiceData({ courtNumber: court.court_number, startTime });
                                            }}
                                            onSlotRightClick={(startTime) => {
                                                setBlockSlotData({ courtNumber: court.court_number, startTime });
                                                setShowBlockModal(true);
                                            }}
                                            onSlotRecurring={(startTime) => {
                                                setRecurringForm(f => ({ ...f, court_number: court.court_number, start_time: startTime, end_time: minsToTime(timeToMins(startTime) + selectedDuration), day_of_week: new Date(dateStr + 'T12:00:00').getDay() }));
                                                setShowRecurringModal(true);
                                            }}
                                            onReservationClick={setSelectedReservation}
                                            onBlockClick={setSelectedBlock}
                                            onRecurringClick={setSelectedRecurring}
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

            {/* ════════ MODALES ════════ */}

            {/* CREAR RESERVA */}
            <Modal isOpen={!!selectedSlot} onClose={() => setSelectedSlot(null)} title="Nueva Reserva" size="sm"
                actions={[
                    { label: 'Cancelar', onClick: () => setSelectedSlot(null), variant: 'secondary' },
                    { label: 'Crear Reserva', onClick: handleCreateReservation, variant: 'primary', loading: saving },
                ]}>
                {selectedSlot && (
                    <div className="space-y-4">
                        {/* Duración */}
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Duración</label>
                            <div className="flex gap-2">
                                {([60, 90] as const).map(m => (
                                    <button key={m} type="button" onClick={() => setSelectedDuration(m)}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${selectedDuration === m ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200'}`}
                                        style={selectedDuration === m ? { backgroundColor: THEME.cta } : {}}>
                                        {m} min
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="bg-indigo-50 rounded-xl p-3 flex items-center gap-3">
                            <Calendar size={18} className="text-indigo-600 shrink-0"/>
                            <div>
                                <div className="text-xs font-bold text-indigo-600 uppercase">Pista {selectedSlot.courtNumber}</div>
                                <div className="font-black text-slate-800 text-sm">
                                    {selectedSlot.startTime} — {minsToTime(timeToMins(selectedSlot.startTime) + selectedDuration)} · {selectedDuration} min
                                </div>
                            </div>
                        </div>
                        {[
                            { key: 'playerName', label: 'Nombre del jugador *', placeholder: 'Ej: Juan García' },
                            { key: 'playerPhone', label: 'Teléfono', placeholder: '600 000 000' },
                            { key: 'partnerName', label: 'Acompañante', placeholder: 'Nombre del compañero/a' },
                            { key: 'notes', label: 'Notas', placeholder: 'Opcional' },
                        ].map(({ key, label, placeholder }) => (
                            <div key={key}>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{label}</label>
                                <input value={(createForm as any)[key]}
                                    onChange={e => setCreateForm(f => ({ ...f, [key]: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-indigo-400 outline-none" placeholder={placeholder}/>
                            </div>
                        ))}
                    </div>
                )}
            </Modal>

            {/* VER RESERVA */}
            <Modal isOpen={!!selectedReservation} onClose={() => setSelectedReservation(null)} title="Reserva" size="sm">
                {selectedReservation && (
                    <div className="space-y-4">
                        <div className={`rounded-xl p-3 border-l-4 ${STATUS_STYLES[selectedReservation.status].bg} ${STATUS_STYLES[selectedReservation.status].border}`}>
                            <div className={`text-xs font-bold uppercase mb-1 ${STATUS_STYLES[selectedReservation.status].text}`}>
                                {STATUS_STYLES[selectedReservation.status].label}
                            </div>
                            <div className="font-black text-slate-800">
                                Pista {selectedReservation.court_number} · {extractTime(selectedReservation.start_at)}–{extractTime(selectedReservation.end_at)}
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
                                    <button onClick={() => handleConfirmReservation(selectedReservation.id)} className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-600"><Check size={16}/> Confirmar</button>
                                    <button onClick={() => handleRejectReservation(selectedReservation.id)} className="flex-1 py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-rose-100"><X size={16}/> Rechazar</button>
                                </div>
                            )}
                            {selectedReservation.player_phone && (
                                <a href={`https://wa.me/${selectedReservation.player_phone.replace(/\s/g,'')}?text=${encodeURIComponent(`Hola ${selectedReservation.player_name}, tu reserva de Pista ${selectedReservation.court_number} el ${formatDateLong(selectedDate)} a las ${extractTime(selectedReservation.start_at)} está ${selectedReservation.status === 'confirmed' ? 'CONFIRMADA ✅' : 'pendiente ⏳'}.`)}`}
                                    target="_blank" rel="noreferrer"
                                    className="flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-sm hover:bg-emerald-100">
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
                            Pista {blockSlotData.courtNumber} · {blockSlotData.startTime}–{minsToTime(timeToMins(blockSlotData.startTime) + selectedDuration)}
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
                            <div className={`font-black text-sm ${BLOCK_STYLES[selectedBlock.block_type]?.text || 'text-slate-700'}`}>{selectedBlock.reason}</div>
                            <div className="text-xs opacity-70 mt-0.5">Pista {selectedBlock.court_number} · {extractTime(selectedBlock.start_at)}–{extractTime(selectedBlock.end_at)}</div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* CREAR SLOT RECURRENTE */}
            <Modal isOpen={showRecurringModal} onClose={() => setShowRecurringModal(false)} title="Slot Recurrente" size="sm"
                icon={<Repeat size={24}/>} iconColor="brand"
                actions={[
                    { label: 'Cancelar', onClick: () => setShowRecurringModal(false), variant: 'secondary' },
                    { label: 'Crear Recurrente', onClick: handleCreateRecurringSlot, variant: 'primary', loading: saving },
                ]}>
                <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 font-medium">
                        Los slots recurrentes se repiten cada semana el mismo día. Puedes cancelar semanas concretas sin romper la recurrencia.
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Pista</label>
                            <select value={recurringForm.court_number}
                                onChange={e => setRecurringForm(f => ({...f, court_number: parseInt(e.target.value)}))}
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-amber-400 outline-none">
                                {courts.map(c => <option key={c.id} value={c.court_number}>{c.court_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Día</label>
                            <select value={recurringForm.day_of_week}
                                onChange={e => setRecurringForm(f => ({...f, day_of_week: parseInt(e.target.value)}))}
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-amber-400 outline-none">
                                {DAY_NAMES_LONG.map((name, i) => <option key={i} value={i}>{name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Desde</label>
                            <input type="time" value={recurringForm.start_time}
                                onChange={e => setRecurringForm(f => ({...f, start_time: e.target.value}))}
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-amber-400 outline-none"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Hasta</label>
                            <input type="time" value={recurringForm.end_time}
                                onChange={e => setRecurringForm(f => ({...f, end_time: e.target.value}))}
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-amber-400 outline-none"/>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nombre del jugador *</label>
                        <input value={recurringForm.player_name}
                            onChange={e => setRecurringForm(f => ({...f, player_name: e.target.value}))}
                            className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-amber-400 outline-none" placeholder="Ej: Carlos Entrenador"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Teléfono</label>
                        <input value={recurringForm.player_phone}
                            onChange={e => setRecurringForm(f => ({...f, player_phone: e.target.value}))}
                            className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-amber-400 outline-none" placeholder="600 000 000"/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Inicio</label>
                            <input type="date" value={recurringForm.start_date}
                                onChange={e => setRecurringForm(f => ({...f, start_date: e.target.value}))}
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-amber-400 outline-none"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Fin (opcional)</label>
                            <input type="date" value={recurringForm.end_date}
                                onChange={e => setRecurringForm(f => ({...f, end_date: e.target.value}))}
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-amber-400 outline-none"/>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Notas</label>
                        <input value={recurringForm.notes}
                            onChange={e => setRecurringForm(f => ({...f, notes: e.target.value}))}
                            className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-amber-400 outline-none" placeholder="Clase de iniciación, liga privada..."/>
                    </div>
                </div>
            </Modal>

            {/* VER SLOT RECURRENTE */}
            <Modal isOpen={!!selectedRecurring} onClose={() => setSelectedRecurring(null)} title="Slot Recurrente" size="sm"
                icon={<Repeat size={24}/>} iconColor="brand">
                {selectedRecurring && (
                    <div className="space-y-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 border-l-4 border-amber-400">
                            <div className="text-xs font-bold text-amber-700 uppercase mb-1">Recurrente · {DAY_NAMES_LONG[selectedRecurring.day_of_week]}s</div>
                            <div className="font-black text-slate-800">Pista {selectedRecurring.court_number} · {selectedRecurring.start_time}–{selectedRecurring.end_time}</div>
                            <div className="text-xs text-slate-500 mt-1">Desde {selectedRecurring.start_date}{selectedRecurring.end_date ? ` hasta ${selectedRecurring.end_date}` : ' (indefinido)'}</div>
                        </div>
                        <div className="space-y-2">
                            <InfoRow icon={<User size={14}/>} label="Jugador" value={selectedRecurring.player_name}/>
                            {selectedRecurring.player_phone && <InfoRow icon={<Phone size={14}/>} label="Teléfono" value={selectedRecurring.player_phone}/>}
                            {selectedRecurring.partner_name && <InfoRow icon={<User size={14}/>} label="Acompañante" value={selectedRecurring.partner_name}/>}
                            {selectedRecurring.notes && <InfoRow icon={<Clock size={14}/>} label="Notas" value={selectedRecurring.notes}/>}
                        </div>
                        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                            <button onClick={() => handleAddException(selectedRecurring.id, dateStr)}
                                className="flex items-center justify-center gap-2 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-bold text-sm hover:bg-amber-100">
                                <Ban size={16}/> Cancelar solo esta semana
                            </button>
                            <button onClick={() => handleDeleteRecurringSlot(selectedRecurring.id)}
                                className="flex items-center justify-center gap-2 py-2 text-rose-500 text-xs font-bold hover:text-rose-700 transition-colors">
                                <Trash2 size={14}/> Eliminar recurrencia permanentemente
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* CONFIGURAR PISTA */}
            <CourtEditModal
                isOpen={showCourtModal} court={editingCourt}
                onClose={() => { setShowCourtModal(false); setEditingCourt(null); }}
                onSave={handleSaveCourt} saving={saving}
            />

            {/* ELEGIR TIPO DE ACCIÓN AL PULSAR SLOT */}
            <Modal isOpen={!!slotChoiceData} onClose={() => setSlotChoiceData(null)} title="¿Qué quieres crear?" size="sm">
                {slotChoiceData && (
                    <div className="space-y-2">
                        <div className="bg-indigo-50 rounded-xl px-4 py-2 text-center text-sm font-bold text-indigo-700 mb-3">
                            Pista {slotChoiceData.courtNumber} · {slotChoiceData.startTime}
                        </div>
                        <button
                            onClick={() => {
                                setSelectedSlot({ courtNumber: slotChoiceData.courtNumber, startTime: slotChoiceData.startTime });
                                setCreateForm({ playerName: '', playerPhone: '', partnerName: '', notes: '' });
                                setSlotChoiceData(null);
                            }}
                            className="w-full flex items-center gap-3 p-4 bg-indigo-50 hover:bg-indigo-100 rounded-2xl transition-all border border-indigo-100"
                        >
                            <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center shrink-0">
                                <Calendar size={18} className="text-white" />
                            </div>
                            <div className="text-left">
                                <div className="font-black text-slate-800 text-sm">Reserva</div>
                                <div className="text-xs text-slate-400">Reserva de pista para un jugador</div>
                            </div>
                        </button>
                        <button
                            onClick={() => {
                                setOpenMatchSlot({ courtNumber: slotChoiceData.courtNumber, startTime: slotChoiceData.startTime });
                                setShowOpenMatchModal(true);
                                setSlotChoiceData(null);
                            }}
                            className="w-full flex items-center gap-3 p-4 bg-violet-50 hover:bg-violet-100 rounded-2xl transition-all border border-violet-100"
                        >
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: THEME.cta }}>
                                <Swords size={18} className="text-white" />
                            </div>
                            <div className="text-left">
                                <div className="font-black text-slate-800 text-sm">Partido abierto</div>
                                <div className="text-xs text-slate-400">Crea y comparte por WhatsApp</div>
                            </div>
                        </button>
                        <button
                            onClick={() => {
                                setRecurringForm(f => ({
                                    ...f,
                                    court_number: slotChoiceData.courtNumber,
                                    start_time: slotChoiceData.startTime,
                                    end_time: minsToTime(timeToMins(slotChoiceData.startTime) + selectedDuration),
                                    day_of_week: new Date(dateStr + 'T12:00:00').getDay(),
                                }));
                                setShowRecurringModal(true);
                                setSlotChoiceData(null);
                            }}
                            className="w-full flex items-center gap-3 p-4 bg-amber-50 hover:bg-amber-100 rounded-2xl transition-all border border-amber-100"
                        >
                            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center shrink-0">
                                <Repeat size={18} className="text-white" />
                            </div>
                            <div className="text-left">
                                <div className="font-black text-slate-800 text-sm">Slot recurrente</div>
                                <div className="text-xs text-slate-400">Se repite cada semana</div>
                            </div>
                        </button>
                        <button
                            onClick={() => {
                                setBlockSlotData({ courtNumber: slotChoiceData.courtNumber, startTime: slotChoiceData.startTime });
                                setShowBlockModal(true);
                                setSlotChoiceData(null);
                            }}
                            className="w-full flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all border border-slate-100"
                        >
                            <div className="w-9 h-9 bg-slate-600 rounded-xl flex items-center justify-center shrink-0">
                                <Lock size={18} className="text-white" />
                            </div>
                            <div className="text-left">
                                <div className="font-black text-slate-800 text-sm">Bloquear pista</div>
                                <div className="text-xs text-slate-400">Mantenimiento, torneo, uso privado</div>
                            </div>
                        </button>
                    </div>
                )}
            </Modal>

            {/* CREAR PARTIDO ABIERTO DESDE PISTA */}
            <Modal
                isOpen={showOpenMatchModal}
                onClose={() => { setShowOpenMatchModal(false); setOpenMatchSlot(null); }}
                title="Partido abierto"
                icon={<Swords size={22} />}
                iconColor="brand"
                size="sm"
                actions={[
                    { label: 'Cancelar', onClick: () => { setShowOpenMatchModal(false); setOpenMatchSlot(null); }, variant: 'secondary' },
                    { label: 'Crear y compartir', onClick: handleCreateOpenMatch, variant: 'primary', loading: saving },
                ]}
            >
                {openMatchSlot && (
                    <div className="space-y-4">
                        <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 flex items-center gap-3">
                            <Swords size={18} className="text-violet-600 shrink-0" />
                            <div>
                                <div className="text-xs font-bold text-violet-600 uppercase">
                                    Pista {openMatchSlot.courtNumber} · {openMatchSlot.startTime} · {selectedDuration} min
                                </div>
                                <div className="font-black text-slate-800 text-sm">
                                    {openMatchSlot.startTime} — {minsToTime(timeToMins(openMatchSlot.startTime) + selectedDuration)}
                                </div>
                            </div>
                        </div>
                        {/* Duración */}
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Duración</label>
                            <div className="flex gap-2">
                                {([60, 90] as const).map(m => (
                                    <button key={m} type="button" onClick={() => setSelectedDuration(m)}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${selectedDuration === m ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200'}`}
                                        style={selectedDuration === m ? { backgroundColor: THEME.cta } : {}}>
                                        {m} min
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Nivel */}
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                                <BarChart2 size={11} className="inline mr-1" />Nivel del partido
                            </label>
                            <select
                                value={openMatchLevel}
                                onChange={e => setOpenMatchLevel(e.target.value)}
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-violet-400 outline-none bg-white"
                            >
                                <option value="">Cualquier nivel (Abierto)</option>
                                {MATCH_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                        {/* Notas */}
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Notas (opcional)</label>
                            <input
                                value={openMatchNotes}
                                onChange={e => setOpenMatchNotes(e.target.value)}
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-violet-400 outline-none"
                                placeholder="Ej: Partido amistoso de tarde"
                            />
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-700 font-medium">
                            Al crear, se abrirá WhatsApp con todos los partidos abiertos del club para que puedas compartirlos de una vez.
                        </div>
                    </div>
                )}
            </Modal>
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

// ─── COLUMNA DE PISTA ─────────────────────────────────────────────────────────

interface CourtColumnProps {
    court: CourtConfig;
    dateStr: string;
    openTime: string;
    closeTime: string;
    gridHeight: number;
    timeLabels: string[];
    reservations: CourtReservation[];
    blocks: CourtBlock[];
    recurringSlots: RecurringSlot[];
    draggingId: string | null;
    onSlotClick: (startTime: string) => void;
    onSlotRightClick: (startTime: string) => void;
    onSlotRecurring: (startTime: string) => void;
    onReservationClick: (r: CourtReservation) => void;
    onBlockClick: (b: CourtBlock) => void;
    onRecurringClick: (rs: RecurringSlot) => void;
    onDragStart: (e: React.DragEvent, r: CourtReservation) => void;
    onDrop: (e: React.DragEvent, courtNumber: number, slotTime: string) => void;
}

const CourtColumn: React.FC<CourtColumnProps> = ({
    court, dateStr, openTime, closeTime, gridHeight,
    timeLabels, reservations, blocks, recurringSlots, draggingId,
    onSlotClick, onSlotRightClick, onSlotRecurring, onReservationClick,
    onBlockClick, onRecurringClick, onDragStart, onDrop,
}) => {
    const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

    const occupiedRanges = [
        ...reservations.filter(r => r.status !== 'rejected' && r.status !== 'cancelled')
            .map(r => ({ start: timeToMins(extractTime(r.start_at)), end: timeToMins(extractTime(r.end_at)) })),
        ...blocks.map(b => ({ start: timeToMins(extractTime(b.start_at)), end: timeToMins(extractTime(b.end_at)) })),
        ...recurringSlots.map(rs => ({ start: timeToMins(rs.start_time), end: timeToMins(rs.end_time) })),
    ];

    const isOccupied = (startMins: number, endMins: number) =>
        occupiedRanges.some(r => startMins < r.end && endMins > r.start);

    // Free slots every 30 min — duration chosen in modal
    const freeSlots: string[] = [];
    let t = timeToMins(openTime);
    const end = timeToMins(closeTime);
    while (t + 30 <= end) {
        const slotStart = minsToTime(t);
        if (!isOccupied(t, t + 30)) freeSlots.push(slotStart);
        t += 30;
    }

    return (
        <div className="flex-1 min-w-[140px] border-r border-slate-100 last:border-r-0 relative" style={{ height: gridHeight }}>
            {/* Grid lines */}
            {timeLabels.map((label, i) => (
                <div key={label} className="absolute w-full border-t border-slate-100"
                    style={{ top: i * GRID_ROW_MINS * PX_PER_MIN, height: GRID_ROW_MINS * PX_PER_MIN }}/>
            ))}

            {/* Free slots — 30 min rows, duration chosen in modal */}
            {freeSlots.map(startTime => {
                const top = (timeToMins(startTime) - timeToMins(openTime)) * PX_PER_MIN;
                const height = GRID_ROW_MINS * PX_PER_MIN - 2;
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
                        onContextMenu={e => { e.preventDefault(); onSlotRightClick(startTime); }}
                    >
                        {isHovered ? (
                            <div className="flex flex-col items-center gap-0.5 pointer-events-none">
                                <Plus size={12} className="text-indigo-400"/>
                                <span className="text-[9px] font-bold text-indigo-400">{startTime}</span>
                            </div>
                        ) : (
                            <span className="text-[9px] font-medium text-slate-300">{startTime}</span>
                        )}
                    </div>
                );
            })}

            {/* Reservas */}
            {reservations.filter(r => r.status !== 'rejected' && r.status !== 'cancelled').map(res => {
                const top = slotTop(res.start_at, openTime, dateStr);
                if (top < 0) return null;
                const h = slotHeight(res.start_at, res.end_at) - 2;
                const isMatch = res.notes?.startsWith('match:');
                const style = STATUS_STYLES[res.status];
                return (
                    <div key={res.id} draggable
                        onDragStart={e => onDragStart(e, res)} onDragEnd={() => {}}
                        onClick={() => onReservationClick(res)}
                        className={`absolute left-0.5 right-0.5 rounded-lg border-l-4 px-2 py-1 cursor-pointer hover:brightness-95 transition-all overflow-hidden ${isMatch ? 'bg-violet-50 border-violet-500' : `${style.bg} ${style.border}`} ${draggingId === res.id ? 'opacity-40' : ''}`}
                        style={{ top: top + 1, height: h }}
                    >
                        {isMatch ? (
                            <>
                                <div className="flex items-center gap-1 text-[9px] font-black uppercase text-violet-700">
                                    <Swords size={8}/> Partido
                                </div>
                                <div className="text-[9px] font-bold text-violet-500 opacity-80">{extractTime(res.start_at)}–{extractTime(res.end_at)}</div>
                            </>
                        ) : (
                            <>
                                <div className={`text-[9px] font-black uppercase ${style.text}`}>{style.label}</div>
                                <div className="text-xs font-bold text-slate-800 truncate leading-tight">{res.player_name}</div>
                                {res.partner_name && <div className="text-[9px] text-slate-500 truncate">+ {res.partner_name}</div>}
                                <div className={`text-[9px] font-bold ${style.text} opacity-70`}>{extractTime(res.start_at)}–{extractTime(res.end_at)}</div>
                            </>
                        )}
                    </div>
                );
            })}

            {/* Slots recurrentes */}
            {recurringSlots.map(rs => {
                const top = (timeToMins(rs.start_time) - timeToMins(openTime)) * PX_PER_MIN;
                const h = (timeToMins(rs.end_time) - timeToMins(rs.start_time)) * PX_PER_MIN - 2;
                return (
                    <div key={rs.id} onClick={() => onRecurringClick(rs)}
                        className="absolute left-0.5 right-0.5 rounded-lg border-l-4 border-amber-500 bg-amber-100 px-2 py-1 cursor-pointer hover:brightness-95 transition-all overflow-hidden"
                        style={{ top: top + 1, height: h }}>
                        <div className="flex items-center gap-1 text-[9px] font-black uppercase text-amber-700">
                            <Repeat size={8}/> Recurrente
                        </div>
                        <div className="text-xs font-bold text-slate-800 truncate leading-tight">{rs.player_name}</div>
                        <div className="text-[9px] font-bold text-amber-600 opacity-80">{rs.start_time}–{rs.end_time}</div>
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
                    <div key={block.id} onClick={() => onBlockClick(block)}
                        className={`absolute left-0.5 right-0.5 rounded-lg px-2 py-1 cursor-pointer hover:brightness-95 flex flex-col justify-center overflow-hidden ${bStyle.bg}`}
                        style={{ top: top + 1, height: h - 1 }}>
                        <div className={`flex items-center gap-1 ${bStyle.text}`}>
                            {bStyle.icon}
                            <span className="text-[9px] font-black uppercase">{bStyle.label}</span>
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

// ─── MODAL EDICIÓN DE PISTA ───────────────────────────────────────────────────

const DAY_NAMES_LOCAL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const CourtEditModal: React.FC<{
    isOpen: boolean; court: CourtConfig | null;
    onClose: () => void; onSave: (c: Partial<CourtConfig>) => void; saving: boolean;
}> = ({ isOpen, court, onClose, onSave, saving }) => {
    const [form, setForm] = useState({ court_name: 'Pista', slot_minutes: 90 as 60 | 90, open_time: '08:00', close_time: '22:00', active_days: [0,1,2,3,4,5,6] });

    useEffect(() => {
        if (court) setForm({ court_name: court.court_name, slot_minutes: court.slot_minutes, open_time: court.open_time, close_time: court.close_time, active_days: court.active_days });
        else setForm({ court_name: 'Pista', slot_minutes: 90, open_time: '08:00', close_time: '22:00', active_days: [0,1,2,3,4,5,6] });
    }, [court, isOpen]);

    const toggleDay = (day: number) =>
        setForm(f => ({ ...f, active_days: f.active_days.includes(day) ? f.active_days.filter(d => d !== day) : [...f.active_days, day].sort() }));

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={court ? 'Editar Pista' : 'Nueva Pista'} size="sm"
            actions={[
                { label: 'Cancelar', onClick: onClose, variant: 'secondary' },
                { label: court ? 'Guardar' : 'Añadir', onClick: () => onSave({ ...form, id: court?.id }), variant: 'primary', loading: saving },
            ]}>
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nombre</label>
                    <input value={form.court_name} onChange={e => setForm(f => ({...f, court_name: e.target.value}))}
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-indigo-400 outline-none" placeholder="Ej: Pista Central"/>
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
                        {DAY_NAMES_LOCAL.map((name, i) => (
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
