# DIANA Inference Tool

> Herramienta de predicción de habilidades motoras basada en el test TGMD-3

[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://python.org)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104%2B-009688.svg)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)

## Descripción

DIANA Inference Tool permite evaluar habilidades motoras gruesas en niños mediante análisis de video o datos de esqueleto (skeleton points). El sistema procesa la entrada y predice puntuaciones (0, 1 o 2) para las 12 habilidades definidas en el test TGMD-3.

**Características principales:**
- 🔒 **100% Local/Offline** - Procesamiento sin conexión a internet
- 🎬 **Dual Input** - Acepta video (.mp4, .mov, .avi) o skeleton JSON (OpenPose)
- 🤖 **Modo Dummy** - Funciona sin modelo para desarrollo/testing
- 📊 **Exportación** - Resultados en CSV y JSON
- ⌨️ **Atajos de teclado** - Navegación eficiente por video

## Arquitectura

```
┌─────────────────────┐      REST API      ┌─────────────────────┐
│  Frontend (React)   │◄──────────────────►│  Backend (FastAPI)  │
│  :5173              │    HTTP/JSON       │  :8000              │
└─────────────────────┘                    └─────────────────────┘
         │                                          │
         ▼                                          ▼
   Vite + TypeScript                    Python + Uvicorn + Pydantic
```

## Estructura del Proyecto

```
tgmd-predictor/
├── src/                    # Frontend React + TypeScript
│   ├── components/         # Componentes UI (10 archivos)
│   ├── hooks/              # Custom hooks
│   ├── utils/              # Utilidades (tiempo, export)
│   ├── constants/          # Definiciones de comportamientos
│   ├── types.ts            # Tipos TypeScript
│   └── App.tsx             # Componente principal
├── server/                 # Backend Python
│   ├── main.py             # API FastAPI
│   ├── assets/             # label_map.json
│   ├── models/             # Modelo ONNX (opcional)
│   ├── uploads/            # Videos (gitignored)
│   ├── skeletons/          # JSONs (gitignored)
│   └── runs/               # Artefactos (gitignored)
├── public/                 # Assets estáticos
├── index.html              # HTML raíz
└── package.json            # Dependencias Node
```

## Requisitos

| Componente | Versión |
|------------|---------|
| Node.js | 18+ |
| npm | 9+ |
| Python | 3.10+ |
| pip | 21+ |

## Instalación

### 1. Clonar repositorio

```bash
git clone <url-del-repositorio>
cd tgmd-predictor
```

### 2. Frontend

```bash
npm install
```

### 3. Backend

```bash
# Crear entorno virtual
python -m venv server/venv

# Activar (Windows PowerShell)
server\venv\Scripts\Activate.ps1

# Activar (Windows CMD)
server\venv\Scripts\activate.bat

# Activar (Windows Git Bash / Linux / Mac)
source server/venv/bin/activate

# Instalar dependencias
pip install -r server/requirements.txt
```

## Ejecución

Necesitas **dos terminales**:

### Terminal 1: Backend

```bash
cd server
source venv/bin/activate  # o venv\Scripts\activate en Windows
python main.py
```

> Backend disponible en: `http://127.0.0.1:8000`

### Terminal 2: Frontend

```bash
npm run dev
```

> Frontend disponible en: `http://127.0.0.1:5173`

## Uso

1. **Cargar entrada**: Click en "Video" o "Skeleton" y selecciona un archivo
2. **Seleccionar comportamiento**: Elige de la lista desplegable (A01-C04)
3. **Ejecutar inferencia**: Click en "Ejecutar Inferencia"
4. **Ver resultado**: Score (0/1/2), confianza y rúbrica
5. **Exportar**: Descarga CSV o JSON con resultados

## API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/health` | Estado del servidor |
| `POST` | `/api/videos` | Subir video |
| `POST` | `/api/skeletons` | Subir skeleton JSON |
| `POST` | `/api/infer` | Iniciar inferencia |
| `GET` | `/api/jobs/{id}` | Estado de job |
| `GET` | `/api/jobs/{id}/results` | Resultados |
| `GET` | `/api/behaviors` | Lista de comportamientos |

## Comportamientos TGMD-3

### Locomotoras (A)
- `A01` Subir escaleras
- `A02` Bajar escaleras
- `A03` Lanzar la pelota
- `A04` Pararse en un pie

### Habilidades con Pelota (B)
- `B01` Pararse en un pie (extendido)
- `B02` Saltar 2-3 pasos
- `B03` Salto largo
- `B04` Recibir la pelota

### Control y Equilibrio (C)
- `C01` Detener pelota rodando
- `C02` Rebotar la pelota
- `C03` Saltar sobre cuerda
- `C04` Saltar la cuerda

## Puntuación

| Score | Significado |
|-------|-------------|
| **0** | No puede realizar el movimiento |
| **1** | Realiza con dificultad |
| **2** | Patrón maduro/correcto |

## Atajos de Teclado

| Tecla | Acción |
|-------|--------|
| `Espacio` | Play/Pause |
| `←` / `→` | Saltar ±2s |
| `Alt+←` / `Alt+→` | Saltar ±1 frame |
| `Escape` | Cerrar modal |

## Desarrollo

### Scripts disponibles

```bash
npm run dev       # Dev server con HMR
npm run build     # Build producción
npm run preview   # Preview del build
npm run lint      # ESLint
```

### Modo Dummy

El backend genera predicciones simuladas si no existe modelo en `server/models/model.onnx`. Para forzar modo dummy:

```bash
# Windows
set DIANA_DUMMY_MODE=1 && python main.py

# Linux/Mac
DIANA_DUMMY_MODE=1 python main.py
```

## Integración de Modelo Real

1. Colocar modelo ONNX en `server/models/model.onnx`
2. Descomentar dependencias en `server/requirements.txt`:
   ```
   onnxruntime>=1.16.0
   numpy>=1.24.0
   opencv-python>=4.8.0
   ```
3. Implementar `run_onnx_inference()` en `server/main.py`

## Troubleshooting

### El backend no inicia
- Verificar que el entorno virtual está activo
- Verificar dependencias: `pip install -r server/requirements.txt`
- Verificar puerto 8000 disponible

### Errores CORS
Editar `server/main.py` si usas puerto diferente:
```python
allow_origins=["http://localhost:TU_PUERTO"]
```

### Video no reproduce
- Verificar formato soportado (.mp4, .mov, .avi, .mkv, .webm)
- Verificar codec compatible con el navegador

## Licencia

Proyecto interno - DIANA / INSNSB

---

*Instituto Nacional de Salud del Niño San Borja*
