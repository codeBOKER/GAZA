import io
import base64
from PIL import Image
from cairosvg import svg2png
import os
from django.conf import settings
from datetime import datetime

def convert_and_resize_image(file_bytes, max_size=(800, 800), quality=70):
    
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    file_name = f"converted_{timestamp}.jpeg"
    file_path = os.path.join(settings.MEDIA_ROOT, file_name)

    try:
        if file_bytes.strip().startswith(b"<?xml") or b"<svg" in file_bytes[:500].lower():
            # SVG → PNG → PIL Image
            png_bytes = svg2png(bytestring=file_bytes)
            image = Image.open(io.BytesIO(png_bytes))
        else:
            image = Image.open(io.BytesIO(file_bytes))

        image = image.convert("RGB")
        image.thumbnail(max_size)

        os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
        image.save(file_path, format="JPEG", quality=quality)

        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=quality)
        resized_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return resized_base64, "jpeg", file_name

    except Exception as e:
        print(f"خطأ أثناء التحويل والحفظ: {e}")
        raise e