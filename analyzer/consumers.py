import base64
import json
import asyncio
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from .imgProcessor import convert_and_resize_image
from analyzer.API.message import analyze_img, genrate_text_cause
from analyzer.Boycott import check_company_and_get_cause

logger = logging.getLogger(__name__)


def parse_response(response: str):
    response = response.strip()
    if response.startswith('[') and response.endswith(']'):
        response = response[1:-1]
    return [part.strip() for part in response.split(',')]
    



class AnalyzeConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        data = json.loads(text_data)
        image_data = data['image_data']

        file_bytes = base64.b64decode(image_data)
        resized_base64, ext, saved_filename = await asyncio.to_thread(
            convert_and_resize_image, file_bytes, max_size=(800, 800), quality=70
        )

        image_url = f"data:image/{ext};base64,{resized_base64}"

        try:
            response_text = await asyncio.wait_for(analyze_img(image_url), timeout=25.0)
            logger.info(f"Image analysis response: {response_text}")
            
            parsed = parse_response(response_text)
            logger.info(f"Parsed response: {parsed}")
            
            # Get company cause
            company_name = parsed[0] if parsed and len(parsed) > 0 else ""
            
            company_coroutine = check_company_and_get_cause(company_name)
            cause_text = await asyncio.wait_for(company_coroutine, timeout=25.0)
            
            if cause_text:
                cause_coroutine = genrate_text_cause(cause_text)
                cause = await asyncio.wait_for(cause_coroutine, timeout=25.0) or ""
                logger.info(f"Formatted cause: {cause}")
            else:
                cause = ""
                logger.info("No cause found")
            
            await self.send(text_data=json.dumps({"type": "company", "value": parsed[0]}))
            
            await self.send(text_data=json.dumps({"type": "usage", "value": cause}))
            
            await self.send(text_data=json.dumps({"type": "product", "value": parsed[2]}))

        except asyncio.TimeoutError:
            await self.send(text_data=json.dumps({"type": "error", "value": "Request timed out after 25 seconds"}))
        except Exception as e:
            await self.send(text_data=json.dumps({"type": "error", "value": str(e)}))
