// Cliente directo y seguro para Supabase via CDN global
const SUPABASE_URL = "https://wngnenmnhbxzkhgvkjte.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jW-6n-AYl7NiEw8vWhV4mg_KRf-G-DW";

// Inicialización protegida en objeto global
if (!window.dbClient) {
    window.dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
const db = window.dbClient;

// Función global asegurada para el botón salir
window.cerrarSesion = function() {
    localStorage.removeItem("usuarioActual");
    window.location.href = "index.html";
};

document.addEventListener("DOMContentLoaded", () => {
    const usuarioGuardado = localStorage.getItem("usuarioActual");
    const paginaActual = window.location.pathname;

    if (usuarioGuardado) {
        window.usuarioActual = JSON.parse(usuarioGuardado);
        
        const infoUser = document.getElementById("info-usuario");
        if (infoUser) {
            infoUser.innerText = `${window.usuarioActual.nombre || window.usuarioActual.email} (${(window.usuarioActual.rol || 'solicitante').toUpperCase()})`;
        }

        const inputCorreo = document.getElementById("correo_solicitante");
        if (inputCorreo) {
            inputCorreo.value = window.usuarioActual.email;
        }

        if (paginaActual.includes("admin.html")) {
            cargarDashboardJefe();
        } else if (paginaActual.includes("disenador.html")) {
            cargarColaDisenador();
        }
    } else {
        if (!paginaActual.includes("index.html") && paginaActual !== "/" && !paginaActual.endsWith("/")) {
            window.location.href = "index.html";
        }
    }

    const formSol = document.getElementById("form-solicitud");
    if (formSol) {
        formSol.addEventListener("submit", registrarSolicitud);
    }
});

async function registrarSolicitud(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-enviar");
    btn.disabled = true;
    btn.innerText = "Procesando solicitud...";

    const fechaEventoStr = document.getElementById("fecha_evento").value;
    const fechaEvento = new Date(fechaEventoStr);
    const hoy = new Date();
    
    // 1. PROXIMIDAD AUTOMÁTICA (Basada en días restantes)
    const diferenciaDias = Math.ceil((fechaEvento - hoy) / (1000 * 60 * 60 * 24));
    let proximidadValor = diferenciaDias <= 2 ? 5 : diferenciaDias <= 4 ? 4 : diferenciaDias <= 7 ? 3 : diferenciaDias <= 14 ? 2 : 1;

    // Obtener los datos ingresados por el usuario
    const tipoArte = document.getElementById("tipo_arte").value;
    const titulo = document.getElementById("titulo").value.toLowerCase();
    const descripcion = document.getElementById("descripcion").value.toLowerCase();

    // 2. IMPACTO AUTOMÁTICO (Inferido por tipo de arte o palabras clave)
    let impactoValor = 3; // Valor por defecto (Medio)
    if (titulo.includes("congreso") || titulo.includes("internacional") || titulo.includes("graduación") || tipoArte === "Afiche Digital") {
        impactoValor = 5; // Estratégico / Alto
    } else if (titulo.includes("reunión") || titulo.includes("interno")) {
        impactoValor = 2; // Bajo
    }

    // 3. ALCANCE AUTOMÁTICO (Inferido según el tipo de requerimiento)
    let alcanceValor = 3; // Valor por defecto (Varias facultades)
    if (tipoArte === "Banner Web" || titulo.includes("campus") || titulo.includes("general")) {
        alcanceValor = 4; // Campus completo
    } else if (titulo.includes("facultad") || titulo.includes("ingeniería") || titulo.includes("departamento")) {
        alcanceValor = 2; // Una facultad o departamento
    }

    // 4. COMPLEJIDAD AUTOMÁTICA (Inferida según el tipo de arte)
    let complejidadValor = 3; // Estándar por defecto
    if (tipoArte === "Afiche Digital" || titulo.includes("campaña")) {
        complejidadValor = 5; // Campaña o múltiples piezas complejas
    } else if (titulo.includes("cambio") || titulo.includes("actualizar")) {
        complejidadValor = 1; // Modificación sencilla
    }

    const adminValor = 3; // Ponderación administrativa base

    // CÁLCULO DE LA PUNTUACIÓN TOTAL CON LOS PESOS INSTITUCIONALES
    const puntuacionTotal = (
        (proximidadValor * 0.30) +
        (impactoValor * 0.25) +
        (alcanceValor * 0.15) +
        (complejidadValor * 0.10) +
        (adminValor * 0.20)
    ).toFixed(2);

    let clasificacion = puntuacionTotal >= 4.20 ? "Crítica" : puntuacionTotal >= 3.50 ? "Alta" : puntuacionTotal >= 2.50 ? "Media" : "Baja";

    // Objeto listo para insertar de forma transparente en Supabase
    const nuevaSolicitud = {
        solicitante_email: window.usuarioActual ? window.usuarioActual.email : 'desconocido@uvg.edu.gt',
        titulo: document.getElementById("titulo").value,
        tipo_arte: tipoArte,
        descripcion: document.getElementById("descripcion").value,
        fecha_evento: fechaEventoStr,
        proximidad_valor: proximidadValor,
        impacto_valor: impactoValor,
        alcance_valor: alcanceValor,
        complejidad_valor: complejidadValor,
        admin_valor: adminValor,
        puntuacion_total: parseFloat(puntuacionTotal),
        clasificacion_prioridad: clasificacion,
        prioridad: clasificacion.toLowerCase(),
        estado: "pendiente"
    };

    const { error } = await db.from("solicitudes").insert([nuevaSolicitud]);

    if (error) {
        alert("Error al registrar: " + error.message);
    } else {
        alert("¡Solicitud enviada con éxito! El motor institucional la ha evaluado y priorizado automáticamente.");
        document.getElementById("form-solicitud").reset();
        if(window.usuarioActual) {
            document.getElementById("correo_solicitante").value = window.usuarioActual.email;
        }
    }

    btn.disabled = false;
    btn.innerText = "Enviar Solicitud";
}

async function cargarDashboardJefe() {
    const { data: solicitudes, error } = await db
        .from("solicitudes")
        .select(`*, artes_generados (*)`)
        .order("puntuacion_total", { ascending: false });

    if (error) return;

    document.getElementById("stat-total").innerText = solicitudes.length;
    document.getElementById("stat-pendientes").innerText = solicitudes.filter(s => s.estado === 'pendiente').length;
    document.getElementById("stat-generados").innerText = solicitudes.filter(s => s.estado === 'en_revision' || s.estado === 'generado').length;
    document.getElementById("stat-criticas").innerText = solicitudes.filter(s => s.clasificacion_prioridad === 'Crítica').length;

    const tbody = document.getElementById("tabla-jefe-body");
    if (!solicitudes.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500">No hay registros en el sistema.</td></tr>`;
        return;
    }

    tbody.innerHTML = "";
    solicitudes.forEach(s => {
        const fechaIngreso = new Date(s.created_at || Date.now());
        const hoy = new Date();
        const horasTranscurridas = Math.floor((hoy - fechaIngreso) / (1000 * 60 * 60));
        const tiempoTexto = horasTranscurridas < 24 ? `${horasTranscurridas} hrs` : `${Math.floor(horasTranscurridas / 24)} días`;

        const tr = document.createElement("tr");
        tr.className = "border-b border-slate-200 hover:bg-slate-50";
        tr.innerHTML = `
            <td class="p-3 text-slate-600 font-medium">${s.solicitante_email || 'N/D'}</td>
            <td class="p-3 font-semibold text-slate-900">${s.titulo}</td>
            <td class="p-3 text-slate-600">${s.tipo_arte}</td>
            <td class="p-3 text-slate-600">${s.fecha_evento}</td>
            <td class="p-3 font-bold ${s.clasificacion_prioridad === 'Crítica' ? 'text-red-600' : 'text-emerald-700'}">${s.clasificacion_prioridad} (${s.puntuacion_total})</td>
            <td class="p-3 text-slate-600 font-medium">⏱️ ${tiempoTexto}</td>
            <td class="p-3"><span class="px-2 py-1 rounded text-[10px] font-semibold ${s.estado === 'pendiente' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}">${s.estado}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

async function cargarColaDisenador() {
    const galeria = document.getElementById("galeria-artes");
    if (!galeria) return;

    const { data: solicitudes, error } = await db
        .from("solicitudes")
        .select(`*, artes_generados (*)`)
        .order("puntuacion_total", { ascending: false });

    if (error || !solicitudes || solicitudes.length === 0) {
        galeria.innerHTML = `<p class="text-slate-500 text-xs col-span-3 text-center py-8">No hay solicitudes pendientes en la cola de diseño.</p>`;
        return;
    }

    const usuarioActual = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
    const esAdminOJefe = usuarioActual.rol === 'jefe' || usuarioActual.rol === 'admin' || usuarioActual.rol === 'disenador';

    galeria.innerHTML = "";
    solicitudes.forEach(sol => {
        const arte = sol.artes_generados && sol.artes_generados.length > 0 ? sol.artes_generados[0] : null;
        
        const tarjeta = document.createElement("div");
        tarjeta.className = "bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between gap-4";
        tarjeta.innerHTML = `
            <div>
                <div class="flex justify-between items-center mb-2">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        sol.clasificacion_prioridad === 'Crítica' ? 'bg-red-100 text-red-700' :
                        sol.clasificacion_prioridad === 'Alta' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }">${sol.clasificacion_prioridad} (${sol.puntuacion_total})</span>
                    <span class="text-[11px] text-slate-400">Evento: ${sol.fecha_evento}</span>
                </div>
                <h4 class="font-bold text-slate-900 text-sm mb-1">${sol.titulo}</h4>
                <p class="text-xs text-emerald-700 font-semibold mb-1">${sol.tipo_arte}</p>
                <p class="text-[11px] text-slate-500 mb-2">Solicitante: <span class="font-medium text-slate-700">${sol.solicitante_email || 'N/D'}</span></p>
                <p class="text-xs text-slate-600 bg-slate-50 p-2 rounded">${sol.descripcion}</p>
            </div>
            <div>
                ${arte ? `
                    <img src="${arte.imagen_url}" alt="Arte" class="w-full h-32 object-cover rounded-lg mb-2 border">
                    <span class="block text-center bg-emerald-100 text-emerald-800 text-xs font-semibold py-1.5 rounded-lg">✔ Arte Creado y Aprobado</span>
                ` : esAdminOJefe ? `
                    <button onclick="aceptarYGenerarArte('${sol.id}', '${sol.titulo}')" class="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer shadow">
                        Aceptar y Generar Arte 🎨
                    </button>
                ` : `
                    <span class="block text-center bg-slate-100 text-slate-500 text-xs font-medium py-2 rounded-lg">Pendiente de revisión</span>
                `}
            </div>
        `;
        galeria.appendChild(tarjeta);
    });
}

async function aceptarYGenerarArte(solicitudId, titulo) {
    if (!confirm(`¿Deseas aceptar la solicitud "${titulo}" para iniciar la creación y almacenamiento dinámico del arte gráfico?`)) return;

    try {
        // 1. Crear un canvas dinámico localmente (evita bloqueos de CORS y genera un archivo real por solicitud)
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');
        
        // Fondo institucional elegante
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Texto dinámico con el título de la solicitud del usuario
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText("UVG Campus Sur - Arte Institucional", 50, 80);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        // Ajustar texto largo si es necesario
        ctx.fillText(titulo.length > 35 ? titulo.substring(0, 32) + "..." : titulo, 50, 160);
        
        ctx.fillStyle = '#94a3b8';
        ctx.font = '20px sans-serif';
        ctx.fillText("Estado: Generado y Aprobado en tiempo real", 50, 240);

        // Convertir el canvas a un Blob (archivo de imagen binario)
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));

        // 2. Definir la ruta dinámica única en tu Supabase Storage basada en el ID de la solicitud
        const filePath = `solicitudes/${solicitudId}/arte_generado.jpg`;

        // 3. Subir el archivo real al bucket 'artes-institucional' de Supabase Storage
        const { error: uploadError } = await db.storage
            .from('artes-institucional')
            .upload(filePath, blob, { upsert: true });

        if (uploadError) {
            console.error("Error al subir al storage:", uploadError);
            alert("Error al subir al storage: " + uploadError.message);
            return;
        }

        // 4. Obtener la URL pública oficial generada por el Storage para esta solicitud
        const { data: urlData } = db.storage
            .from('artes-institucional')
            .getPublicUrl(filePath);

        const urlFinalStorage = urlData.publicUrl;

        // 5. Guardar el registro en la tabla artes_generados con la URL dinámica del Storage
        const { error: errorArte } = await db.from("artes_generados").insert([{
            solicitud_id: solicitudId,
            imagen_url: urlFinalStorage,
            estado: 'creado'
        }]);

        if (errorArte) {
            alert("Error al registrar en la base de datos: " + errorArte.message);
        } else {
            alert("¡Arte generado, almacenado en el Storage y vinculado con éxito!");
            cargarColaDisenador(); // Refresca la interfaz al instante mostrando la nueva imagen
        }
    } catch (e) {
        console.error("Excepción:", e);
        alert("Ocurrió un error al procesar el archivo multimedia.");
    }
}