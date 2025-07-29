import base64
import json
import asyncio
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from .imgProcessor import convert_and_resize_image
from analyzer.API.message import analyze_img, genrate_text_cause
from analyzer.Boycott import check_company_and_get_cause, get_alternatives_for_boycott_product

logger = logging.getLogger(__name__)


def parse_response(response: str):
    """
    response will be as follow: [Company Name, Product Type]
                        change  [Company Name, head company name, Product Type] responss head (-) or none  
    """
    response = response.strip() 
    if response.startswith('['):
        response = response[1:]
    if response.endswith(']'):
        response = response[:-1]
    if response.endswith('].'):
        response = response[:-2]
    try:
        parts = [part.strip() for part in response.split(',')]
        return parts[0], parts[1] if "$" not in parts[1] else None, parts[2]
    except:
        return False, None, None
    
    



class AnalyzeConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        data = json.loads(text_data)
        image_data = data['image_data']

        # Extract base64 data from data URL
        if image_data.startswith('data:image/'):
            base64_data = image_data.split(',')[1]
        else:
            base64_data = image_data

        file_bytes = base64.b64decode(base64_data)


        # file_bytes = base64.b64decode(image_data)
        resized_base64, ext, saved_filename = await asyncio.to_thread(
            convert_and_resize_image, file_bytes, max_size=(800, 800), quality=70
        )

        image_url = f"data:image/{ext};base64,{resized_base64}"

        try:
            response_text = await asyncio.wait_for(analyze_img(image_url), timeout=25.0)
            logger.info(f"Image analysis response: {response_text}")
            
            company_name, company_parent_name, product_type = parse_response(response_text)
            logger.info(f"Parsed response: {company_name}, {company_parent_name}, {product_type}")
            
            if not company_name:
                await self.send(text_data=json.dumps({"type": "error", "value": "Invalid image or response format"}))
                await self.send(text_data=json.dumps({"type": "company", "value": "Image NOT recognized"}))
                await self.send(text_data=json.dumps({"type": "boycott", "value": False}))
                await self.send(text_data=json.dumps({"type": "product_type", "value":""}))
                await self.send(text_data=json.dumps({"type": "cause", "value": ""}))
                await self.send(text_data=json.dumps({"type": "alternative", "value": ""}))
                return
            else:
                company_coroutine = check_company_and_get_cause(company_name, company_parent_name)
                cause_text = await asyncio.wait_for(company_coroutine, timeout=25.0)

                await self.send(text_data=json.dumps({"type": "company", "value": company_name}))
                await self.send(text_data=json.dumps({"type": "product_type", "value": product_type}))
                if cause_text:
                    await self.send(text_data=json.dumps({"type": "boycott", "value": True}))
                    cause_coroutine = genrate_text_cause(cause_text)
                    cause = await asyncio.wait_for(cause_coroutine, timeout=25.0) or ""
                    logger.info(f"Formatted cause: {cause}")
                    await self.send(text_data=json.dumps({"type": "cause", "value": cause}))
                    
                    # Get and send alternatives
                    alternatives = await get_alternatives_for_boycott_product(product_type)
                    await self.send(text_data=json.dumps({
                        "type": "alternative", 
                        "value": alternatives
                    }))
                else:
                    await self.send(text_data=json.dumps({"type": "boycott", "value": False}))
                    # Check if it's an alternative company
                    from analyzer.Boycott import is_alternative_product, save_product_as_alternative
                    
                    # Await the async function call
                    is_alternative = await is_alternative_product(company_name, product_type)
                    logger.info(f"is_alternative_product returned: {is_alternative} for {company_name} - {product_type}")
                    
                    if is_alternative:
                        cause = "This is an alternative/ethical product - Safe to buy!"
                        logger.info(f"Alternative company found: {company_name}")
                        await self.send(text_data=json.dumps({"type": "boycott", "value": False}))
                        await self.send(text_data=json.dumps({"type": "cause", "value": cause}))
                    else:
                        # Save as new alternative product for future reference
                        await save_product_as_alternative(company_name, product_type, resized_base64)
                        cause = "Company not in boycott list - Consider as potential alternative"
                        logger.info(f"New company saved as alternative: {company_name}")    
                        await self.send(text_data=json.dumps({"type": "cause", "value": cause}))
                
                


        except asyncio.TimeoutError:
            await self.send(text_data=json.dumps({"type": "error", "value": "Request timed out after 25 seconds"}))
            await self.send(text_data=json.dumps({"type": "company", "value": "Timed out after 25 seconds"}))
            await self.send(text_data=json.dumps({"type": "boycott", "value": False}))
            await self.send(text_data=json.dumps({"type": "product_type", "value":""}))
            await self.send(text_data=json.dumps({"type": "cause", "value": ""}))
        except Exception as e:
            await self.send(text_data=json.dumps({"type": "error", "value": str(e)}))
            await self.send(text_data=json.dumps({"type": "company", "value": "Error: Try again"}))
            await self.send(text_data=json.dumps({"type": "boycott", "value": False}))
            await self.send(text_data=json.dumps({"type": "product_type", "value":""}))
            await self.send(text_data=json.dumps({"type": "cause", "value": ""}))
            
