# GenealogíaApp — Especificación Técnica Completa

> Árbol genealógico colaborativo con relaciones relativas · Angular 17 · D3.js · Angular Material

---

## 1. Visión general

GenealogíaApp es una SPA (Single Page Application) desarrollada íntegramente en **Angular 17 (standalone components)** que permite:

- Gestionar múltiples **proyectos** (árboles genealógicos independientes).
- Modelar personas y sus relaciones mediante un **grafo de vínculos relativos** (no posiciones absolutas).
- Renderizar el árbol automáticamente usando **D3.js** con zoom y paneo.
- Exportar a **SVG** y a **texto plano estructurado**.
- Compartir árboles mediante **enlaces colaborativos con tokens**.

---

## 2. Arquitectura del proyecto

```
src/
├── app/
│   ├── app.component.ts          # Root component (RouterOutlet)
│   ├── app.routes.ts             # Lazy-loaded routes (HashRouter)
│   │
│   ├── core/
│   │   ├── models/
│   │   │   └── index.ts          # Todos los tipos: Person, Relation, FamilyTree…
│   │   └── services/
│   │       ├── storage.service.ts        # IndexedDB + LocalStorage fallback
│   │       ├── tree.service.ts           # Orquestación CRUD de árboles/personas/relaciones
│   │       ├── tree-layout.service.ts    # Algoritmo de jerarquía desde relaciones relativas
│   │       ├── export.service.ts         # SVG + texto plano + JSON backup
│   │       └── collaboration.service.ts  # Tokens, sesiones, URLs de compartición
│   │
│   └── features/
│       ├── dashboard/
│       │   └── dashboard.component.ts   # Lista de proyectos, crear/importar
│       ├── tree-editor/
│       │   ├── tree-editor.component.ts         # Shell: header + sidenav + canvas
│       │   ├── tree-canvas/
│       │   │   └── tree-canvas.component.ts     # D3 SVG renderer
│       │   ├── person-form/
│       │   │   └── person-form.component.ts     # Dialog CRUD personas
│       │   └── relation-form/
│       │       └── relation-form.component.ts   # Dialog CRUD relaciones
│       └── collaboration/
│           └── collaborate.component.ts         # Página de aterrizaje para links compartidos
│
├── main.ts                       # bootstrapApplication (standalone)
└── styles.scss                   # Angular Material theme + resets
```

---

## 3. Modelo de datos

### 3.1 Tipos de relación

```typescript
type RelationType =
  | 'parentOf'         // padre/madre → hijo/a
  | 'childOf'          // hijo/a → padre/madre
  | 'partnerOf'        // pareja ↔ pareja
  | 'siblingOf'        // hermano/a ↔ hermano/a
  | 'halfSiblingOf'    // medio/a hermano/a ↔ medio/a hermano/a
  | 'ancestorOf'       // ancestro → descendiente
  | 'descendantOf'     // descendiente → ancestro
  | 'adoptiveParentOf' // padre/madre adoptivo/a → hijo/a adoptivo/a
  | 'adoptiveChildOf'  // hijo/a adoptivo/a → padre/madre adoptivo/a
  | 'stepParentOf'     // padrastro/madrastra → hijastro/a
  | 'stepChildOf'      // hijastro/a → padrastro/madrastra
  | 'guardianOf'       // tutor/a → tutelado/a
  | 'wardOf';          // tutelado/a → tutor/a
```

### 3.2 Interfaces principales

```typescript
interface Person {
  id: string;           // UUIDv4
  name: string;
  photoUrl?: string;    // Base64 (almacenado en IndexedDB)
  birthDate?: string;   // YYYY-MM-DD
  deathDate?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface Relation {
  id: string;
  from: string;         // Person.id
  to: string;           // Person.id
  type: RelationType;
  startDate?: string;   // Ej. año de matrimonio
  endDate?: string;     // Ej. año de divorcio
  notes?: string;
}

interface FamilyTree {
  id: string;
  name: string;
  description?: string;
  persons: Person[];
  relations: Relation[];
  permissions: TreePermissions;
  createdAt: string;
  updatedAt: string;
}

interface TreePermissions {
  ownerToken: string;            // 48 hex chars (crypto.getRandomValues)
  collaborationToken?: string;   // 32 hex chars, compartido para edición
  isPublicRead: boolean;
  editorTokens: string[];
}
```

---

## 4. Algoritmo de inferencia de jerarquía

El núcleo del sistema es `TreeLayoutService.computeLayout()`. Su funcionamiento:

### Paso 1 — Normalización de relaciones
Todas las relaciones se normalizan a tres categorías canónicas:
- **parentOf** (y su inversa `childOf`)
- **partnerOf**  
- **siblingOf** / **halfSiblingOf**

```
Entrada: Relation[]
Salida:  parentOf[], childOf[], partnerOf[], siblingOf[]
```

### Paso 2 — Asignación de niveles (BFS)
```
Raíces = personas sin padres en el grafo canónico
queue  = raíces con nivel 0

Para cada nodo en la cola:
  niveles[nodo] = nivel
  Para cada hijo de nodo:
    Encolar(hijo, nivel + 1)

Personas desconectadas → nivel 0
```

### Paso 3 — Agrupación de parejas
Dentro de cada nivel, los nodos con relación `partnerOf` se agrupan para colocarse adyacentes horizontalmente.

### Paso 4 — Asignación de posiciones X
```
Para cada nivel (de arriba a abajo):
  Para cada grupo de parejas:
    x = cursorX
    y = nivel × (NODE_H + V_GAP)
    Incrementar cursorX por anchura del grupo + H_GAP
```

### Paso 5 — Centrado de padres
Post-proceso de abajo hacia arriba: cada padre se centra horizontalmente sobre la media de las posiciones de sus hijos.

### Paso 6 — Generación de aristas
Para cada `Relation`, se calcula una curva cúbica de Bézier entre los centros de los nodos, evitando duplicados.

```
Resultado: TreeLayout {
  nodes: Map<string, LayoutNode>,
  edges: LayoutEdge[],
  width, height, levelCount
}
```

---

## 5. Renderizado con D3.js

`TreeCanvasComponent` recibe el `TreeLayout` calculado por el servicio y lo dibuja en un `<svg>` usando D3:

```
SVG
└── <g class="zoom-layer">          ← D3 Zoom aplicado aquí
    ├── <g class="edges">
    │   ├── <path>  ← Aristas (curvas cúbicas de Bézier)
    │   └── <text>  ← Etiquetas de relación
    └── <g class="nodes">
        └── <g.node> (uno por persona)
            ├── <rect>    ← Tarjeta con sombra
            ├── <circle>  ← Avatar o imagen
            ├── <image>   ← Foto (si existe)
            ├── <text>    ← Nombre
            └── <text>    ← Fechas
```

**Controles de zoom:**
- Scroll del ratón → `d3.zoom().scaleExtent([0.1, 3])`
- Botones: `zoomIn()`, `zoomOut()`, `fitToScreen()`, `resetZoom()`

**Interacción:**
- Click en nodo → `personClick` EventEmitter → seleccionar persona
- Doble click en nodo → `personDblClick` → abrir diálogo de edición
- Click en fondo → deseleccionar

---

## 6. Sistema de colaboración

### Generación de enlace
```typescript
// 1. El propietario llama a:
CollaborationService.generateCollaborationLink(treeId, ownerToken)

// 2. Se genera (o recupera) el collaborationToken:
token = crypto.getRandomValues(new Uint8Array(16)).hex()

// 3. Se persiste en FamilyTree.permissions.collaborationToken

// 4. Se retorna:
"https://app.example.com/#/collaborate?tree=<treeId>&token=<token>"
```

### Resolución del enlace
Cuando un colaborador abre el enlace:
```
GET /#/collaborate?tree=<treeId>&token=<token>

CollaborationService.resolveToken(treeId, token)
  → ownerToken === token  →  role: 'owner'
  → collaborationToken === token  →  role: 'editor'
  → isPublicRead === true  →  role: 'viewer'
  → else  →  null (enlace inválido)
```

La sesión se guarda en `localStorage['genealogy_session']` con la clave `${treeId}_${token}`.

---

## 7. Exportación

### 7.1 SVG
```typescript
ExportService.exportSVG(tree, svgElement?)
```
1. Si se pasa el `<svg>` del canvas → clone + reset del transform → serialize
2. Si no → generación programática con toda la geometría del layout

### 7.2 Texto plano
```
Familia: García–López
Descripción: Árbol principal de la familia

Juan García
  Nacimiento: 1945-03-12
  - parentOf → Ana García
  - partnerOf → Carmen López
  Notas: Fundador de la empresa familiar

Ana García
  Nacimiento: 1970-07-04
  - siblingOf → Luis García
  - childOf → Juan García
  - childOf → Carmen López
```

### 7.3 JSON backup/restore
Import completo del árbol (personas + relaciones + metadatos).

---

## 8. Almacenamiento

| Prioridad | Mecanismo | Notas |
|-----------|-----------|-------|
| 1ª opción | **IndexedDB** (`genealogy_db`) | Persistente, sin límite práctico, soporta imágenes en Base64 |
| Fallback | **LocalStorage** (`genealogy_trees`) | Automático si IndexedDB no está disponible |

Las fotos se guardan como cadenas Base64 dentro del objeto `Person`, almacenado junto con el árbol.

---

## 9. Dependencias

```json
"dependencies": {
  "@angular/material": "^17",     // Componentes UI (dialogs, sidenav, cards…)
  "@angular/cdk":      "^17",     // Infraestructura de Material
  "d3":                "^7.9",    // Renderizado SVG y zoom
  "uuid":              "^9",      // Generación de IDs únicos
  "rxjs":              "~7.8",    // Reactivo (BehaviorSubject, combineLatest…)
  "zone.js":           "~0.14"    // Change detection de Angular
},
"devDependencies": {
  "@types/d3":   "^7.4",
  "@types/uuid": "^9"
}
```

---

## 10. Instalación y despliegue

### 10.1 Instalación local

```bash
# 1. Clonar o crear el proyecto
ng new genealogy-collaborative --standalone --routing --style=scss
cd genealogy-collaborative

# 2. Instalar dependencias
npm install @angular/material @angular/cdk d3 uuid
npm install -D @types/d3 @types/uuid

# 3. Copiar los archivos fuente generados (todos los .ts/.scss)

# 4. Configurar Angular Material en styles.scss (ver archivo)

# 5. Añadir fuentes en index.html
# <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
# <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">

# 6. Lanzar en desarrollo
ng serve --open
```

### 10.2 Build de producción

```bash
ng build --configuration production
# Salida: dist/genealogy-collaborative/
```

Servir el build con cualquier servidor estático (nginx, Apache, Firebase Hosting, Vercel, Netlify…):

```nginx
# nginx.conf
server {
  root /var/www/genealogy;
  location / {
    try_files $uri $uri/ /index.html;  # SPA fallback
  }
}
```

### 10.3 Despliegue en Firebase Hosting (ejemplo)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# public directory: dist/genealogy-collaborative/browser
# single-page app: yes
ng build --configuration production
firebase deploy
```

---

## 11. Extensiones sugeridas

| Funcionalidad | Tecnología recomendada |
|---------------|------------------------|
| Sincronización en tiempo real | Firebase Realtime DB / Supabase |
| Autenticación de usuarios     | Firebase Auth / Auth0 |
| Backend REST                  | NestJS + PostgreSQL    |
| Búsqueda de personas          | Fuse.js (fuzzy search) |
| Impresión PDF                 | jsPDF + html2canvas    |
| Árbol GEDCOM (estándar)       | Parser GEDCOM → Relation[] |
| Tests unitarios               | Jest + @angular/testing |
| Tests e2e                     | Playwright             |

---

## 12. Flujo de uso paso a paso

```
1. Usuario abre la app  →  Dashboard con sus árboles (desde IndexedDB)

2. Crea un árbol  →  NewTreeDialog  →  TreeService.createTree()
                                       ownerToken generado y guardado en localStorage

3. Abre el árbol  →  TreeEditorComponent
   ├── Sidebar izquierdo: pestañas Personas / Relaciones / Detalle
   └── Canvas D3: árbol renderizado en SVG

4. Añade persona  →  PersonFormComponent (dialog)
                  →  TreeService.addPerson()  →  StorageService.saveTree()
                  →  activeTree$ emite nuevo valor  →  layout recalculado

5. Añade relación  →  RelationFormComponent (dialog)
                   →  TreeService.addRelation()
                   →  TreeLayoutService.computeLayout() recalcula jerarquía

6. Comparte enlace  →  CollaborationService.generateCollaborationLink()
                    →  URL copiada al portapapeles

7. Colaborador abre URL  →  CollaborateComponent
                         →  resolveToken()  →  role: 'editor'
                         →  Redirige a /tree/:id con permisos de edición

8. Exporta árbol  →  ExportService.downloadSVG() / downloadText()
```

---

*Generado automáticamente — GenealogíaApp v1.0 — Angular 17 + D3.js + Angular Material*