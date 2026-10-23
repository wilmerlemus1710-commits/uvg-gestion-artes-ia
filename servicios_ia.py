import os
from io import BytesIO
import openai
from dotenv import load_dotenv
from supabase import create_client
import requests

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
      f"--> Procesando solicitud ID: {solicitud_id} para afiche formal UVG..."
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
  descripcion = solicitud.get("descripcion", "Evento académico institucional")
  tipo_arte = solicitud.get("tipo_arte", "Banner Web")

  print(f"Título obtenido: {titulo}")
  print(f"Tipo de arte: {tipo_arte}")

  # 2. Prompt enfocado en AFICHE / FLYER FORMAL (Estructura corporativa y limpia)
  prompt_afiche = (
      f"A professional formal event poster and promotional flyer background for a university event "
      f"titled '{titulo}'. Context: {descripcion}. "
      f"Design style: Clean corporate graphic design, elegant layout framing with professional empty spaces for text, "
      f"modern academic branding, sophisticated color palette featuring official university green and neutral tones, "
      f"high-end marketing banner aesthetic, crisp vector lines, highly polished visual composition."
  )

  print("Generando afiche formal con DALL-E 2...")

  try:
    # Llamada a DALL-E 2 para afiches y banners formales
    ai_response = client.images.generate(
        model="dall-e-2",
        prompt=prompt_afiche,
        size="1024x1024",  # DALL-E 2 soporta 1024x1024 de manera estándar
        n=1,
    )

    image_url = ai_response.data[0].url

    # Descargar los bytes de la imagen generada
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

  storage_response = supabase.storage.from_(bucket_name).upload(
      file_path,
      image_bytes,
      file_options={"content-type": "image/png", "upsert": "true"},
  )

  print("¡Afiche institucional formal guardado exitosamente en Supabase!")