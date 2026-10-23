from servicios_ia import supabase, generar_y_guardar_arte_institucional

def procesar_siguiente_solicitud_prioritaria():
    print("Consultando la cola de trabajo en Supabase...")
    
    # Consultar solicitudes pendientes ordenadas por mayor puntuación y fecha de evento más cercana
    res = supabase.table("solicitudes") \
        .select("id, titulo, puntuacion_total, clasificacion_prioridad") \
        .eq("estado", "pendiente") \
        .order("puntuacion_total", { "ascending": False }) \
        .order("fecha_evento", { "ascending": True }) \
        .limit(1) \
        .execute()
    
    pendientes = res.data

    if not pendientes or len(pendientes) == 0:
        print("No hay solicitudes pendientes en la cola de trabajo.")
        return

    siguiente = pendientes[0]
    solicitud_id = siguiente["id"]
    
    print(f"\n[Prioridad Detectada]")
    print(f"- Título: {siguiente['titulo']}")
    print(f"- Puntuación del Motor: {siguiente['puntuacion_total']} ({siguiente['clasificacion_prioridad']})")
    print(f"- ID: {solicitud_id}")
    print("Iniciando generación automática de arte institucional con IA...\n")

    # Ejecutar el servicio de IA para generar y subir la imagen
    resultado = generar_y_guardar_arte_institucional(solicitud_id)
    
    print("Resultado del proceso:")
    print(resultado)

if __name__ == "__main__":
    procesar_siguiente_solicitud_prioritaria()