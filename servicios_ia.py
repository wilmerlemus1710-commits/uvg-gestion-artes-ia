import os
import requests
import urllib.parse
from io import BytesIO
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def generar_y_guardar_arte_institucional(solicitud_id: str):
    try:
        # 1. Consultar la solicitud en Supabase
        res_solicitud = supabase.table("solicitudes").select("*").eq("id", solicitud_id).single().execute()
        solicitud = res_solicitud.data

        if not solicitud:
            raise ValueError(f"No se encontró la solicitud con ID: {solicitud_id}")

        # 2. Construir el prompt estructurado con restricciones estrictas para evitar texto ilegible
        prompt_optimizado = (
            f"Diseño gráfico profesional para pieza institucional universitaria. "
            f"Tipo de arte: {solicitud['tipo_arte']}. "
            f"Tema visual: {solicitud['titulo']}. "
            f"Detalles: {solicitud['descripcion']}. "
            f"Estilo: Limpio, académico, moderno, adaptado a identidad corporativa universitaria. "
            f"IMPORTANTE: NO TEXT, NO LETTERS, NO TYPOGRAPHY, abstract background, clean graphic design elements only."
        )

        # 3. Guardar el prompt
        res_prompt = supabase.table("prompts").insert({
            "solicitud_id": solicitud_id,
            "prompt_original": solicitud['descripcion'],
            "prompt_optimizado": prompt_optimizado,
            "parametros_ia": {"model": "pollinations-free", "size": "1024x1024"}
        }).execute()
        
        prompt_id = res_prompt.data[0]["id"]

        # 4. Generar la imagen usando API pública y gratuita
        prompt_encoded = urllib.parse.quote(prompt_optimizado)
        image_url_temp = f"https://image.pollinations.ai/prompt/{prompt_encoded}?width=1024&height=1024&seed=42"

        # 5. Descargar los bytes de la imagen
        img_response = requests.get(image_url_temp)
        if img_response.status_code != 200:
            raise Exception("Error al descargar la imagen generada")

        image_bytes = BytesIO(img_response.content).getvalue()

        # 6. Subir al bucket de Supabase Storage
        file_path = f"solicitudes/{solicitud_id}/{prompt_id}.png"
        bucket_name = "artes-institucionales"

        supabase.storage.from_(bucket_name).upload(
            path=file_path,
            file=image_bytes,
            file_options={"content-type": "image/png"}
        )

        # 7. Obtener la URL pública y registrar en la BD
        public_url = supabase.storage.from_(bucket_name).get_public_url(file_path)

        supabase.table("artes_generados").insert({
            "solicitud_id": solicitud_id,
            "prompt_id": prompt_id,
            "imagen_url": public_url,
            "es_seleccionado": False
        }).execute()

        supabase.table("solicitudes").update({"estado": "generado"}).eq("id", solicitud_id).execute()

        return {"status": "success", "solicitud_id": solicitud_id, "imagen_url": public_url}

    except Exception as e:
        print(f"Error procesando la solicitud: {str(e)}")
        return {"status": "error", "message": str(e)}