import base64
import json
import asyncio
import logging
import time
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings
from .imgProcessor import convert_and_resize_image
from analyzer.API.message import analyze_img, analyze_company_name
from analyzer.Boycott import check_company_and_get_cause, get_alternatives_for_boycott_product

logger = logging.getLogger(__name__)

# Rate limiting storage (in production, use Redis)
connection_attempts = {}
MAX_REQUESTS_PER_MINUTE = 10


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
        # Get client IP for rate limiting
        client_ip = self.get_client_ip()
        
        # Rate limiting check
        if not self.check_rate_limit(client_ip):
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            await self.close(code=4429)  # Too Many Requests
            return
            
        # API Key validation
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        api_key = None
        if 'api_key=' in query_string:
            api_key = query_string.split('api_key=')[1].split('&')[0]
            
        if not api_key or api_key != settings.WEBSOCKET_API_KEY:
            logger.warning(f"Invalid API key from IP: {client_ip}, {api_key}")
            await self.close(code=4401)  # Unauthorized
            return
        
        await self.accept()
        
    def get_client_ip(self):
        """Extract client IP from WebSocket scope"""
        headers = dict(self.scope.get('headers', []))
        
        # Check for forwarded IP first (for reverse proxies)
        forwarded_for = headers.get(b'x-forwarded-for')
        if forwarded_for:
            return forwarded_for.decode('utf-8').split(',')[0].strip()
            
        # Check real IP header
        real_ip = headers.get(b'x-real-ip')
        if real_ip:
            return real_ip.decode('utf-8')
            
        # Fallback to client address
        client = self.scope.get('client')
        return client[0] if client else 'unknown'
        
    def check_rate_limit(self, client_ip):
        """Simple rate limiting - 5 requests per minute per IP"""
        current_time = time.time()
        
        if client_ip not in connection_attempts:
            connection_attempts[client_ip] = []
            
        # Remove attempts older than 1 minute
        connection_attempts[client_ip] = [
            attempt_time for attempt_time in connection_attempts[client_ip]
            if current_time - attempt_time < 60
        ]
        
        # Check if under limit
        if len(connection_attempts[client_ip]) >= MAX_REQUESTS_PER_MINUTE:
            return False
            
        # Add current attempt
        connection_attempts[client_ip].append(current_time)
        return True

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
            await self.send(text_data=json.dumps({"type": "error", "value": "Invalid JSON format"}))
            await self.close()
            return
            
        # Input validation
        if not self.validate_input(data):
            logger.error("Invalid input data")
            await self.send(text_data=json.dumps({"type": "error", "value": "Invalid input data"}))
            await self.close()
            return
        image_data = data.get('image_data', None)
        company_name_input = data.get('company_name', None)
        
        if not image_data and not company_name_input:
            logger.error("No IMAGE data or company name provided")
            return     
           
        country = data.get('country', None)
        if not country:
            logger.info(f"User country: NO COUNTRY..!")

        language = data.get('language', 'English')

        try:
            if company_name_input:
                # Handle text-based company name analysis
                response_text = await asyncio.wait_for(analyze_company_name(company_name_input, language), timeout=25.0)
                logger.info(f"Company name analysis response: {response_text}")
                boycott_status, company_name, company_parent_name, product_type, cause = parse_response(response_text)
                logger.info(f"Parsed response: {company_name}, {company_parent_name}, {product_type}")
            else:
                # Handle image-based analysis
                # Extract base64 data from data URL
                if image_data.startswith('data:image/'):
                    base64_data = image_data.split(',')[1]
                else:
                    base64_data = image_data

                file_bytes = base64.b64decode(base64_data)
                resized_base64, ext, saved_filename = await asyncio.to_thread(
                    convert_and_resize_image, file_bytes, max_size=(800, 800), quality=70
                )

                image_url = f"data:image/{ext};base64,{resized_base64}"
                response_text = await asyncio.wait_for(analyze_img(image_url, language), timeout=25.0)
                logger.info(f"Image analysis response: {response_text}")
                boycott_status, company_name, company_parent_name, product_type, cause = parse_response(response_text)
                logger.info(f"Parsed response: {company_name}, {company_parent_name}, {product_type}")
            
            if not company_name:
                error_msg = "Invalid response format" if company_name_input else "Invalid image or response format"
                not_recognized_msg = "Company NOT recognized" if company_name_input else "Image NOT recognized"
                await self.send(text_data=json.dumps({"type": "error", "value": error_msg}))
                await self.send(text_data=json.dumps({"type": "company", "value": not_recognized_msg}))
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
                    
                    if not is_alternative and image_data:
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
            logger.error(f"Error processing request: {str(e)}")
            await self.send(text_data=json.dumps({"type": "error", "value": "Processing error"}))
            await self.send(text_data=json.dumps({"type": "company", "value": "Error: Try again"}))
            await self.send(text_data=json.dumps({"type": "boycott", "value": False}))
            await self.send(text_data=json.dumps({"type": "product_type", "value":""}))
            await self.send(text_data=json.dumps({"type": "cause", "value": ""}))
            await self.send(text_data=json.dumps({"type": "done"}))
            await self.close()
            
    def validate_input(self, data):
        """Validate input data structure and content"""
        if not isinstance(data, dict):
            return False
            
        # Check required fields
        image_data = data.get('image_data')
        company_name = data.get('company_name')
        
        if not image_data and not company_name:
            return False
            
        # Validate image data format
        if image_data:
            if not isinstance(image_data, str):
                return False
            if not (image_data.startswith('data:image/') or len(image_data) > 100):
                return False
            # Limit image size (base64 encoded)
            if len(image_data) > 10 * 1024 * 1024:  # 10MB limit
                return False
                
        # Validate company name
        if company_name:
            if not isinstance(company_name, str):
                return False
            if len(company_name.strip()) < 2 or len(company_name) > 100:
                return False
                
        # Validate optional fields
        country = data.get('country')
        if country and (not isinstance(country, str) or len(country) > 50):
            return False
            
        language = data.get('language')
        if language and (not isinstance(language, str) or len(language) > 20):
            return False
            
        return True