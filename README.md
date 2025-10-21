# Rubros C2 Dashboard

Dashboard interactivo para visualizar datos de instituciones educativas y presupuestos de Rubros C2.

## Características

- 🗺️ Mapa interactivo con Leaflet
- 📊 Filtros avanzados por provincia, cantón, zona, nivel educativo
- 📥 Exportar datos filtrados a CSV
- 🔄 Integración con Supabase
- 📱 Responsive design
- 🌈 Código limpio y modular

## Instalación

### Requisitos
- Node.js 18+
- npm o yarn

### Pasos
```bash
# 1. Clonar repositorio
git clone https://github.com/tu-usuario/rubros-c2-dashboard.git
cd rubros-c2-dashboard

# 2. Instalar dependencias
npm install

# 3. Crear archivo .env.local
cp .env.example .env.local

# 4. Editar .env.local con tus credenciales
# VITE_SUPABASE_URL=tu_url_aqui
# VITE_SUPABASE_ANON_KEY=tu_clave_aqui

# 5. Ejecutar en desarrollo
npm run dev

# 6. Build para producción
npm run build
```

## Variables de Entorno

Crea un archivo `.env.local` (nunca se commitea) basado en `.env.example`:
