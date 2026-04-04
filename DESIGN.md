# ParaPádel — Documentación de Diseño de Producto

> Versión 2.0 · Actualizado Abril 2026

---

## 1. Visión del Producto

**ParaPádel** es una plataforma SaaS multi-club para gestión de torneos y ligas de pádel. La visión a medio plazo es convertirse en el **Playtomic de Murcia**: una plataforma donde los clubs gestionan toda su actividad competitiva y los jugadores tienen su perfil, historial y ranking centralizado.

### Propuesta de Valor por Rol

| Rol | Propuesta Principal |
|---|---|
| **Club (Admin)** | Crear y gestionar torneos/ligas en minutos, sin papel ni Excel |
| **Jugador** | Ver mis torneos, mi ELO, mis resultados y seguir el cuadro en tiempo real |
| **SuperAdmin** | Gestión centralizada de todos los clubs desde un panel único |

---

## 2. Arquitectura de la Aplicación

### 2.1 Rutas y Secciones

```
/                     Landing (público)
/auth                 Login / Registro
/onboarding           Configuración inicial del club (solo admin nuevo)
/pending              Cuenta en espera de verificación

── ADMIN (Club) ────────────────────────────────────────────
/dashboard            Panel de Control General (hub de módulos)
/minis                Listado de Mini Torneos
/setup                Crear nuevo Mini Torneo
/lite/setup           Crear torneo modo Lite
/tournament/manage    Gestión de torneo activo (setup/registro/checkin)
/tournament/registration  Inscripción de parejas
/tournament/checkin   Check-in y confirmación
/tournament/active    Torneo en directo (partidos + resultados)
/tournament/results   Resultados y podio final

/league               Dashboard de Ligas
/league/setup         Crear/configurar liga
/league/groups/:id    Gestión de grupos de categoría
/league/active        Liga en juego

/players              Gestión de jugadores del club
/players/:id          Perfil individual de jugador
/history              Historial de torneos pasados
/club                 Perfil y configuración del club
/help                 Ayuda y documentación
/notifications        Notificaciones
/notifications/settings  Configuración de notificaciones

── JUGADOR ─────────────────────────────────────────────────
/p/dashboard          Panel principal del jugador
/p/explore            Explorar torneos disponibles
/p/tournaments        Mis inscripciones
/p/profile            Mi perfil y estadísticas

── SUPERADMIN ──────────────────────────────────────────────
/superadmin           Panel global de clubs

── PÚBLICO ─────────────────────────────────────────────────
/join/:clubId         Página de inscripción pública a un torneo
/reset-password       Cambio de contraseña
```

### 2.2 Roles de Usuario

```
superadmin  →  Panel global /superadmin
admin       →  Dashboard del club (todos los módulos)
player      →  App jugador /p/*
pending     →  Pantalla de espera /pending
```

El rol se determina desde Supabase. No hay hardcoding de roles en el frontend.

---

## 3. Flujos de Usuario

### 3.1 Flujo Admin — Primera Vez

```
Landing → Auth (registro/login) → Onboarding (nombre club + nº pistas)
→ Tour explicativo (4 slides) → Dashboard
```

### 3.2 Flujo Admin — Crear Mini Torneo

```
Dashboard → Minis → Crear Nuevo (/setup)
  → Elegir formato (8/10/12/16 parejas)
  → Configurar categoría, precio, nombre
  → /tournament/manage (vista setup)
    → Añadir jugadores al registro
    → /tournament/registration (inscripción de parejas)
    → /tournament/checkin (confirmación de asistencia)
    → Iniciar torneo → /tournament/active
      → Asignar pistas · Introducir resultados · Avanzar rondas
    → Finalizar → /tournament/results (podio)
```

### 3.3 Flujo Admin — Crear Liga

```
Dashboard → Liga → Nueva Liga (/league/setup)
  → Configurar categoría, fechas, grupos
  → /league (dashboard de liga)
    → /league/groups/:id (gestión de grupos)
    → /league/active (jornadas y resultados)
```

### 3.4 Flujo Jugador

```
Landing → Auth → /p/dashboard
  → Ver torneos activos del club
  → /p/explore → Explorar torneos públicos
  → /p/tournaments → Mis inscripciones
  → /p/profile → Mi ELO, historial, estadísticas
```

### 3.5 Flujo Inscripción Pública (sin login)

```
URL compartida /join/:clubId
  → Buscar torneo del club
  → Inscribir pareja (nombre + email)
  → Confirmación con link de seguimiento
```

---

## 4. Sistema de Diseño

### 4.1 Paleta de Colores

#### Colores Primarios

| Token | Valor Hex | Uso |
|---|---|---|
| `THEME.cta` | `#575AF9` | CTA principal, botones de acción, focus states |
| `COLORS.primary` | `#2B2DBF` | Mini 10, fondos de torneo |
| `COLORS.primaryDark` | `#14169C` | Mini 12 |
| `COLORS.primaryVeryDark` | `#171852` | Mini 16 |
| `COLORS.mini8Tone` | `#3F42E0` | Mini 8 |
| `COLORS.secondary` | `#EEFF00` | Accent amarillo (uso limitado) |

#### Colores Semánticos (Tailwind)

| Propósito | Clase Tailwind | Hex aproximado |
|---|---|---|
| Éxito / Activo | `emerald-500/600` | #10B981 |
| Peligro / Error | `rose-500/600` | #F43F5E |
| Advertencia | `amber-500/600` | #F59E0B |
| Info / Liga | `indigo-500/600` | #6366F1 |
| Neutro | `slate-900` → `slate-50` | #0F172A → #F8FAFC |

#### Fondos por Módulo

| Módulo | Fondo | Color de texto |
|---|---|---|
| Landing | `slate-900` | blanco |
| Onboarding | `slate-50` | oscuro |
| Admin (general) | `slate-50` | oscuro |
| Mini Torneo (activo) | degradado oscuro `slate-900` | blanco |
| Liga | `indigo-500/600` | blanco |
| App Jugador | `slate-50` con frame `slate-900` | mixto |
| SuperAdmin | `slate-50` | oscuro |

### 4.2 Tipografía

**Fuente:** DM Sans (Google Fonts)

| Nivel | Clase Tailwind | Uso |
|---|---|---|
| Display | `text-6xl font-black` | Logo / Hero |
| H1 | `text-2xl–3xl font-black` | Títulos de sección |
| H2 | `text-xl font-black` | Cabeceras de tarjeta |
| H3 | `text-lg font-bold` | Subtítulos |
| Body | `text-sm font-medium` | Texto de contenido |
| Caption | `text-xs font-bold` | Etiquetas, badges |
| Micro | `text-[10px] font-bold uppercase tracking-wider` | Labels de input, separadores |

### 4.3 Espaciado y Border Radius

| Token | Valor | Clase Tailwind |
|---|---|---|
| radius-sm | 8px | `rounded-lg` |
| radius-md | 12px | `rounded-xl` |
| radius-lg | 16px | `rounded-2xl` |
| radius-xl | 24px | `rounded-3xl` |
| radius-2xl | 40px | `rounded-[2.5rem]` |

**Padding de contenedor:** `p-4` a `p-8` dependiendo del componente.
**Gap de grid:** `gap-4` a `gap-8`.
**Margen de sección:** `space-y-6` a `space-y-8`.

### 4.4 Sombras

| Uso | Clase |
|---|---|
| Tarjeta normal | `shadow-sm` |
| Tarjeta elevada / modal | `shadow-2xl` |
| Botón CTA | `shadow-lg shadow-blue-900/50` |

### 4.5 Componentes Reutilizables

Todos los componentes se importan desde `./components` (barrel export).

#### `<Modal>`
```tsx
<Modal
  isOpen={bool}
  onClose={fn}
  title="Título"
  body="Texto opcional"
  icon={<Lucide size={24}/>}
  iconColor="danger" // 'brand' | 'success' | 'danger' | 'warning'
  size="md" // 'sm' | 'md' | 'lg'
  actions={[
    { label: 'Cancelar', onClick: fn, variant: 'secondary' },
    { label: 'Confirmar', onClick: fn, variant: 'primary' | 'danger' },
  ]}
>
  {/* contenido opcional adicional */}
</Modal>
```

#### `<StatCard>`
```tsx
<StatCard
  value={24}
  label="Jugadores"
  icon={<Users size={20}/>}
  delta="↑ 4 esta semana"
  deltaType="up" // 'up' | 'down' | 'neutral'
  valueColor="success" // 'brand' | 'success' | 'danger' | 'warning' | undefined
/>
```

#### `<EmptyState>`
```tsx
<EmptyState
  icon={<Trophy size={28}/>}
  title="No hay torneos"
  body="Crea un torneo para empezar."
  action={{ label: 'CREAR TORNEO', onClick: fn }}
  dark // prop opcional para fondos oscuros
/>
```

#### `<Badge>`
```tsx
<Badge variant="success" dot>Activo</Badge>
// variants: 'success' | 'danger' | 'warning' | 'info' | 'neutral'
```

#### `<Button>`

**Sistema de variantes:**

| Variante | Fondo | Texto | Cuándo usarlo |
|---|---|---|---|
| `primary` | `#575AF9` | blanco | CTA principal de la acción clave |
| `secondary` | `slate-100` | `slate-700` | Acción secundaria / cancelar |
| `danger` | `rose-600` | blanco | Eliminar, acción destructiva |
| `ghost` | transparente | `#575AF9` | Acción alternativa, sin relleno |
| `dark` | `slate-900` | blanco | Sobre fondos claros (modales) |
| `white` | blanco | `slate-900` | Sobre fondos oscuros |

**Sistema de tamaños:**

| Tamaño | Padding | Texto | Alto mínimo | Cuándo usarlo |
|---|---|---|---|---|
| `sm` | `px-4 py-2.5` | `text-sm` | 40px | Acciones inline, filtros |
| `md` | `px-6 py-3` | `text-sm` | 44px | Botón estándar (default) |
| `lg` | `px-8 py-4` | `text-base` | 52px | CTA principal de página |

**Regla de shapes:**
- Botones normales: `rounded-xl` (12px)
- Botones pill/filtros: `rounded-full`
- Botones icon-only: `rounded-xl` mínimo 44×44px

**Uso:**
```tsx
// CTA principal
<Button variant="primary" size="lg" fullWidth icon={<Play/>}>
  PUBLICAR TORNEO
</Button>

// Acción estándar
<Button variant="primary" icon={<Plus/>}>CREAR</Button>

// Destructivo
<Button variant="danger" size="sm">Eliminar</Button>

// Con loading
<Button variant="primary" fullWidth loading={saving}>Guardar</Button>
```

**NUNCA usar:**
- `bg-slate-800` para botones de acción (reservado para fondos de cards en dark mode)
- `text-xs` en botones — mínimo `text-sm` para legibilidad
- `py-5` o superior — el CTA más grande es `py-4` (`size="lg"`)
- Botones sin al menos 36px de alto

#### `useToast()`
```tsx
const { success, error, warning } = useToast();
success('Operación completada');
error('Ha ocurrido un error');
```

---

## 5. Inventario de Pantallas

### 5.1 Públicas / Auth

| Pantalla | Archivo | Notas de Diseño |
|---|---|---|
| Landing | `pages/Landing.tsx` | Dark, logo hero, CTA único. Botones Dev Mode en local |
| Login / Registro | `pages/Auth.tsx` | Formulario email+password, tabs login/registro |
| Reset Password | `pages/ResetPassword.tsx` | Formulario nueva contraseña |
| Inscripción Pública | `pages/public/JoinTournament.tsx` | Mobile-first, sin navbar |
| Cuenta Pendiente | `pages/PendingVerification.tsx` | Estado de espera con icono |

### 5.2 Onboarding (Admin)

| Pantalla | Archivo | Notas de Diseño |
|---|---|---|
| Configura tu Club | `pages/Onboarding.tsx` (fase 'config') | Form nombre + nº pistas |
| Tour de introducción | `pages/Onboarding.tsx` (fase 'tour') | 4 slides con paginación y progreso |

### 5.3 Admin — Hub

| Pantalla | Archivo | Notas de Diseño |
|---|---|---|
| Panel de Control | `pages/GeneralDashboard.tsx` | Cards de módulo (Minis, Liga, Lite), stats globales |
| Perfil del Club | `pages/ClubProfile.tsx` | Editar datos del club |
| Gestión de Jugadores | `pages/PlayerManager.tsx` | Lista + búsqueda + añadir |
| Perfil de Jugador | `pages/PlayerProfile.tsx` | Stats individuales, historial ELO |
| Historial | `pages/History.tsx` | Torneos pasados archivados |
| Notificaciones | `pages/Notifications.tsx` | Lista de alertas del sistema |
| Config Notificaciones | `pages/NotificationSettings.tsx` | Toggles por tipo |
| Ayuda | `pages/Help.tsx` | FAQ y guía de uso |

### 5.4 Admin — Mini Torneos

| Pantalla | Archivo | Descripción |
|---|---|---|
| Listado Minis | `pages/MiniDashboard.tsx` | Cards de torneos activos/setup/terminados |
| Crear Torneo | `pages/TournamentSetup.tsx` | Wizard: formato → config → fecha |
| Gestionar Torneo | `pages/TournamentManager.tsx` | Vista principal de gestión (tabs) |
| Inscripción | `pages/Registration.tsx` | Añadir parejas, ver lista |
| Check-in | `pages/CheckIn.tsx` | Confirmar asistencia pareja a pareja |
| Torneo Activo | `pages/ActiveTournament.tsx` | Pistas + resultados en directo |
| Resultados | `pages/Results.tsx` | Podio + clasificación final |
| Lite Setup | `pages/lite/LiteSetup.tsx` | Torneo simplificado |

### 5.5 Admin — Liga

| Pantalla | Archivo | Descripción |
|---|---|---|
| Dashboard Liga | `pages/LeagueDashboard.tsx` | Estado general de la liga activa |
| Configurar Liga | `pages/LeagueSetup.tsx` | Categorías, fechas, estructura |
| Grupos | `pages/LeagueGroups.tsx` | Tabla de grupo, resultados, jornadas |
| Liga Activa | `pages/LeagueActive.tsx` | Jornada actual + gestión de partidos |
| Promo Liga | `pages/LeaguePromo.tsx` | Landing de venta del módulo liga |

### 5.6 App Jugador (`/p/*`)

| Pantalla | Archivo | Descripción |
|---|---|---|
| Dashboard Jugador | `pages/player/PlayerDashboard.tsx` | Mi club, torneos activos, ELO |
| Explorar | `pages/player/TournamentBrowser.tsx` | Buscar torneos de otros clubs |
| Mis Torneos | `pages/player/PlayerTournaments.tsx` | Inscripciones activas y pasadas |
| Mi Perfil | `pages/player/PlayerProfile.tsx` | ELO, estadísticas, historial |

### 5.7 SuperAdmin

| Pantalla | Archivo | Descripción |
|---|---|---|
| Panel Global | `pages/SuperAdmin.tsx` | Stats globales + lista de clubs |
| Tarjeta Club | `pages/superadmin/ClubCard.tsx` | Resumen + toggles de módulos |
| Inspector Club | `pages/superadmin/ClubInspectorModal.tsx` | Estadísticas detalladas del club |
| Crear Club | `pages/superadmin/CreateClubModal.tsx` | Quick invite + vincular usuario |
| Reparar Acceso | `pages/superadmin/RepairModal.tsx` | Reenviar email de acceso |

---

## 6. Patrones de Interacción

### 6.1 Layouts

**Layout Admin** (`components/Layout.tsx`)
- Desktop: sidebar fijo lateral izquierdo
- Mobile: bottom dock (barra de navegación inferior)
- Contenido: área principal con padding `p-4 md:p-8`

**Layout Jugador** (`components/PlayerLayout.tsx`)
- Frame de móvil simulado en desktop (`max-w-sm` centrado)
- Bottom navigation con 4 ítems
- Fondo oscuro (`slate-900`) alrededor del frame en desktop

### 6.2 Modales

Todos los modales usan el componente `<Modal>` centralizado excepto:
- `TournamentManager.tsx` — ManualGroupingWizard (layout de dos paneles `max-w-4xl`)
- `PlayerTournaments.tsx` — bottom-sheet móvil (`items-end h-[90vh]`)

Ambos son excepciones justificadas por su layout especial.

### 6.3 Feedback al Usuario

- **Éxito/Error:** siempre `useToast()`, nunca `alert()`
- **Carga:** `animate-pulse` en skeletons, `animate-spin` en RefreshCw
- **Estados vacíos:** siempre `<EmptyState>` con acción CTA cuando aplica
- **Confirmación destructiva:** siempre modal con botón `variant="danger"` explícito

### 6.4 Animaciones

| Clase | Uso |
|---|---|
| `animate-fade-in` | Aparición de contenido nuevo |
| `animate-scale-in` | Entrada de modales |
| `animate-slide-left` | Transición entre fases |
| `animate-pulse` | Skeletons de carga |
| `animate-spin` | Iconos de carga |

### 6.5 Formato de Torneos

| Formato | Color de fondo | Pistas necesarias |
|---|---|---|
| Mini 8 | `#3F42E0` | Flexible |
| Mini 10 | `#2B2DBF` | Flexible |
| Mini 12 | `#14169C` | Flexible |
| Mini 16 | `#171852` | 8+ para sin descansos |

---

## 7. Responsive Design

### 7.1 Breakpoints (Tailwind por defecto)

| Breakpoint | Ancho | Uso Principal |
|---|---|---|
| Base (mobile) | < 768px | App jugador, vistas simplificadas |
| `md` | ≥ 768px | Layouts de 2 columnas |
| `lg` | ≥ 1024px | Sidebar visible, 3 columnas |

### 7.2 Estrategia por Módulo

- **Admin:** desktop-first, sidebar en md+, bottom dock en mobile
- **App Jugador:** mobile-first, frame simulado en desktop
- **SuperAdmin:** desktop-first, grid 2 columnas en md+
- **Onboarding / Auth:** centrado, `max-w-md` en cualquier pantalla

### 7.3 Grid Patterns

```
1 columna → 2 columnas:  grid-cols-1 md:grid-cols-2
2 columnas → 4 columnas: grid-cols-2 md:grid-cols-4
3 columnas siempre:      grid-cols-3 (stats compactos en cards)
```

---

## 8. Base de Datos (Resumen)

### Tablas Principales

| Tabla | Descripción |
|---|---|
| `clubs` | Clubs registrados. `owner_id` = UUID del admin |
| `players` | Jugadores del club. `user_id` = UUID del admin/club |
| `tournaments` | Mini torneos. `user_id` = club owner |
| `leagues` | Ligas. `club_id` = club owner |
| `superadmins` | Tabla de roles superadmin |

### Campos de Feature Flags en `clubs`

| Campo | Tipo | Default | Descripción |
|---|---|---|---|
| `is_active` | bool | true | El club tiene acceso activo |
| `minis_full_enabled` | bool | true | Módulo Mini completo |
| `minis_lite_enabled` | bool | false | Módulo Mini Lite |
| `league_enabled` | bool | false | Módulo de Ligas |
| `show_players` | bool | true | Visibilidad menú Jugadores |
| `show_history` | bool | true | Visibilidad menú Historial |

### Sistema ELO

- Archivo: `utils/Elo.ts` — **NO modificar sin tests**
- `global_rating`: ELO global del jugador
- `category_ratings`: ELO por categoría (Record<string, number>)
- `manual_rating`: override manual del admin

---

## 9. Variables de Entorno

```bash
VITE_SUPABASE_URL=          # URL del proyecto Supabase
VITE_SUPABASE_ANON_KEY=     # Clave anon pública
VITE_HCAPTCHA_SITE_TOKEN=   # Token hCaptcha (opcional, para prod)
```

En desarrollo sin hCaptcha, el captcha se omite automáticamente (la variable está vacía).

---

## 10. Deuda de Diseño Conocida

### Alta Prioridad

- [ ] **Contraste en fondos oscuros de torneo activo** — algunos textos `slate-400` sobre `slate-800` pueden no pasar WCAG AA
- [ ] **Responsive de TournamentManager** — tabla de resultados en mobile requiere scroll horizontal
- [ ] **Bottom sheet de PlayerTournaments** — altura `h-[90vh]` puede cortarse en móviles con notch

### Media Prioridad

- [ ] **StatCards en MiniDashboard y LeagueDashboard** — algunas stats inline no usan el componente `<StatCard>` todavía
- [ ] **Auth page** — diseño básico, no adaptado al sistema de diseño visual del resto de la app
- [ ] **Help page** — contenido desactualizado, sin screenshots

### Baja Prioridad

- [ ] **Loading states** — algunos componentes no muestran skeleton durante carga
- [ ] **Animaciones de transición de ruta** — no hay transición entre páginas
- [ ] **Dark mode** — no implementado (no es prioritario)

---

## 11. Próximos Pasos (Design Backlog)

1. **Auditoría visual completa** — recorrer todas las pantallas con screenshots y aplicar fixes de contraste, consistencia y modernización
2. **Sistema de iconografía** — revisar mezcla de tamaños de iconos Lucide (14/16/18/20/24/28/32/40/48)
3. **Micro-copy** — revisar todos los textos de empty states, tooltips y mensajes de error
4. **Componente Skeleton** — crear `<Skeleton>` reutilizable en lugar de `animate-pulse` inline
5. **Design tokens en CSS vars** — externalizar colores del `theme.ts` a variables CSS para facilitar theming futuro

---

*Documento generado automáticamente a partir del código fuente. Actualizar manualmente cuando cambien patrones estructurales.*
