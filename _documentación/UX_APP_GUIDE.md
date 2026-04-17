# ParaPádel — Guía UX de la Aplicación

> Documento operativo · Abril 2026  
> Para: equipo de producto, onboarding de clubs, soporte

---

## 1. Qué es ParaPádel

ParaPádel es una plataforma web progresiva (PWA) que permite a clubs de pádel gestionar torneos y ligas internas, y a los jugadores seguir su nivel, partidos y ranking en tiempo real.

Funciona en cualquier dispositivo desde el navegador, sin necesidad de descarga.

---

## 2. Tipos de usuario

| Rol | Accede a | Cómo se crea |
|---|---|---|
| **Jugador** | App jugador (`/p/*`) | Auto-registro en `/auth` |
| **Admin de club** | Dashboard del club (`/dashboard`) | Solicitud aprobada por superadmin |
| **Superadmin** | Panel global (`/superadmin`) | Tabla `superadmins` en BD |

---

## 3. Flujos principales

### 3.1 Registro de un nuevo jugador

```
Usuario entra en /auth → Se registra con email + contraseña
        ↓
Sistema crea su registro en la tabla `players` automáticamente
        ↓
Aparece el Onboarding:
  · Opción A — "Soy jugador": rellena nombre, apodo, nivel, posición preferida
  · Opción B — "Represento un club": envía solicitud con datos del club → espera aprobación del superadmin
        ↓
Jugador llega a su Dashboard personal
```

### 3.2 Crear un partido libre

```
Jugador → botón "+" en la barra inferior → /p/matches/create
        ↓
Formulario: fecha, hora, nivel, nº jugadores (2/4/6/8), pista, notas
        ↓
Se genera un enlace único: parapadel.vercel.app/m/ABC123
        ↓
CTA "Compartir por WhatsApp" → abre WhatsApp con texto formateado:

  PARTIDO ABIERTO
  16:30 · Sábado 19 Abr
  Nivel: 3ª alta
  Pista: Pista 3
  
  1. Antonio
  2. —
  3. —
  4. —
  
  Falta 3 jugadores
  [enlace]
```

### 3.3 Unirse a un partido (ficha pública)

```
Cualquiera abre el enlace /m/:shareToken (sin login)
        ↓
Ve la ficha del partido: hora, nivel, pista, jugadores actuales
        ↓
┌─ Si tiene cuenta → "Apuntarme" (1 tap, entra como registered_player)
├─ Si no tiene cuenta → "Entrar y apuntarme" (va a login) 
│                     O "Unirme como invitado" → nombre + móvil (claimable_guest)
└─ Si el host añade alguien → aparece como "Reservado" (placeholder_guest)
        ↓
Las plazas se actualizan en tiempo real (WebSocket Supabase)
        ↓
CTA "Compartir por WhatsApp" actualiza el texto con los nombres reales
```

### 3.4 Registrar resultado

```
Host del partido (quien lo creó) ve botón "Registrar resultado"
        ↓
Introduce el marcador: Equipo A [X] — Equipo B [Y]
Asigna cada jugador a Equipo A o Equipo B
        ↓
Estado: "Pendiente 24h" — cualquier participante registered puede disputar
        ↓
Si nadie disputa en 24h → pasa a "Confirmado" automáticamente
Si alguien disputa → queda en "Disputado" para revisión del admin
        ↓
Al confirmar → trigger en BD calcula ELO y actualiza club_rating de cada jugador
```

### 3.5 Torneo oficial (flujo admin)

```
Admin → /setup → Crea torneo: formato (8/10/12/16p), fecha, categorías, precio
        ↓
/tournament/registration → Inscribe parejas (busca jugadores existentes o crea nuevos)
        ↓
/tournament/checkin → El día del torneo, confirma asistencia pista a pista
        ↓
/tournament/active → Introduce resultados de partidos en tiempo real
        ↓
/tournament/results → Cuadro final, ganadores, actualización ELO automática
```

---

## 4. Sistema de identidad en partidos libres

Cada participante tiene un `participant_type`:

| Tipo | Quién es | ELO se actualiza |
|---|---|---|
| `registered_player` | Usuario con cuenta, vinculado | ✅ Sí |
| `claimable_guest` | Invitado que se apuntó con nombre+móvil | ✅ Si lo reclama |
| `placeholder_guest` | Añadido por el host ("fulano viene") | ❌ No |

**Reclamación:** Un `claimable_guest` puede pulsar "Soy yo" si luego crea una cuenta. Sus partidos quedan vinculados a su perfil.

---

## 5. Sistema de ratings

### 5.1 ELO de torneos (`global_rating`)
- Solo se actualiza en torneos oficiales gestionados por el admin
- Algoritmo ELO estándar con K-factor variable según categoría
- **No se toca nunca con partidos libres**

### 5.2 Club Rating (`club_rating`)
- Solo partidos libres con resultado `final`
- ELO inicial: 1200
- K-factor: 20 (trust full) / 10 (trust partial)
- **Trust score:**
  - `full`: todos registered_player → K=20
  - `partial`: hay claimable_guest sin reclamar → K=10
  - `none`: >50% placeholders → sin cambio de ELO

### 5.3 Club Confidence (`club_confidence`)
- Contador de partidos libres verificados jugados
- Sube con cada partido `final` en el que participas como `registered_player`
- Visible en el ranking de Partidos Libres

---

## 6. Navegación del jugador

```
/p/dashboard     → Inicio: ranking, stats, próximos partidos
/p/tournaments   → Torneos en los que está inscrito
/p/matches/...   → Partidos libres (crear, ver historial)
/p/profile       → ELO, historial detallado, posición preferida
/p/ranking       → Ranking del club (tab Torneos / tab Partidos Libres)
```

Barra de navegación inferior: Dashboard · Torneos · + (crear partido) · Ranking · Perfil

---

## 7. Navegación del admin

```
/dashboard           → KPIs del club
/setup               → Crear torneo
/tournament/*        → Gestión del torneo activo
/league/*            → Liga
/players             → Gestión de jugadores
/history             → Historial de torneos pasados
/club-profile        → Configuración del club
```

---

## 8. Rutas públicas (sin login)

| Ruta | Descripción |
|---|---|
| `/` | Landing page |
| `/auth` | Login / registro |
| `/m/:shareToken` | Ficha pública de partido libre |
| `/join/:clubId` | Formulario de inscripción a torneo |
| `/p/:id` | Ficha pública de jugador |

---

## 9. Variables de entorno necesarias

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_HCAPTCHA_SITE_TOKEN=...  (solo producción)
```

---

## 10. Datos técnicos

- **Framework:** React 18 + Vite + TypeScript
- **Base de datos:** Supabase (PostgreSQL + Auth + RLS)
- **Despliegue:** Vercel (auto-deploy desde GitHub)
- **Rama producción:** `main` → parapadel.vercel.app
- **Rama staging:** `develop` → para-padel-git-develop-...vercel.app
