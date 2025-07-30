/ Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCIra7bW5kBj3ynwsAf-H-c97vWgptfnaE",
    authDomain: "appreciclaje-b7b2a.firebaseapp.com",
    projectId: "appreciclaje-b7b2a",
    storageBucket: "appreciclaje-b7b2a.appspot.com",
    messagingSenderId: "675875410563",
    appId: "1:675875410563:web:18254ae4f8d9c8e9f3c123"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Variables globales
let currentUser = null;
let userRole = null;
let map = null;
let marker = null;
let selectedLocation = null;
let recicladorMap = null;
let followingMap = null;

// Elementos del DOM
const loadingScreen = document.getElementById('loading-screen');
const authScreen = document.getElementById('auth-screen');
const appContainer = document.getElementById('app-container');

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', function() {
    // Ocultar loading después de 2 segundos
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
        authScreen.classList.remove('hidden');
    }, 2000);

    initializeAuthListeners();
    initializeUIListeners();
});

// ===========================================
// AUTENTICACIÓN
// ===========================================

function initializeAuthListeners() {
    // Monitor de estado de autenticación
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            await loadUserData();
            showMainApp();
        } else {
            currentUser = null;
            showAuthScreen();
        }
    });

    // Formulario de login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email-login').value;
        const password = document.getElementById('password-login').value;
        
        try {
            await auth.signInWithEmailAndPassword(email, password);
            showNotification('¡Inicio de sesión exitoso!', 'success');
        } catch (error) {
            showNotification('Error al iniciar sesión: ' + error.message, 'error');
        }
    });

    // Formulario de registro
    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('nombre-register').value;
        const email = document.getElementById('email-register').value;
        const password = document.getElementById('password-register').value;
        const rol = document.getElementById('rol-register').value;
        const organizacion = document.getElementById('organizacion-register').value;
        
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Crear documento del usuario en Firestore
            await db.collection('usuarios').doc(user.uid).set({
                nombre: nombre,
                email: email,
                rol: rol,
                organizacion: organizacion || '',
                fechaRegistro: firebase.firestore.FieldValue.serverTimestamp(),
                activo: true
            });
            
            showNotification('¡Registro exitoso!', 'success');
        } catch (error) {
            showNotification('Error al registrarse: ' + error.message, 'error');
        }
    });

    // Login con Google
    document.getElementById('login-google').addEventListener('click', async () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            const result = await auth.signInWithPopup(provider);
            const user = result.user;
            
            // Verificar si es usuario nuevo
            const userDoc = await db.collection('usuarios').doc(user.uid).get();
            if (!userDoc.exists) {
                // Crear documento para nuevo usuario
                await db.collection('usuarios').doc(user.uid).set({
                    nombre: user.displayName,
                    email: user.email,
                    rol: 'usuario', // Por defecto usuario
                    organizacion: '',
                    fechaRegistro: firebase.firestore.FieldValue.serverTimestamp(),
                    activo: true
                });
            }
            
            showNotification('¡Inicio de sesión exitoso!', 'success');
        } catch (error) {
            showNotification('Error al iniciar sesión con Google: ' + error.message, 'error');
        }
    });

    // Alternar entre login y registro
    document.getElementById('show-register').addEventListener('click', () => {
        document.querySelector('#auth-screen > div > div:first-child').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    });

    document.getElementById('show-login').addEventListener('click', () => {
        document.getElementById('register-form').classList.add('hidden');
        document.querySelector('#auth-screen > div > div:first-child').classList.remove('hidden');
    });

    // Mostrar campo organización para recicladores
    document.getElementById('rol-register').addEventListener('change', (e) => {
        const orgField = document.getElementById('organizacion-field');
        if (e.target.value === 'reciclador') {
            orgField.classList.remove('hidden');
            document.getElementById('organizacion-register').required = true;
        } else {
            orgField.classList.add('hidden');
            document.getElementById('organizacion-register').required = false;
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        try {
            await auth.signOut();
            showNotification('Sesión cerrada', 'info');
        } catch (error) {
            showNotification('Error al cerrar sesión', 'error');
        }
    });
}

async function loadUserData() {
    try {
        const userDoc = await db.collection('usuarios').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            userRole = userData.rol;
            document.getElementById('user-name').textContent = userData.nombre;
        }
    } catch (error) {
        console.error('Error al cargar datos del usuario:', error);
    }
}

function showAuthScreen() {
    authScreen.classList.remove('hidden');
    appContainer.classList.add('hidden');
}

function showMainApp() {
    authScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
    
    // Mostrar módulo según el rol
    if (userRole === 'usuario') {
        document.getElementById('usuario-module').classList.remove('hidden');
        document.getElementById('reciclador-module').classList.add('hidden');
        loadSolicitudesActivas();
    } else if (userRole === 'reciclador') {
        document.getElementById('reciclador-module').classList.remove('hidden');
        document.getElementById('usuario-module').classList.add('hidden');
        loadSolicitudesDisponibles();
    }
}

// ===========================================
// NAVEGACIÓN Y UI
// ===========================================

function initializeUIListeners() {
    // Navegación Usuario
    document.getElementById('nueva-solicitud-btn').addEventListener('click', () => {
        showScreen('nueva-solicitud');
        initializeUserMap();
    });

    document.getElementById('historial-usuario-btn').addEventListener('click', () => {
        showScreen('historial-usuario');
        loadHistorialUsuario();
    });

    document.getElementById('back-to-home').addEventListener('click', () => {
        showScreen('usuario-home');
    });

    document.getElementById('back-historial-usuario').addEventListener('click', () => {
        showScreen('usuario-home');
    });

    // Navegación Reciclador
    document.getElementById('mapa-solicitudes-btn').addEventListener('click', () => {
        showScreen('mapa-solicitudes');
        initializeRecicladorMap();
    });

    document.getElementById('historial-reciclador-btn').addEventListener('click', () => {
        showScreen('historial-reciclador');
        loadHistorialReciclador();
    });

    document.getElementById('back-mapa-solicitudes').addEventListener('click', () => {
        showScreen('reciclador-home');
    });

    document.getElementById('back-historial-reciclador').addEventListener('click', () => {
        showScreen('reciclador-home');
    });

    // Formulario de solicitud
    document.getElementById('formSolicitud').addEventListener('submit', handleSolicitudSubmit);
    
    // Tipo de recolección
    document.querySelectorAll('input[name="tipoRecoleccion"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const programacionFields = document.getElementById('programacion-fields');
            if (e.target.value === 'programada') {
                programacionFields.classList.remove('hidden');
                // Establecer fecha mínima como hoy
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('fecha-programada').min = today;
            } else {
                programacionFields.classList.add('hidden');
            }
        });
    });

    // Foto del residuo
    document.getElementById('foto-btn').addEventListener('click', () => {
        document.getElementById('fotoResiduo').click();
    });

    document.getElementById('fotoResiduo').addEventListener('change', handlePhotoPreview);

    // Calificación
    initializeRatingSystem();
}

function showScreen(screenId) {
    // Ocultar todas las pantallas
    document.querySelectorAll('[id$="-home"], [id^="nueva-"], [id^="historial-"], [id^="mapa-"], [id^="seguimiento-"], [id^="servicio-"]').forEach(screen => {
        screen.classList.add('hidden');
    });
    
    // Mostrar pantalla solicitada
    document.getElementById(screenId).classList.remove('hidden');
}

// ===========================================
// MAPA - USUARIO
// ===========================================

function initializeUserMap() {
    setTimeout(() => {
        if (typeof google !== 'undefined') {
            const mapElement = document.getElementById('map-usuario');
            
            // Bogotá como ubicación por defecto
            const bogota = { lat: 4.7110, lng: -74.0721 };
            
            map = new google.maps.Map(mapElement, {
                zoom: 13,
                center: bogota,
                styles: [
                    {
                        featureType: 'poi',
                        elementType: 'labels',
                        stylers: [{ visibility: 'off' }]
                    }
                ]
            });

            // Intentar obtener ubicación actual
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const userLocation = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        };
                        map.setCenter(userLocation);
                        selectedLocation = userLocation;
                        
                        marker = new google.maps.Marker({
                            position: userLocation,
                            map: map,
                            draggable: true,
                            title: 'Ubicación de recolección'
                        });

                        marker.addListener('dragend', () => {
                            selectedLocation = {
                                lat: marker.getPosition().lat(),
                                lng: marker.getPosition().lng()
                            };
                        });
                    },
                    () => {
                        // Si no se puede obtener la ubicación, usar Bogotá
                        selectedLocation = bogota;
                        marker = new google.maps.Marker({
                            position: bogota,
                            map: map,
                            draggable: true,
                            title: 'Ubicación de recolección'
                        });
                    }
                );
            }

            // Click en el mapa para colocar marcador
            map.addListener('click', (e) => {
                selectedLocation = {
                    lat: e.latLng.lat(),
                    lng: e.latLng.lng()
                };

                if (marker) {
                    marker.setPosition(selectedLocation);
                } else {
                    marker = new google.maps.Marker({
                        position: selectedLocation,
                        map: map,
                        draggable: true,
                        title: 'Ubicación de recolección'
                    });
                }
            });
        }
    }, 500);
}

// ===========================================
// MAPA - RECICLADOR
// ===========================================

function initializeRecicladorMap() {
    setTimeout(() => {
        if (typeof google !== 'undefined') {
            const mapElement = document.getElementById('map-reciclador');
            const bogota = { lat: 4.7110, lng: -74.0721 };
            
            recicladorMap = new google.maps.Map(mapElement, {
                zoom: 12,
                center: bogota
            });

            // Cargar solicitudes en el mapa
            loadSolicitudesEnMapa();
        }
    }, 500);
}

async function loadSolicitudesEnMapa() {
    try {
        const solicitudesSnapshot = await db.collection('solicitudes')
            .where('estado', '==', 'pendiente')
            .get();

        solicitudesSnapshot.forEach(doc => {
            const solicitud = doc.data();
            const solicitudId = doc.id;

            if (solicitud.ubicacion) {
                const marker = new google.maps.Marker({
                    position: {
                        lat: solicitud.ubicacion.lat,
                        lng: solicitud.ubicacion.lng
                    },
                    map: recicladorMap,
                    title: `${solicitud.tipoResiduo} - ${solicitud.cantidad || 'N/A'}`,
                    icon: {
                        url: solicitud.tipoRecoleccion === 'inmediata' 
                            ? 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"%3E%3Ccircle cx="10" cy="10" r="8" fill="%23ef4444"/%3E%3C/svg%3E'
                            : 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"%3E%3Ccircle cx="10" cy="10" r="8" fill="%233b82f6"/%3E%3C/svg%3E',
                        scaledSize: new google.maps.Size(20, 20)
                    }
                });

                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div class="p-2">
                            <h4 class="font-bold">${solicitud.tipoResiduo}</h4>
                            <p>Cantidad: ${solicitud.cantidad || 'No especificada'}</p>
                            <p>Tipo: ${solicitud.tipoRecoleccion}</p>
                            <button onclick="aceptarSolicitud('${solicitudId}')" 
                                    class="mt-2 bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">
                                Aceptar
                            </button>
                        </div>
                    `
                });

                marker.addListener('click', () => {
                    infoWindow.open(recicladorMap, marker);
                });
            }
        });
    } catch (error) {
        console.error('Error al cargar solicitudes en mapa:', error);
    }
}

// ===========================================
// SOLICITUDES
// ===========================================

async function handleSolicitudSubmit(e) {
    e.preventDefault();
    
    if (!selectedLocation) {
        showNotification('Por favor, selecciona una ubicación en el mapa', 'error');
        return;
    }

    const tipoResiduo = document.querySelector('input[name="tipoResiduo"]:checked')?.value;
    const tipoRecoleccion = document.querySelector('input[name="tipoRecoleccion"]:checked')?.value;
    const cantidadPeso = document.getElementById('cantidad-peso').value;
    const cantidadBolsas = document.getElementById('cantidad-bolsas').value;
    
    if (!tipoResiduo || !tipoRecoleccion) {
        showNotification('Por favor, completa todos los campos requeridos', 'error');
        return;
    }

    try {
        const solicitudData = {
            userId: currentUser.uid,
            tipoResiduo: tipoResiduo,
            tipoRecoleccion: tipoRecoleccion,
            cantidad: {
                peso: cantidadPeso || null,
                bolsas: cantidadBolsas || null
            },
            ubicacion: selectedLocation,
            estado: 'pendiente',
            fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
            recicladorId: null,
            fechaAsignacion: null,
            fechaCompletado: null
        };

        // Si es programada, agregar fecha y hora
        if (tipoRecoleccion === 'programada') {
            const fecha = document.getElementById('fecha-programada').value;
            const hora = document.getElementById('hora-programada').value;
            
            if (!fecha || !hora) {
                showNotification('Por favor, selecciona fecha y hora para la recolección programada', 'error');
                return;
            }
            
            solicitudData.fechaProgramada = new Date(`${fecha}T${hora}`);
        }

        // Subir foto si existe
        const fotoFile = document.getElementById('fotoResiduo').files[0];
        if (fotoFile) {
            const storageRef = storage.ref(`solicitudes/${currentUser.uid}/${Date.now()}_${fotoFile.name}`);
            const uploadTask = await storageRef.put(fotoFile);
            const fotoURL = await uploadTask.ref.getDownloadURL();
            solicitudData.fotoURL = fotoURL;
        }

        await db.collection('solicitudes').add(solicitudData);
        
        showNotification('¡Solicitud creada exitosamente!', 'success');
        
        // Limpiar formulario
        document.getElementById('formSolicitud').reset();
        selectedLocation = null;
        if (marker) {
            marker.setMap(null);
            marker = null;
        }
        
        // Volver a home
        showScreen('usuario-home');
        loadSolicitudesActivas();
        
    } catch (error) {
        console.error('Error al crear solicitud:', error);
        showNotification('Error al crear la solicitud', 'error');
    }
}

async function loadSolicitudesActivas() {
    try {
        const solicitudesSnapshot = await db.collection('solicitudes')
            .where('userId', '==', currentUser.uid)
            .where('estado', 'in', ['pendiente', 'asignada', 'en_camino', 'en_sitio'])
            .orderBy('fechaCreacion', 'desc')
            .get();

        const container = document.getElementById('solicitudes-activas');
        container.innerHTML = '';

        if (solicitudesSnapshot.empty) {
            container.innerHTML = '<p class="text-gray-500 text-center">No tienes solicitudes activas</p>';
            return;
        }

        solicitudesSnapshot.forEach(doc => {
            const solicitud = doc.data();
            const solicitudId = doc.id;
            
            const solicitudElement = createSolicitudElement(solicitud, solicitudId, true);
            container.appendChild(solicitudElement);
        });
    } catch (error) {
        console.error('Error al cargar solicitudes activas:', error);
    }
}

async function loadSolicitudesDisponibles() {
    try {
        const solicitudesSnapshot = await db.collection('solicitudes')
            .where('estado', '==', 'pendiente')
            .orderBy('fechaCreacion', 'desc')
            .limit(10)
            .get();

        const container = document.getElementById('solicitudes-disponibles');
        container.innerHTML = '';

        if (solicitudesSnapshot.empty) {
            container.innerHTML = '<p class="text-gray-500 text-center">No hay solicitudes disponibles</p>';
            return;
        }

        solicitudesSnapshot.forEach(doc => {
            const solicitud = doc.data();
            const solicitudId = doc.id;
            
            const solicitudElement = createSolicitudElement(solicitud, solicitudId, false);
            container.appendChild(solicitudElement);
        });
    } catch (error) {
        console.error('Error al cargar solicitudes disponibles:', error);
    }
}

function createSolicitudElement(solicitud, solicitudId, isUser = false) {
    const div = document.createElement('div');
    div.className = 'bg-gray-50 rounded-xl p-4 border border-gray-200';
    
    const estadoColor = {
        'pendiente': 'bg-yellow-100 text-yellow-800',
        'asignada': 'bg-blue-100 text-blue-800',
        'en_camino': 'bg-purple-100 text-purple-800',
        'en_sitio': 'bg-orange-100 text-orange-800',
        'completada': 'bg-green-100 text-green-800',
        'cancelada': 'bg-red-100 text-red-800'
    };

    const tipoIcons = {
        'PET': 'fas fa-bottle-water text-blue-500',
        'Cartón': 'fas fa-box text-orange-500',
        'Plástico': 'fas fa-recycle text-green-500',
        'Papel': 'fas fa-file-alt text-gray-500'
    };

    const cantidad = solicitud.cantidad ? 
        `${solicitud.cantidad.peso ? solicitud.cantidad.peso + ' kg' : ''} ${solicitud.cantidad.bolsas ? solicitud.cantidad.bolsas + ' bolsas' : ''}`.trim() : 
        'No especificada';

    const fechaCreacion = solicitud.fechaCreacion ? 
        new Date(solicitud.fechaCreacion.toDate()).toLocaleDateString() : 
        'Fecha no disponible';

    div.innerHTML = `
        <div class="flex items-start justify-between mb-3">
            <div class="flex items-center">
                <i class="${tipoIcons[solicitud.tipoResiduo] || 'fas fa-recycle text-gray-500'} text-xl mr-3"></i>
                <div>
                    <h4 class="font-semibold text-gray-800">${solicitud.tipoResiduo}</h4>
                    <p class="text-sm text-gray-600">${cantidad}</p>
                    <p class="text-xs text-gray-500">${fechaCreacion}</p>
                </div>
            </div>
            <span class="px-2 py-1 rounded-full text-xs font-medium ${estadoColor[solicitud.estado] || 'bg-gray-100 text-gray-800'}">
                ${solicitud.estado.charAt(0).toUpperCase() + solicitud.estado.slice(1)}
            </span>
        </div>
        
        ${solicitud.calificacion ? `
            <div class="flex items-center text-sm text-gray-600 mb-2">
                <span class="mr-2">Calificación:</span>
                <div class="flex text-yellow-500">
                    ${'★'.repeat(solicitud.calificacion)}${'☆'.repeat(5 - solicitud.calificacion)}
                </div>
            </div>
        ` : ''}
        
        ${solicitud.comentario ? `
            <p class="text-sm text-gray-600 italic">"${solicitud.comentario}"</p>
        ` : ''}
    `;
    
    return div;
}

async function initializeSeguimiento(solicitudId) {
    try {
        // Escuchar cambios en tiempo real
        const unsubscribe = db.collection('solicitudes').doc(solicitudId)
            .onSnapshot(async (doc) => {
                if (doc.exists) {
                    const solicitud = doc.data();
                    updateEstadoSolicitud(solicitud);
                    
                    if (solicitud.recicladorId) {
                        await loadInfoReciclador(solicitud.recicladorId);
                    }
                }
            });
        
        // Guardar función para limpiar listener cuando sea necesario
        window.currentSeguimientoUnsubscribe = unsubscribe;
        
    } catch (error) {
        console.error('Error al inicializar seguimiento:', error);
    }
}

function updateEstadoSolicitud(solicitud) {
    const container = document.getElementById('estado-solicitud');
    
    const estados = {
        'pendiente': {
            icon: 'fas fa-clock',
            color: 'text-yellow-600',
            titulo: 'Solicitud Pendiente',
            descripcion: 'Esperando que un reciclador acepte tu solicitud'
        },
        'asignada': {
            icon: 'fas fa-user-check',
            color: 'text-blue-600',
            titulo: 'Reciclador Asignado',
            descripcion: 'Un reciclador ha aceptado tu solicitud'
        },
        'en_camino': {
            icon: 'fas fa-route',
            color: 'text-purple-600',
            titulo: 'En Camino',
            descripcion: 'El reciclador se dirige a tu ubicación'
        },
        'en_sitio': {
            icon: 'fas fa-map-marker-alt',
            color: 'text-orange-600',
            titulo: 'En el Sitio',
            descripcion: 'El reciclador ha llegado a tu ubicación'
        },
        'completada': {
            icon: 'fas fa-check-circle',
            color: 'text-green-600',
            titulo: 'Completada',
            descripcion: 'La recolección ha sido completada exitosamente'
        }
    };
    
    const estadoInfo = estados[solicitud.estado] || estados['pendiente'];
    
    container.innerHTML = `
        <div class="text-center mb-6">
            <i class="${estadoInfo.icon} text-4xl ${estadoInfo.color} mb-3"></i>
            <h3 class="text-xl font-bold text-gray-800">${estadoInfo.titulo}</h3>
            <p class="text-gray-600">${estadoInfo.descripcion}</p>
        </div>
        
        <div class="bg-gray-50 rounded-xl p-4">
            <h4 class="font-semibold text-gray-800 mb-2">Detalles de la Solicitud</h4>
            <div class="space-y-1 text-sm text-gray-600">
                <p><span class="font-medium">Tipo:</span> ${solicitud.tipoResiduo}</p>
                <p><span class="font-medium">Cantidad:</span> ${solicitud.cantidad ? 
                    `${solicitud.cantidad.peso || ''} ${solicitud.cantidad.bolsas || ''}`.trim() : 
                    'No especificada'}</p>
                <p><span class="font-medium">Recolección:</span> ${solicitud.tipoRecoleccion}</p>
                ${solicitud.fechaProgramada ? 
                    `<p><span class="font-medium">Programada para:</span> ${new Date(solicitud.fechaProgramada.toDate()).toLocaleString()}</p>` : 
                    ''}
            </div>
        </div>
    `;
    
    // Mostrar/ocultar información del reciclador
    const infoReciclador = document.getElementById('info-reciclador');
    if (solicitud.recicladorId) {
        infoReciclador.classList.remove('hidden');
    } else {
        infoReciclador.classList.add('hidden');
    }
    
    // Si está completada, mostrar modal de calificación
    if (solicitud.estado === 'completada' && !solicitud.calificacion) {
        setTimeout(() => {
            document.getElementById('modal-calificacion').classList.remove('hidden');
        }, 1000);
    }
}

async function loadInfoReciclador(recicladorId) {
    try {
        const recicladorDoc = await db.collection('usuarios').doc(recicladorId).get();
        if (recicladorDoc.exists) {
            const reciclador = recicladorDoc.data();
            document.getElementById('nombre-reciclador').textContent = reciclador.nombre;
            document.getElementById('organizacion-reciclador').textContent = reciclador.organizacion || 'Reciclador independiente';
        }
    } catch (error) {
        console.error('Error al cargar información del reciclador:', error);
    }
}

async function initializeServicioActivo(solicitudId) {
    try {
        // Escuchar cambios en la solicitud
        const unsubscribe = db.collection('solicitudes').doc(solicitudId)
            .onSnapshot(async (doc) => {
                if (doc.exists) {
                    const solicitud = doc.data();
                    updateServicioActivo(solicitud, solicitudId);
                }
            });
        
        window.currentServicioUnsubscribe = unsubscribe;
        
    } catch (error) {
        console.error('Error al inicializar servicio activo:', error);
    }
}

function updateServicioActivo(solicitud, solicitudId) {
    // Actualizar información del usuario
    document.getElementById('tipo-residuo-servicio').textContent = solicitud.tipoResiduo;
    document.getElementById('cantidad-servicio').textContent = solicitud.cantidad ? 
        `${solicitud.cantidad.peso || ''} ${solicitud.cantidad.bolsas || ''}`.trim() : 
        'No especificada';
    
    // Calcular distancia (simulada por ahora)
    document.getElementById('distancia-servicio').textContent = '1.2 km';
    
    // Configurar botones según el estado
    const marcarLlegada = document.getElementById('marcar-llegada');
    const completarRecoleccion = document.getElementById('completar-recoleccion');
    
    if (solicitud.estado === 'asignada') {
        marcarLlegada.classList.remove('hidden');
        completarRecoleccion.classList.add('hidden');
        
        marcarLlegada.onclick = () => actualizarEstadoSolicitud(solicitudId, 'en_sitio');
    } else if (solicitud.estado === 'en_sitio') {
        marcarLlegada.classList.add('hidden');
        completarRecoleccion.classList.remove('hidden');
        
        completarRecoleccion.onclick = () => actualizarEstadoSolicitud(solicitudId, 'completada');
    }
    
    // Inicializar mapa de ruta si no existe
    if (!followingMap) {
        initializeRutaMap(solicitud.ubicacion);
    }
}

function initializeRutaMap(destino) {
    setTimeout(() => {
        if (typeof google !== 'undefined') {
            const mapElement = document.getElementById('mapa-ruta');
            
            followingMap = new google.maps.Map(mapElement, {
                zoom: 14,
                center: destino
            });
            
            // Marcador del destino
            new google.maps.Marker({
                position: destino,
                map: followingMap,
                title: 'Ubicación de recolección',
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"%3E%3Ccircle cx="15" cy="15" r="12" fill="%23ef4444"/%3E%3Ctext x="15" y="20" text-anchor="middle" fill="white" font-size="16"%3E📍%3C/text%3E%3C/svg%3E',
                    scaledSize: new google.maps.Size(30, 30)
                }
            });
            
            // Intentar obtener ubicación actual del reciclador
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((position) => {
                    const currentLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    
                    // Marcador de ubicación actual
                    new google.maps.Marker({
                        position: currentLocation,
                        map: followingMap,
                        title: 'Tu ubicación',
                        icon: {
                            url: 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"%3E%3Ccircle cx="10" cy="10" r="8" fill="%2310b981"/%3E%3C/svg%3E',
                            scaledSize: new google.maps.Size(20, 20)
                        }
                    });
                    
                    // Calcular y mostrar ruta
                    const directionsService = new google.maps.DirectionsService();
                    const directionsRenderer = new google.maps.DirectionsRenderer();
                    directionsRenderer.setMap(followingMap);
                    
                    directionsService.route({
                        origin: currentLocation,
                        destination: destino,
                        travelMode: google.maps.TravelMode.DRIVING
                    }, (result, status) => {
                        if (status === 'OK') {
                            directionsRenderer.setDirections(result);
                        }
                    });
                });
            }
        }
    }, 500);
}

async function actualizarEstadoSolicitud(solicitudId, nuevoEstado) {
    try {
        const updateData = { estado: nuevoEstado };
        
        if (nuevoEstado === 'en_sitio') {
            updateData.fechaLlegada = firebase.firestore.FieldValue.serverTimestamp();
        } else if (nuevoEstado === 'completada') {
            updateData.fechaCompletado = firebase.firestore.FieldValue.serverTimestamp();
        }
        
        await db.collection('solicitudes').doc(solicitudId).update(updateData);
        
        showNotification(`Estado actualizado a: ${nuevoEstado}`, 'success');
        
        if (nuevoEstado === 'completada') {
            // Volver al home después de completar
            setTimeout(() => {
                showScreen('reciclador-home');
                loadSolicitudesDisponibles();
            }, 2000);
        }
        
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        showNotification('Error al actualizar el estado', 'error');
    }
}

// ===========================================
// CALIFICACIÓN Y MODAL
// ===========================================

// Inicializar eventos del modal de calificación
document.getElementById('formCalificacion').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const rating = document.querySelector('.star-btn.text-yellow-500') ? 
        document.querySelectorAll('.star-btn.text-yellow-500').length : 0;
    const comentario = document.getElementById('comentario-calificacion').value;
    
    if (rating === 0) {
        showNotification('Por favor, selecciona una calificación', 'warning');
        return;
    }
    
    try {
        // Aquí necesitarías el ID de la solicitud actual
        // Por simplicidad, asumiremos que está disponible globalmente
        const solicitudId = window.currentSolicitudId;
        
        await db.collection('solicitudes').doc(solicitudId).update({
            calificacion: rating,
            comentario: comentario,
            fechaCalificacion: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showNotification('¡Gracias por tu calificación!', 'success');
        document.getElementById('modal-calificacion').classList.add('hidden');
        
        // Limpiar formulario
        document.getElementById('formCalificacion').reset();
        updateStarsRating(0);
        
    } catch (error) {
        console.error('Error al enviar calificación:', error);
        showNotification('Error al enviar la calificación', 'error');
    }
});

document.getElementById('cancelar-calificacion').addEventListener('click', () => {
    document.getElementById('modal-calificacion').classList.add('hidden');
    document.getElementById('formCalificacion').reset();
    updateStarsRating(0);
});

function updateStarsRating(rating) {
    const stars = document.querySelectorAll('.star-btn');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.remove('text-gray-300');
            star.classList.add('text-yellow-500');
        } else {
            star.classList.remove('text-yellow-500');
            star.classList.add('text-gray-300');
        }
    });
}

// ===========================================
// LIMPIEZA Y OPTIMIZACIÓN
// ===========================================

// Limpiar listeners cuando sea necesario
window.addEventListener('beforeunload', () => {
    if (window.currentSeguimientoUnsubscribe) {
        window.currentSeguimientoUnsubscribe();
    }
    if (window.currentServicioUnsubscribe) {
        window.currentServicioUnsubscribe();
    }
});

// Funciones adicionales para mejorar la experiencia
function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        });
    });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distancia en km
}

// Función para formatear fechas
function formatDate(timestamp) {
    if (!timestamp) return 'Fecha no disponible';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Función para validar formularios
function validateForm(formId) {
    const form = document.getElementById(formId);
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('border-red-500');
            isValid = false;
        } else {
            field.classList.remove('border-red-500');
        }
    });
    
    return isValid;
}

// Función para manejar errores de red
function handleNetworkError(error) {
    console.error('Error de red:', error);
    
    if (error.code === 'unavailable') {
        showNotification('Sin conexión a internet. Verifica tu conexión.', 'error');
    } else if (error.code === 'permission-denied') {
        showNotification('Permisos insuficientes. Verifica tu sesión.', 'error');
    } else {
        showNotification('Error de conexión. Intenta nuevamente.', 'error');
    }
}

// Configurar service worker para funcionalidad offline (opcional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker registrado'))
            .catch(() => console.log('Error al registrar Service Worker'));
    });
}

console.log('ReciclApp inicializada correctamente');text-green-800'
    };

    const tipoIcons = {
        'PET': 'fas fa-bottle-water text-blue-500',
        'Cartón': 'fas fa-box text-orange-500',
        'Plástico': 'fas fa-recycle text-green-500',
        'Papel': 'fas fa-file-alt text-gray-500'
    };

    const cantidad = solicitud.cantidad ? 
        `${solicitud.cantidad.peso ? solicitud.cantidad.peso + ' kg' : ''} ${solicitud.cantidad.bolsas ? solicitud.cantidad.bolsas + ' bolsas' : ''}`.trim() : 
        'No especificada';

    div.innerHTML = `
        <div class="flex items-start justify-between mb-3">
            <div class="flex items-center">
                <i class="${tipoIcons[solicitud.tipoResiduo] || 'fas fa-recycle text-gray-500'} text-xl mr-3"></i>
                <div>
                    <h4 class="font-semibold text-gray-800">${solicitud.tipoResiduo}</h4>
                    <p class="text-sm text-gray-600">${cantidad}</p>
                </div>
            </div>
            <span class="px-2 py-1 rounded-full text-xs font-medium ${estadoColor[solicitud.estado] || 'bg-gray-100 text-gray-800'}">
                ${solicitud.estado.charAt(0).toUpperCase() + solicitud.estado.slice(1)}
            </span>
        </div>
        
        <div class="text-sm text-gray-600 mb-3">
            <p><i class="fas fa-clock mr-1"></i> ${solicitud.tipoRecoleccion === 'inmediata' ? 'Inmediata' : 'Programada'}</p>
            ${solicitud.fechaProgramada ? `<p><i class="fas fa-calendar mr-1"></i> ${new Date(solicitud.fechaProgramada.toDate()).toLocaleString()}</p>` : ''}
        </div>
        
        <div class="flex space-x-2">
            ${isUser ? 
                `<button onclick="verSeguimiento('${solicitudId}')" class="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
                    Ver Seguimiento
                </button>` :
                `<button onclick="aceptarSolicitud('${solicitudId}')" class="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-green-600 transition-colors">
                    Aceptar
                </button>`
            }
        </div>
    `;
    
    return div;
}

// ===========================================
// FUNCIONES GLOBALES
// ===========================================

window.aceptarSolicitud = async function(solicitudId) {
    try {
        await db.collection('solicitudes').doc(solicitudId).update({
            estado: 'asignada',
            recicladorId: currentUser.uid,
            fechaAsignacion: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showNotification('¡Solicitud aceptada!', 'success');
        loadSolicitudesDisponibles();
        
        // Cambiar a servicio activo
        showScreen('servicio-activo');
        initializeServicioActivo(solicitudId);
        
    } catch (error) {
        console.error('Error al aceptar solicitud:', error);
        showNotification('Error al aceptar la solicitud', 'error');
    }
};

window.verSeguimiento = function(solicitudId) {
    showScreen('seguimiento-solicitud');
    initializeSeguimiento(solicitudId);
};

// ===========================================
// UTILIDADES
// ===========================================

function showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium transform transition-transform duration-300 translate-x-full`;
    
    // Colores según el tipo
    const colors = {
        'success': 'bg-green-500',
        'error': 'bg-red-500',
        'warning': 'bg-yellow-500',
        'info': 'bg-blue-500'
    };
    
    notification.classList.add(colors[type] || colors.info);
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Mostrar notificación
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);
    
    // Ocultar notificación después de 3 segundos
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

function handlePhotoPreview(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('foto-preview');
            const img = document.getElementById('preview-img');
            img.src = e.target.result;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
}

function initializeRatingSystem() {
    const stars = document.querySelectorAll('.star-btn');
    let selectedRating = 0;
    
    stars.forEach(star => {
        star.addEventListener('click', (e) => {
            selectedRating = parseInt(e.target.dataset.rating);
            updateStars(selectedRating);
        });
        
        star.addEventListener('mouseenter', (e) => {
            const rating = parseInt(e.target.dataset.rating);
            updateStars(rating);
        });
    });
    
    document.querySelector('.star-btn').parentElement.addEventListener('mouseleave', () => {
        updateStars(selectedRating);
    });
    
    function updateStars(rating) {
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.remove('text-gray-300');
                star.classList.add('text-yellow-500');
            } else {
                star.classList.remove('text-yellow-500');
                star.classList.add('text-gray-300');
            }
        });
    }
}

async function loadHistorialUsuario() {
    try {
        const solicitudesSnapshot = await db.collection('solicitudes')
            .where('userId', '==', currentUser.uid)
            .orderBy('fechaCreacion', 'desc')
            .get();

        const container = document.getElementById('lista-historial-usuario');
        container.innerHTML = '';

        if (solicitudesSnapshot.empty) {
            container.innerHTML = '<p class="text-gray-500 text-center">No tienes historial de solicitudes</p>';
            return;
        }

        solicitudesSnapshot.forEach(doc => {
            const solicitud = doc.data();
            const solicitudId = doc.id;
            
            const solicitudElement = createHistorialElement(solicitud, solicitudId);
            container.appendChild(solicitudElement);
        });
    } catch (error) {
        console.error('Error al cargar historial:', error);
    }
}

async function loadHistorialReciclador() {
    try {
        const solicitudesSnapshot = await db.collection('solicitudes')
            .where('recicladorId', '==', currentUser.uid)
            .orderBy('fechaCreacion', 'desc')
            .get();

        const container = document.getElementById('lista-historial-reciclador');
        container.innerHTML = '';

        if (solicitudesSnapshot.empty) {
            container.innerHTML = '<p class="text-gray-500 text-center">No tienes historial de recolecciones</p>';
            return;
        }

        solicitudesSnapshot.forEach(doc => {
            const solicitud = doc.data();
            const solicitudId = doc.id;
            
            const solicitudElement = createHistorialElement(solicitud, solicitudId);
            container.appendChild(solicitudElement);
        });
    } catch (error) {
        console.error('Error al cargar historial:', error);
    }
}

function createHistorialElement(solicitud, solicitudId) {
    const div = document.createElement('div');
    div.className = 'bg-white rounded-xl p-4 shadow-sm border border-gray-200';
    
    const estadoColor = {
        'pendiente': 'bg-yellow-100 text-yellow-800',
        'asignada': 'bg-blue-100 text-blue-800',
        'en_camino': 'bg-purple-100 text-purple-800',
        'en_sitio': 'bg-orange-100 text-orange-800',
        'completada': 'bg-green-100
