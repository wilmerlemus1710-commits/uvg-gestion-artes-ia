import os
from io import BytesIO
import openai
from dotenv import load_dotenv
from supabase import create_client

# Cargar variables de entorno
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Inicializar clientes
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
client = openai.OpenAI(api_key=OPENAI_API_KEY)


def generar_y_guardar_arte_institucional(solicitud_id: str):
  print(
      f"--> Procesando solicitud ID: {solicitud_id} con DALL-E 3 y normas UVG..."
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

  # 2. Construir el prompt optimizado para DALL-E 3 alineado al Brandbook de UVG
  prompt_institucional = (
      f"A professional, minimalist, high-end abstract graphic design for a university event "
      f"titled '{titulo}'. Description context: {descripcion}. "
      f"Style: Modern corporate branding, clean geometric composition, elegant visual flow, "
      f"high-resolution vector aesthetic. Color palette featuring sophisticated academic tones "
      f"and institutional green accents. "
      f"CRITICAL CONSTRAINT: ABSOLUTELY NO TEXT, NO LETTERS, NO TYPOGRAPHY, NO WORDS, NO NUMBERS OF ANY KIND IN THE IMAGE."
  )

  print("Generando imagen de alta calidad con DALL-E 3...")

  try:
    # Llamada oficial a la API de OpenAI para DALL-E 3
    ai_response = client.images.generate(
        model="dall-e-3",
        prompt=prompt_institucional,
        size="1024x1024",
        quality="standard",
        n=1,
    )

    image_url = ai_response.data[0].url

    # Descargar los bytes de la imagen generada por OpenAI
    import requests

    img_response = requests.get(image_url)
    if img_response.status_code != 200:
      print("Error al descargar la imagen generada por OpenAI.")
      return

    image_bytes = BytesIO(img_response.content).getvalue()

  except Exception as e:
    print(f"Ocurrió un error al conectar con la API de OpenAI: {e}")
    return

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

  print(
      "¡Arte institucional de alta calidad generado y guardado exitosamente en"
      " Supabase!"
  )