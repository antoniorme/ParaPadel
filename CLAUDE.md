# ParaPádel — Contexto para Claude Code

## Qué es este proyecto

**ParaPádel** es una aplicación de gestión de torneos y ligas de pádel. El objetivo es convertirse en el Playtomic de Murcia — una plataforma multi-club donde los clubs gestionan torneos y los jugadores se inscriben y siguen su progreso.

**Stack:** React 18 + Vite + TypeScript + Tailwind CSS (SPA, no Next.js)  
**Base de datos:** Supabase (PostgreSQL + Auth + RLS)  
**Despliegue:** Vercel (producción) + Vercel Preview (staging)  
**Repo:** GitHub

---

## Estructura del proyecto

```
/
├── App.tsx                  # Enrutador principal, providers
├── components/              # Componentes reutilizables
│   ├── index.ts             # Barrel export — importar desde aquí siempre
│   ├── Modal.tsx            # Modal reutilizable (sustituye 46 inline)
│   ├── Toast.tsx            # Sistema de notificaciones (ToastProvider + useToast)
│   ├── StatCard.tsx         # Tarjeta KPI reutilizable
│   ├── EmptyState.tsx       # Estado vacío reutilizable
│   ├── Badge.tsx            # Badge de estado/categoría
│   ├── Button.tsx           # Botón con variantes
│   ├── Layout.tsx           # Layout admin (sidebar + bottom dock)
│   ├── PlayerLayout.tsx     # Layout jugador (mobile frame)
│   ├── LevelProgressBar.tsx # Barra de progreso ELO
│   └── PlayerSelector.tsx   # Selector de jugador con búsqueda
├── pages/                   # Páginas (una por ruta)
│   ├── player/              # App del jugador (/p/*)
│   ├── public/              # Páginas públicas
│   └── lite/                # Modo lite
├── store/                   # Contextos de estado global
│   ├── AuthContext.tsx      # Autenticación y roles
│   ├── TournamentContext.tsx # Estado del torneo activo (802 líneas — refactorizar)
│   ├── LeagueContext.tsx    # Estado de liga
│   ├── HistoryContext.tsx   # Historial y datos del club
│   ├── NotificationContext.tsx
│   └── TimerContext.tsx
├── utils/
│   ├── Elo.ts               # Lógica ELO — NO tocar sin tests
│   ├── TournamentLogic.ts   # Re-exporta logic_helpers y logic_rounds
│   ├── logic_helpers.ts     # Helpers de torneo
│   ├── logic_rounds.ts      # Generación de rondas
│   └── theme.ts             # Tokens de color (THEME, COLORS, getFormatColor)
├── types.ts                 # Todos los tipos TypeScript
├── lib/supabase.ts          # Cliente Supabase
└── supabase/migrations/     # Migraciones SQL versionadas
```

---

## Roles de usuario

| Rol | Acceso |
|---|---|
| `superadmin` | Panel global `/superadmin` — gestión de todos los clubs |
| `admin` | Dashboard del club — gestiona torneos, jugadores, liga |
| `player` | App jugador `/p/*` — ve torneos, se inscribe, sigue su ELO |
| `pending` | En espera de verificación |

El rol se determina **siempre desde Supabase** (tabla `superadmins`, `clubs`, `players`). Nunca hardcodeado.

---

## Módulos de la app

### Mini Torneos (ruta `/minis`, `/tournament/*`)
- Formatos: 8, 10, 12, 16 parejas
- Flujo: Setup → Registro → Check-in → Activo → Resultados
- Color de fondo: oscuro (slate-900) con degradado azul/morado
- Cada formato tiene su color: `getFormatColor(format)` de `utils/theme.ts`

### Ligas (ruta `/league/*`)
- Grupos + Playoffs
- Fondo: indigo-500
- Estado en `LeagueContext.tsx`

### App Jugador (ruta `/p/*`)
- Mobile-first, frame de móvil en desktop
- Layout propio: `PlayerLayout.tsx`

### Super Admin (ruta `/superadmin`)
- Gestión global de clubs y usuarios
- Fichero grande (856 líneas) — pendiente de dividir

---

## Sistema de diseño

**Color primario (CTA):** `#575AF9` — usar `THEME.cta` o clase `text-[#575AF9]`  
**Accent:** `#EEFF00`  
**Tipografía:** DM Sans (Google Fonts)  
**Border radius:** sm=8px, md=12px, lg=16px, xl=24px  

Ver design system completo en `parapadel-design-system.html`

### Componentes disponibles — USAR SIEMPRE en lugar de inline
```tsx
import { Modal, Toast, StatCard, EmptyState, Badge, Button } from './components';

// Modal — NO escribir fixed inset-0 inline nunca más
<Modal isOpen={show} onClose={() => setShow(false)} title="¿Eliminar?" 
  iconColor="danger" icon={<Trash2 />}
  actions={[
    { label: 'Cancelar', onClick: () => setShow(false), variant: 'secondary' },
    { label: 'Eliminar', onClick: handleDelete, variant: 'danger' },
  ]} />

// Toast — feedback al usuario
const { success, error } = useToast();
success('Pareja inscrita correctamente');
error('Error al guardar resultado');

// StatCard
<StatCard value={24} label="Jugadores" delta="↑ 4 esta semana" deltaType="up" />

// EmptyState
<EmptyState icon={<Users size={28}/>} title="Sin jugadores" body="Añade jugadores para empezar." />

// Badge
<Badge variant="success" dot>Activo</Badge>

// Button
<Button variant="primary" fullWidth loading={saving}>Guardar</Button>
```

---

## Comandos importantes

```bash
npm run dev      # Desarrollo local en localhost:3000
npm run build    # Build de producción (elimina console.logs con terser)
npm run preview  # Preview del build
npm run lint     # Linter TypeScript
```

---

## Variables de entorno

Copiar `.env.example` como `.env.local` y rellenar:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

---

## Sistema de ramas

```
main      → producción (Vercel auto-deploy)
develop   → staging (Vercel Preview auto-deploy)
feature/* → desarrollo de nuevas funcionalidades
```

**Flujo de trabajo:**
1. `git checkout develop`
2. `git checkout -b feature/nombre-feature`
3. Desarrollar y probar en local
4. Push → PR hacia `develop`
5. Revisar en staging
6. Merge `develop` → `main` para producción

---

## Deuda técnica pendiente (por orden de prioridad)

1. **TournamentContext.tsx** (802 líneas) — extraer llamadas Supabase a `useTournamentDB.ts`
2. **SuperAdmin.tsx** (856 líneas) — dividir en subcomponentes
3. Migrar modales inline restantes a `<Modal>`
4. Migrar stat cards inline a `<StatCard>`
5. Migrar empty states inline a `<EmptyState>`
6. Añadir tests con Vitest para `utils/Elo.ts`
7. Configurar Supabase staging (proyecto separado con datos ficticios)

---

## Convenciones de código

- **Imports:** siempre desde `./components` (barrel), nunca rutas directas de componentes individuales
- **Colores:** usar `THEME.cta` para el color primario, nunca strings hex directos en JSX
- **Tipos:** todos en `types.ts` — no definir interfaces locales en páginas si son reutilizables
- **Modales:** siempre `<Modal>` — nunca `fixed inset-0` inline
- **Feedback:** siempre `useToast()` — nunca `alert()` ni mensajes de error silenciosos
- **Console.log:** prohibido en código de producción (terser los elimina, pero no los escribas)
- **@ts-ignore:** prohibido — solucionar el tipo correctamente
