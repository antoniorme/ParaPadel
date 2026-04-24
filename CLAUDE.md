# ParaPádel — Contexto para Claude Code

---

## KERNEL — Protocolo de proceso antes de responder

Antes de responder cualquier petición del usuario, aplicar este filtro en orden:

| Letra | Principio | Acción |
|---|---|---|
| **K** — Keep it simple | ¿El objetivo es claro y único? | Si no, pedir una sola cosa concreta |
| **E** — Easy to verify | ¿Hay criterio de éxito verificable? | Si no, definir qué significa "hecho" |
| **R** — Reproducible | ¿Hay referencias vagas ("moderno", "mejor práctica")? | Traducir a requisitos concretos |
| **N** — Narrow scope | ¿Es una sola tarea? | Si son varias, separar y priorizar |
| **E** — Explicit constraints | ¿Qué NO hay que hacer? | Identificar límites antes de empezar |
| **L** — Logical structure | ¿Tengo: contexto + tarea + restricciones + formato? | Si falta algo, preguntar antes de ejecutar |

**Regla:** Si la petición pasa el filtro → ejecutar directamente.
Si falla en algún punto → reformular en voz alta con el usuario antes de trabajar.
No escribir código hasta tener claridad en K, N y E como mínimo.

**Formato de reformulación cuando hay dudas:**
```
🔍 KERNEL check:
- Objetivo: [lo que entiendo que quieres]
- Éxito = [criterio concreto]
- Fuera de scope: [lo que NO haré]
¿Es correcto? → entonces empiezo
```

---

## Qué es este proyecto

**ParaPádel** es una aplicación de gestión de torneos y ligas de pádel. El objetivo es convertirse en el Playtomic de Murcia — una plataforma multi-club donde los clubs gestionan torneos y los jugadores se inscriben y siguen su progreso.

**Stack:** React 18 + Vite + TypeScript + Tailwind CSS (SPA, no Next.js)  
**Base de datos:** Supabase (PostgreSQL + Auth + RLS)  
**Despliegue:** Vercel (producción) + Vercel Preview (staging)
**Repo:** GitHub

**URLs importantes:**
- Producción: `https://parapadel.vercel.app`
- Staging: `https://para-padel-git-develop-antonios-projects-bf8073b2.vercel.app`
- Supabase producción: `wvpxtyzhphjgnbivwtvj`
- Supabase staging: `noqzurojggkhnbicchkr`

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

### Partidos Abiertos (ruta `/partidos`)
- **Flujo core:** el club crea un partido SIN jugadores → lo comparte por WhatsApp → los jugadores se unen por enlace público `/m/:shareToken`
- **Fecha y hora son obligatorias** al crear — sin ellas no se puede reservar pista ni calcular el slot
- **NUNCA validar que haya jugadores al crear** — un partido vacío (`status: 'open'`) es el caso normal
- Los jugadores se añaden después via `match_participants` (joined_via: 'link' o 'manual')
- ELO de club (`club_rating`) se procesa al guardar resultado
- Módulo independiente: `pages/MatchManager.tsx` + tablas `free_matches`, `match_participants`, `match_results`

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

### Regla de componentes — SIEMPRE reutilizar, nunca duplicar
Si existe un componente para algo, **usarlo**. No reinventar inline.
Antes de escribir JSX para un selector de jugadores, un modal, un estado vacío, etc. → revisar `components/index.ts`.
Si una pieza de UI se usa en más de un lugar → extraerla a `components/` y exportarla desde el barrel.

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

// PlayerSlot — slot de jugador con trigger compacto + dropdown Buscar/Crear
// Usa PlayerSelector internamente. SIEMPRE usar esto en lugar de <select> o inline PlayerSelector
<PlayerSlot
  slotNumber={1}
  selectedId={form.p1}
  onSelect={id => setForm(f => ({ ...f, p1: id }))}
  excludeIds={[form.p2, form.p3]}
  players={allPlayers}
  onAddPlayer={addPlayerToDB}
  formatName={formatPlayerName}
/>
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

---

## Karpathy-Inspired Guidelines

> From [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on LLM coding pitfalls, via [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills).

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
