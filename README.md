# Madre Bot: Asistente Personal de Bootcamp Xperience 🤱

Un chatbot inteligente que permite a los estudiantes interactuar con la documentación y mecánicas de la plataforma educativa Bootcamp Xperience. Encarnando el rol de "Madre", el bot ofrece respuestas precisas, motivadoras y contextualizadas, extrayendo información directamente de la documentación oficial.

Este proyecto utiliza una arquitectura híbrida **RAG (Retrieval-Augmented Generation)**, combinando la velocidad de Embeddings locales con la potencia de **Google Gemini** en la nube.

---

## 🚀 Características Clave

- **Interfaz de Chat Personalizada:** Construida con Streamlit, con un diseño visual en tonos violeta y el logo oficial de la plataforma.
- **Memoria de Corto Plazo (Sliding Window):** El bot recuerda los últimos turnos de la conversación para un diálogo natural sin saturar la ventana de contexto.
- **Respuestas Basadas en la Fuente:** El bot está estrictamente instruido (mediante Guardrails en el prompt) para basar sus respuestas únicamente en el PDF proporcionado y redirigir a soporte si no conoce la respuesta.
- **Procesamiento de Documentos Local:** Usa Embeddings de HuggingFace y ChromaDB de forma local para buscar contexto sin costo alguno.
- **Métricas en Tiempo Real:** Barra lateral que muestra los tokens consumidos por la API de Gemini durante la sesión.

---

## 💻 Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | Streamlit |
| **Orquestación RAG** | LangChain |
| **Cerebro (LLM)** | Google Gemini 3 Flash Preview (API) |
| **Archivero (Embeddings)** | HuggingFace (Local) |
| **Base de datos vectorial** | ChromaDB |
| **Procesamiento de PDF** | PDFPlumber |

---

## 🛠️ Instalación y Configuración

### 1. Descargar y preparar el proyecto
1. Descarga el archivo `Proyecto.zip` desde la plataforma.
2. Descomprime el archivo en la ubicación de tu preferencia en tu computadora.
3. Abre tu terminal y navega hacia la carpeta que acabas de descomprimir:
```bash
cd ruta/a/tu/carpeta/Proyecto
```

### 2. Crear y activar el entorno virtual
**En macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

**En Windows:**
```bash
python -m venv .venv
.\.venv\Scripts\activate
```

### 3. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 4. Configurar la API Key de Gemini
- Crea un archivo llamado exactamente `.env` en la raíz del proyecto.
- Adentro, coloca tu clave de API de Google Gemini sin comillas ni espacios:
  ```text
  GEMINI_API_KEY=TU_CLAVE_DE_GEMINI_AQUI
  ```
- *Puedes obtener tu clave gratuita en: https://aistudio.google.com/app/apikey*

### 5. Añadir tus archivos base
- Coloca tu documento principal dentro de la carpeta `data/` con el nombre `library.pdf`.
- Coloca la imagen de perfil del bot en la carpeta `data/` con el nombre `logo.png`.

---

## 🚀 Ejecución

```bash
streamlit run app/app.py
```

- La **primera vez**, el sistema indexará el PDF automáticamente usando tu procesador local. Puede tardar unos minutos.
- En los **siguientes inicios**, el Vector Store ya estará listo y la app arrancará de inmediato.
- Si actualizas el PDF, elimina la carpeta `vector_store/` para forzar una re-indexación.

Abre tu navegador en: **http://localhost:8501**

---

## 📁 Estructura del Proyecto

```text
bootcamp-madre-bot/
│
├── app/
│   ├── app.py            # Frontend (Streamlit) con UI personalizada
│   ├── backend.py        # Pipeline RAG (LangChain + Gemini API)
│   ├── data_loader.py    # Extracción y chunking del PDF
│   ├── prompts.py        # System Prompt, reglas y personalidad de Madre
│   └── vector_store.py   # Gestión de ChromaDB y Embeddings locales
│
├── data/
│   ├── library.pdf       # Documentación fuente de Bootcamp Xperience
│   └── logo.png          # Logo circular para la barra lateral
│
├── vector_store/         # Base de datos vectorial (se crea automáticamente)
│
├── .env                  # Tu API key de Gemini (NO subir a GitHub)
├── .gitignore            # Archivos a ignorar por Git (incluir .env aquí)
├── requirements.txt      # Dependencias del proyecto
└── README.md
```

---

## ⚠️ Notas importantes

- **Seguridad:** Asegúrate de que `.env` esté incluido en tu archivo `.gitignore` para no exponer tu clave API.
- **Uso de Tokens:** La aplicación muestra los tokens reales calculados por los metadatos de respuesta de la API de Gemini.