# ParaPádel — Flujos por Rol

> Abril 2026 · Referencia interna para producto, soporte y onboarding

---

## Índice

1. [Rol: Jugador](#1-rol-jugador)
2. [Rol: Admin de Club](#2-rol-admin-de-club)

---

## 1. Rol: Jugador

### 1.1 Registro y primera vez

```
Recibe un enlace de un amigo / del club
        ↓
Abre parapadel.vercel.app → pantalla de inicio
        ↓
Pulsa "Entrar" → /auth
        ↓
Se registra con email + contraseña (con verificación hCaptcha)
        ↓
Sistema crea su ficha en la base de datos automáticamente
        ↓
Aparece el Onboarding (solo la primera vez):
  ┌─ "Soy jugador" ──────────────────────────────────────────┐
  │  Rellena: nombre completo, apodo (opcional),             │
  │  nivel de juego, posición preferida (derecha/revés)      │
  │  → Guarda y va al Dashboard                              │
  └──────────────────────────────────────────────────────────┘
  ┌─ "Represento un club" ───────────────────────────────────┐
  │  Rellena: nombre del club, dirección, teléfono           │
  │  → Solicitud enviada al superadmin para aprobación       │
  │  → Mientras tanto, queda como jugador normal             │
  └──────────────────────────────────────────────────────────┘
```

---

### 1.2 Dashboard del jugador (`/p/dashboard`)

Qué ve:
- Su nombre y avatar
- Tarjeta de ranking: ELO actual + categoría + % victorias + partidos jugados
- Acceso rápido a "Torneos" y "Historial"
- Sección "Mis Próximos Partidos": los partidos del club en los que está apuntado

---

### 1.3 Unirse a un partido libre

El club crea un partido y comparte el enlace por WhatsApp.

```
Jugador recibe mensaje en WhatsApp con enlace /m/:shareToken
        ↓
Abre la ficha pública del partido (sin necesidad de estar logueado):
  · Hora, fecha, nivel, pista
  · Lista de jugadores: quién está apuntado, cuántas plazas quedan
        ↓
¿Tiene cuenta?
  SÍ → "Apuntarme" (un tap) → queda como registered_player
  NO → "Entrar y apuntarme" → va a login/registro
     → O "Unirme como invitado" → pone su nombre y móvil → queda como claimable_guest
        ↓
Confirmación en pantalla: "¡Estás apuntado! Te esperamos en la pista."
CTA: "Compartir por WhatsApp" (reenvía el enlace con el texto actualizado)
```

> **Nota:** Si el jugador se registró como invitado (con nombre y móvil) y luego crea una cuenta, puede pulsar "Soy yo" en la ficha del partido para vincular su historial.

---

### 1.4 Reclamar un perfil de invitado

```
Jugador se apuntó como invitado en partidos anteriores (sin cuenta)
        ↓
Se registra en la app con su email
        ↓
Abre el enlace de uno de esos partidos (/m/:shareToken)
        ↓
Ve su nombre en la lista con el badge "Invitado"
        ↓
Pulsa "Soy yo" → su cuenta queda vinculada a esa participación
        ↓
Esos partidos ya cuentan para su historial y su Club Rating
```

---

### 1.5 Ver el resultado de un partido

```
El host (club o jugador designado) registra el marcador
        ↓
En la ficha del partido aparece el resultado con estado "Pendiente 24h"
        ↓
Si el jugador cree que el marcador es incorrecto:
  Pulsa "Disputar resultado" → escribe el motivo (opcional) → envía
        ↓
Si nadie disputa en 24 horas:
  El resultado pasa a "Confirmado" automáticamente
  El Club Rating de los participantes se actualiza
```

---

### 1.6 Ver historial de partidos (`/p/matches`)

Qué ve:
- Stats: total de partidos, victorias, ratio de victorias
- Filtro: Todos / Victorias / Derrotas
- **Sección "Partidos Libres":** partidos con resultado confirmado o pendiente de confirmación
- **Sección "Historial de Torneos":** torneos en los que ha participado, con cada partido y su cambio de ELO

Cada partido libre muestra:
- Fecha y pista
- Nombres de ambos equipos
- Marcador final (rojo/verde según ganó o perdió)
- Badge "Pendiente" si el resultado está en ventana de 24h

---

### 1.7 Ranking (`/p/ranking`)

Dos tabs:

**Tab "Torneos":** Ranking de los jugadores del club ordenados por ELO de torneos oficiales. Solo cambia cuando hay torneos.

**Tab "Partidos Libres":** Ranking de todos los jugadores que han jugado partidos libres, ordenados por Club Rating (ELO independiente). Cada jugador muestra cuántos partidos ha jugado.

El jugador ve su posición destacada en la tarjeta superior.

---

### 1.8 Perfil (`/p/profile`)

- Datos personales: nombre, apodo, nivel, posición
- ELO global (torneos) con barra de progreso
- Categorías en las que ha jugado
- Historial de partidos de torneo con desglose de ELO por partido

---

### 1.9 Inscribirse a un torneo del club

```
Club comparte enlace de inscripción /join/:clubId
        ↓
Jugador abre el formulario público
        ↓
Rellena: nombre, email, nivel, posición preferida, pareja (opcional)
        ↓
Admin del club lo ve en la lista de inscritos y confirma
        ↓
El jugador aparece en los partidos del torneo
```

---

## 2. Rol: Admin de Club

### 2.1 Primera vez — Onboarding del club

```
Admin recibe acceso de parte del superadmin (su solicitud fue aprobada)
        ↓
Inicia sesión → /auth
        ↓
Sistema detecta que tiene un club asignado → lo lleva a /onboarding
        ↓
Rellena: nombre del club, dirección, número de pistas, logo (opcional)
        ↓
Llega al Dashboard del club (/dashboard)
```

---

### 2.2 Dashboard del club (`/dashboard`)

KPIs visibles:
- Jugadores registrados en el club
- Torneos jugados
- Top ELO del club
- Torneo / liga activos con acceso rápido

---

### 2.3 Crear y gestionar un mini torneo

**Paso 1 — Setup (`/setup`)**
```
Selecciona formato: 8, 10, 12 o 16 parejas
Rellena: nombre del torneo, fecha, descripción
Activa categorías (ej: 3ª, 4ª, iniciación)
Pulsa "Crear torneo"
```

**Paso 2 — Inscripciones (`/tournament/registration`)**
```
Puede:
  · Buscar jugadores ya registrados en el club y apuntarlos directamente
  · Crear un jugador nuevo rápido (nombre + email)
  · Compartir enlace público /join/:clubId para que se inscriban solos
        ↓
Ve en tiempo real cuántas parejas hay por categoría
Puede reordenar o sacar parejas de la lista
```

**Paso 3 — Check-in el día del torneo (`/tournament/checkin`)**
```
Confirma qué parejas han llegado físicamente
Las que no confirma quedan fuera del cuadro
```

**Paso 4 — Torneo activo (`/tournament/active`)**
```
El sistema genera automáticamente:
  · Grupos con todos vs todos en la fase de grupos
  · Cuadro de eliminatoria (main + consolación)
        ↓
Admin introduce resultados partido a partido
El cuadro avanza solo
El ranking del grupo se actualiza en tiempo real
```

**Paso 5 — Resultados (`/tournament/results`)**
```
Vista final del cuadro
Ganadores de cada categoría
ELO actualizado automáticamente para todos los participantes
Historial guardado en /history
```

---

### 2.4 Crear y gestionar una liga (`/league/*`)

```
/league/setup → Nombre, fechas inicio/fin, categorías, nº de jornadas
        ↓
/league/groups → Asignar equipos a grupos, configurar jornadas
        ↓
/league/active → Introducir resultados de cada jornada
                 Tabla de clasificación en tiempo real
        ↓
Playoffs automáticos cuando terminan los grupos
```

---

### 2.5 Crear un partido libre (para compartir por WhatsApp)

```
Dashboard del club → sección "Partidos libres"
        ↓
Botón "Nuevo partido"
        ↓
Rellena: fecha, hora, nivel, número de jugadores (2/4/6/8), pista, notas
        ↓
Se genera enlace: parapadel.vercel.app/m/XXXXXX
        ↓
Pulsa "Compartir por WhatsApp" → abre WhatsApp con el texto formateado:

  PARTIDO ABIERTO
  16:30 · Sábado 19 Abr
  Nivel: 3ª alta · Pista 3

  1. —
  2. —
  3. —
  4. —

  Faltan 4 jugadores
  👉 [enlace]

        ↓
Los jugadores se apuntan desde el enlace
El admin ve en tiempo real quién se ha apuntado
        ↓
Cuando termina el partido, el admin registra el resultado:
  · Introduce el marcador (Equipo A – Equipo B)
  · Asigna cada jugador a Equipo A o Equipo B
        ↓
Ventana de 24h → si nadie disputa → resultado confirmado → ELO actualizado
```

---

### 2.6 Gestión de jugadores (`/players`)

```
Lista de todos los jugadores del club con:
  · Nombre, nivel, ELO, categoría
  · Estado (activo / inactivo)
        ↓
Puede:
  · Crear jugador nuevo (nombre, email, nivel, posición)
  · Editar datos de un jugador
  · Ver el perfil completo con historial de torneos
  · Ajustar el ELO manualmente (con justificación)
```

---

### 2.7 Ver historial del club (`/history`)

- Lista de todos los torneos pasados con fecha y formato
- Al expandir un torneo: resultados, parejas y cambios de ELO
- Útil para resolver disputas o consultar evolución de jugadores

---

### 2.8 Gestión del perfil del club (`/club`)

- Nombre, dirección, teléfono, número de pistas
- Logo del club
- Módulos activos (torneos, liga, calendario de pistas)

---

## Resumen de diferencias clave entre roles

| Acción | Jugador | Admin de club |
|---|---|---|
| Ver su propio perfil y ELO | ✅ | — |
| Unirse a un partido | ✅ | — |
| Crear un partido libre | ❌ (solo el club) | ✅ |
| Disputar un resultado | ✅ | — |
| Crear un torneo | ❌ | ✅ |
| Inscribir jugadores | ❌ | ✅ |
| Introducir resultados de torneo | ❌ | ✅ |
| Registrar resultado de partido libre | ❌ | ✅ (como host) |
| Ver ranking del club | ✅ | ✅ |
| Gestionar jugadores del club | ❌ | ✅ |
| Ver historial de torneos del club | ✅ (los suyos) | ✅ (todos) |
