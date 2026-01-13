// Configuración de Supabase
const SUPABASE_URL = 'https://wtxjnetbjiifptriqgft.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0eGpuZXRiamlpZnB0cmlxZ2Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDgwNjAsImV4cCI6MjA4MTQyNDA2MH0.fhnDUe6GrTMaQBUDnIFKSL4WdatJUuxRU4hGpljnQ9I';

// Configuración de Telegram
const TELEGRAM_CONFIG = {
  botToken: '7991087801:AAG6iW_8RAmc6fRRJqIRccA81_VocdmifVQ',
  todosChatIds: ['1732673300', '5736838270', '405891742', '1116340725', '5495683947', '8282196752', '5248508833', '5763557931']
};

// Variables globales
let map;
let capturandoReporte = false;
let markerReporte = null;
let capaParroquias = null;

// Inicializar mapa
function initMap() {
  map = L.map('map').setView([-1.5, -78.5], 7);
  
  // Capa base
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  // Cargar capa de parroquias desde Supabase (desactivada por defecto)
  cargarCapaParroquias();

  // Event listener para clicks en el mapa
  map.on('click', handleMapClick);
}

// Cargar capa de parroquias desde Supabase
async function cargarCapaParroquias() {
  try {
    console.log('Cargando capa de parroquias desde Supabase...');
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/parroquias?select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Registros recibidos: ${data.length}`);
    
    if (data && data.length > 0) {
      // Crear GeoJSON FeatureCollection
      const geojson = {
        type: "FeatureCollection",
        features: data.map(item => ({
          type: "Feature",
          properties: {
            parroquia: item.parroquia,
            canton: item.canton
          },
          geometry: item.geom
        }))
      };

      console.log('GeoJSON creado con', geojson.features.length, 'features');

      // Crear capa de Leaflet (sin agregarla al mapa)
      capaParroquias = L.geoJSON(geojson, {
        style: {
          color: '#3182ce',
          weight: 2,
          opacity: 0.6,
          fillColor: '#4299e1',
          fillOpacity: 0.1
        },
        onEachFeature: (feature, layer) => {
          layer.bindPopup(`
            <strong>${feature.properties.parroquia}</strong><br>
            Cantón: ${feature.properties.canton}
          `);
        }
      });
      
      console.log('Capa de parroquias creada exitosamente');
    } else {
      console.warn('No se encontraron parroquias en la base de datos');
    }
  } catch (error) {
    console.error('Error cargando capa de parroquias:', error);
  }
}

// Manejar clicks en el mapa
async function handleMapClick(e) {
  const { lat, lng } = e.latlng;
  
  if (capturandoReporte) {
    await capturarUbicacion(lat, lng);
    return;
  }
  
  // Consulta normal de ubicación
  const ubicacion = await consultarParroquia(lat, lng);
  mostrarInfoUbicacion(ubicacion);
}

// Consultar parroquia y cantón desde Supabase
async function consultarParroquia(lat, lng) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_parroquia_at_point`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lon: lng, lat: lat })
      }
    );

    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        parroquia: data[0].parroquia,
        canton: data[0].canton
      };
    }
    return null;
  } catch (error) {
    console.error('Error consultando parroquia:', error);
    return null;
  }
}

// Mostrar información de ubicación
function mostrarInfoUbicacion(ubicacion) {
  const infoContent = document.getElementById('info-content');
  
  if (ubicacion) {
    infoContent.innerHTML = `
      <strong>📍 ${ubicacion.parroquia}</strong><br>
      <span style="color: #718096;">Cantón: ${ubicacion.canton}</span>
    `;
  } else {
    infoContent.innerHTML = '<span style="color: #e53e3e;">Fuera del territorio ecuatoriano</span>';
  }
}

// Capturar ubicación para reporte
async function capturarUbicacion(lat, lng) {
  // Actualizar coordenadas
  document.getElementById('longitud').value = lng.toFixed(6);
  document.getElementById('latitud').value = lat.toFixed(6);
  
  // Agregar marcador temporal
  if (markerReporte) {
    map.removeLayer(markerReporte);
  }
  
  markerReporte = L.marker([lat, lng], {
    icon: L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    })
  }).addTo(map);
  
  map.setView([lat, lng], 13);
  
  // Consultar ubicación
  const ubicacion = await consultarParroquia(lat, lng);
  
  if (ubicacion) {
    document.getElementById('parroquia').value = ubicacion.parroquia;
    document.getElementById('canton').value = ubicacion.canton;
  } else {
    document.getElementById('parroquia').value = 'Fuera de Ecuador';
    document.getElementById('canton').value = 'N/A';
  }
  
  capturandoReporte = false;
  
  // Enfocar en el primer campo del formulario
  document.getElementById('nombres').focus();
}

// Limpiar formulario
function limpiarFormulario() {
  document.getElementById('reporte-form').reset();
  
  if (markerReporte) {
    map.removeLayer(markerReporte);
    markerReporte = null;
  }
  
  document.getElementById('info-content').innerHTML = 'Haz clic en cualquier lugar del mapa para consultar la ubicación';
}

// Enviar reporte a Supabase
async function guardarReporte(datos) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/reportes_snap`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(datos)
      }
    );

    if (!response.ok) {
      throw new Error('Error al guardar en Supabase');
    }

    return await response.json();
  } catch (error) {
    console.error('Error guardando reporte:', error);
    throw error;
  }
}

// Enviar notificación a Telegram
async function enviarTelegram(datos) {
  const { botToken, todosChatIds } = TELEGRAM_CONFIG;
  let chatIds = [];
  
  // Asignar responsables según tipo de problema
  if (datos.tipo_problema === 'Deforestación') {
    chatIds = ['998966802'];
  } else {
    // Seleccionar 2-3 personas aleatorias
    const cantidad = 2 + Math.floor(Math.random() * 2);
    const shuffled = [...todosChatIds].sort(() => 0.5 - Math.random());
    chatIds = shuffled.slice(0, cantidad);
  }
  
  // Construir mensaje
  const mensaje = `🚨 *NUEVO REPORTE SNAP*\n\n` +
                 `👤 *Reportado por:* ${datos.nombres}\n` +
                 `⚠️ *Tipo:* ${datos.tipo_problema}\n` +
                 `📍 *Ubicación:* ${datos.parroquia}, ${datos.canton}\n` +
                 `💬 *Comentarios:* ${datos.comentarios || 'Sin comentarios'}\n\n` +
                 `🌐 *Coordenadas:* ${datos.latitud}, ${datos.longitud}\n\n` +
                 `[Ver en Google Maps](https://www.google.com/maps?q=${datos.latitud},${datos.longitud})`;
  
  // Enviar a cada responsable
  for (const chatId of chatIds) {
    try {
      // Enviar mensaje
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: mensaje,
          parse_mode: 'Markdown'
        })
      });
      
      // Esperar un poco
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Enviar ubicación
      await fetch(`https://api.telegram.org/bot${botToken}/sendLocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          latitude: datos.latitud,
          longitude: datos.longitud
        })
      });
    } catch (error) {
      console.error('Error enviando a Telegram:', error);
    }
  }
}

// Cargar reportes existentes
async function loadReportes() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/reportes_snap?select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const reportes = await response.json();
    
    reportes.forEach(reporte => {
      const marker = L.marker([reporte.latitud, reporte.longitud], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      });
      
      marker.bindPopup(`
        <div style="min-width: 200px;">
          <strong style="font-size: 16px; color: #2d3748;">${reporte.nombres}</strong><br>
          <span style="background: #fed7d7; color: #c53030; padding: 2px 8px; border-radius: 4px; font-size: 12px; display: inline-block; margin: 5px 0;">
            ${reporte.tipo_problema}
          </span><br>
          <p style="margin: 8px 0; color: #4a5568; font-size: 14px;">${reporte.comentarios || 'Sin comentarios'}</p>
          <strong style="color: #2d3748; font-size: 13px;">📍 Ubicación:</strong> 
          <span style="color: #718096; font-size: 13px;">${reporte.parroquia}, ${reporte.canton}</span><br>
          <small style="color: #a0aec0; font-size: 12px;">
            📅 ${new Date(reporte.fecha_reporte).toLocaleDateString('es-EC', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </small>
        </div>
      `);
      
      marker.addTo(map);
    });
  } catch (error) {
    console.error('Error cargando reportes:', error);
  }
}

// Obtener ubicación GPS
function obtenerUbicacionGPS() {
  if (!navigator.geolocation) {
    alert('❌ Tu navegador no soporta geolocalización');
    return;
  }

  document.getElementById('info-content').innerHTML = '⏳ Obteniendo ubicación GPS...';
  
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const precision = position.coords.accuracy;
      
      if (precision < 5) {
        document.getElementById('info-content').innerHTML = 
          `✅ Precisión GPS: <strong>${precision.toFixed(1)}m</strong><br>
          <span style="color: #38a169;">Excelente precisión</span>`;
      } else {
        document.getElementById('info-content').innerHTML = 
          `⚠️ Precisión GPS: <strong>${precision.toFixed(1)}m</strong><br>
          <span style="color: #e53e3e;">Precisión baja - verifica la ubicación</span>`;
      }
      
      await capturarUbicacion(lat, lng);
    },
    (error) => {
      alert('❌ Error al obtener ubicación: ' + error.message);
      document.getElementById('info-content').innerHTML = '❌ Error al obtener ubicación GPS';
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar mapa
  initMap();
  
  // Cargar reportes existentes
  loadReportes();
  
  // Deshabilitar checkbox hasta que la capa esté cargada
  const checkboxParroquias = document.getElementById('toggle-parroquias');
  checkboxParroquias.disabled = true;
  checkboxParroquias.parentElement.style.opacity = '0.5';
  
  // Esperar a que la capa esté lista
  const esperarCapa = setInterval(() => {
    if (capaParroquias) {
      clearInterval(esperarCapa);
      checkboxParroquias.disabled = false;
      checkboxParroquias.parentElement.style.opacity = '1';
    }
  }, 100);
  
  // Botón nuevo reporte
  document.getElementById('btn-reporte').addEventListener('click', () => {
    capturandoReporte = true;
    document.getElementById('info-content').innerHTML = 
      '🎯 <strong>Haz clic en el mapa</strong><br>para ubicar el reporte';
  });
  
  // Botón GPS
  document.getElementById('btn-gps').addEventListener('click', obtenerUbicacionGPS);
  
  // Toggle de capa de parroquias
  checkboxParroquias.addEventListener('change', (e) => {
    if (e.target.checked) {
      if (capaParroquias) {
        console.log('Agregando capa de parroquias al mapa');
        map.addLayer(capaParroquias);
      } else {
        console.error('La capa de parroquias no está disponible');
      }
    } else {
      if (capaParroquias && map.hasLayer(capaParroquias)) {
        console.log('Removiendo capa de parroquias del mapa');
        map.removeLayer(capaParroquias);
      }
    }
  });
  
  // Submit del formulario
  document.getElementById('reporte-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const datos = {
      nombres: document.getElementById('nombres').value,
      tipo_problema: document.getElementById('tipo_problema').value,
      comentarios: document.getElementById('comentarios').value,
      longitud: parseFloat(document.getElementById('longitud').value),
      latitud: parseFloat(document.getElementById('latitud').value),
      parroquia: document.getElementById('parroquia').value,
      canton: document.getElementById('canton').value
    };

    try {
      // Guardar en Supabase
      await guardarReporte(datos);
      
      // Enviar notificación a Telegram
      await enviarTelegram(datos);
      
      alert('✅ Reporte guardado exitosamente');
      limpiarFormulario();
      loadReportes();
    } catch (error) {
      alert('❌ Error al guardar el reporte: ' + error.message);
    }
  });
});

// Hacer disponible globalmente
window.limpiarFormulario = limpiarFormulario;