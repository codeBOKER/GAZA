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
                        change  [Boycott Status, Company Name, head company name, Product Type] responss head (-) or none  
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
        return parts[0].lower()== 'true', parts[1], parts[2] if "$" not in parts[2] else None, parts[3], parts[4]
    except:
        return False, False, None, None, None



class AnalyzeConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        data = json.loads(text_data)
        image_data = data.get('image_data', None)
        if not image_data:
            logger.error("No IMAGE data provided")
            return     
           
        country = data.get('country', None)
        if not country:
            logger.info(f"User country: NO COUNTRY..!")

        language = data.get('language', 'English')

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
            response_text = await asyncio.wait_for(analyze_img(image_url, language), timeout=25.0)
            logger.info(f"Image analysis response: {response_text}")
            
            boycott_status, company_name, company_parent_name, product_type, cause = parse_response(response_text)
            logger.info(f"Parsed response: {company_name}, {company_parent_name}, {product_type}")
            
            if not company_name:
                await self.send(text_data=json.dumps({"type": "error", "value": "Invalid image or response format"}))
                await self.send(text_data=json.dumps({"type": "company", "value": "Image NOT recognized"}))
                await self.send(text_data=json.dumps({"type": "boycott", "value": False}))
                await self.send(text_data=json.dumps({"type": "product_type", "value":""}))
                await self.send(text_data=json.dumps({"type": "cause", "value": ""}))
                await self.send(text_data=json.dumps({"type": "alternative", "value": ""}))
                await self.send(text_data=json.dumps({"type": "done"}))
                await self.close()
                return
            
            else:
                await self.send(text_data=json.dumps({"type": "company", "value": company_name}))
                await self.send(text_data=json.dumps({"type": "product_type", "value": product_type}))
                await self.send(text_data=json.dumps({"type": "boycott", "value": boycott_status}))
                await self.send(text_data=json.dumps({"type": "cause", "value": cause}))
                if boycott_status:
                    # Get and send alternatives
                    alternatives = await get_alternatives_for_boycott_product(product_type, country=country)
                    await self.send(text_data=json.dumps({
                        "type": "alternative", 
                        "value": alternatives
                    }))
                    await self.send(text_data=json.dumps({"type": "done"}))
                    await self.close()
                else:
                    await self.send(text_data=json.dumps({"type": "alternative", "value": ""}))
                    # Check if it's an alternative company
                    from analyzer.Boycott import is_alternative_product, save_product_as_alternative

                    # Await the async function call
                    is_alternative = await is_alternative_product(company_name, product_type, country)
                    logger.info(f"is_alternative_product returned: {is_alternative} for {company_name} - {product_type} in {country}")
                    
                    if is_alternative:
                        logger.info(f"Alternative company found: {company_name}")
                        await self.send(text_data=json.dumps({"type": "done"}))
                        await self.close()
                    else:
                        # Save as new alternative product for future reference
                        await save_product_as_alternative(company_name, product_type, resized_base64, country)
                        logger.info(f"New company saved as alternative: {company_name}")
                        await self.send(text_data=json.dumps({"type": "done"}))
                        await self.close()
                
        except asyncio.TimeoutError:
            await self.send(text_data=json.dumps({"type": "error", "value": "Request timed out after 25 seconds"}))
            await self.send(text_data=json.dumps({"type": "company", "value": "Timed out after 25 seconds"}))
            await self.send(text_data=json.dumps({"type": "boycott", "value": False}))
            await self.send(text_data=json.dumps({"type": "product_type", "value":""}))
            await self.send(text_data=json.dumps({"type": "cause", "value": ""}))
            await self.send(text_data=json.dumps({"type": "done"}))
            await self.close()
        except Exception as e:
            await self.send(text_data=json.dumps({"type": "error", "value": str(e)}))
            await self.send(text_data=json.dumps({"type": "company", "value": "Error: Try again"}))
            await self.send(text_data=json.dumps({"type": "boycott", "value": False}))
            await self.send(text_data=json.dumps({"type": "product_type", "value":""}))
            await self.send(text_data=json.dumps({"type": "cause", "value": ""}))
            await self.send(text_data=json.dumps({"type": "done"}))
            await self.close()