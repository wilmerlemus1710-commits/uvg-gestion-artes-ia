import os
from io import BytesIO
import requests
from dotenv import load_dotenv
from supabase import create_client

# Cargar variables de entorno
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def generar_y_guardar_arte_institucional(solicitud_id: str):
  print(
      f"--> Procesando solicitud ID: {solicitud_id} con normas institucionales"
      " UVG..."
  )

  # 1. Obtener los datos reales del formulario desde la tabla 'solicitudes'
  response = (
      supabase.table("solicitudes")
      .select("titulo, descripcion, tipo_arte")
      .eq("id", solicitud_id)
      .execute()
  )

  if not response.data or len(response.data) == 0:
    print(f"Error: No se encontró la solicitud con ID {solicitud_id}")
    return

  solicitud = response.data[0]
  titulo = solicitud.get("titulo", "Evento Universitario")
  descripcion = solicitud.get(
      "descripcion", "Ilustración abstracta institucional"
  )
  tipo_arte = solicitud.get("tipo_arte", "Banner Web")

  print(f"Título obtenido: {titulo}")
  print(f"Tipo de arte: {tipo_arte}")

  # 2. Construir el prompt optimizado fusionando el formulario y el Brandbook de UVG
  prompt_institucional = (
      f"Professional vector art, minimalist abstract graphic design for a university event. "
      f"Context/Title: {titulo}. "
      f"Description details: {descripcion}. "
      f"Visual style: Modern corporate branding, clean geometric shapes, elegant composition, "
      f"high-end graphic design style. Color palette aligned with UVG institutional green tones "
      f"and professional academic aesthetics. "
      f"STRICTLY NO TEXT, NO LETTERS, NO TYPOGRAPHY, NO WATERMARKS, NO NUMBERS."
  )

  # Codificar el prompt para la URL de la API de generación (Pollinations o servicio configurado)
  prompt_encoded = requests.utils.quote(prompt_institucional)
  url_ia = f"https://image.pollinations.ai/prompt/{prompt_encoded}?width=1200&height=630&nologo=true"

  print("Generando imagen estilizada con la IA...")
  img_response = requests.get(url_ia)

  if img_response.status_code != 200:
    print(f"Error al generar la imagen con la IA: {img_response.status_code}")
    return

  image_bytes = BytesIO(img_response.content).getvalue()

  # 3. Subir el archivo resultante al Storage de Supabase
  file_path = f"solicitudes/{solicitud_id}/arte_generado.png"
  bucket_name = "artes-institucionales"

  print(f"Subiendo archivo a Supabase Storage: {file_path}")

  # Subir imagen (reemplazando si ya existe)
  storage_response = supabase.storage.from_(bucket_name).upload(
      file_path,
      image_bytes,
      file_options={"content-type": "image/png", "upsert": "true"},
  )

  print("¡Arte institucional generado y guardado exitosamente en Supabase!")