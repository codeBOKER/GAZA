import asyncio
import logging
from huggingface_hub.utils import HfHubHTTPError
from requests.exceptions import HTTPError, RequestException
from .API_keys import get_correct_api, rigister_key_sotp_datetime, initialize_client
from channels.db import database_sync_to_async

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def genrate_text_cause(text):
    try:
        from analyzer.models import SystemMessage
        system_msg = await database_sync_to_async(lambda: SystemMessage.objects.filter(name="text_generation", is_active=True).first())()
        system_content = system_msg.message if system_msg else "Type this text in another style, with Arabic language"
    except Exception as e:
        logger.error(f"Error fetching text generation system message: {str(e)}")
        system_content = "Type this text in another style, with Arabic language"
    
    message = [
        {
            "role": "system",
            "content": system_content
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": text
                }
            ]
        }
    ]
    return await analyze(message)

async def analyze_img(image_url):
    try:
        from analyzer.models import SystemMessage
        system_msg = await database_sync_to_async(lambda: SystemMessage.objects.filter(name="image_analysis", is_active=True).first())() 
        system_content = system_msg.message if system_msg else "You are a product identification AI. Analyze the image and identify the product and its company. Describe what this product is used for. If no product is visible, answer 'None'. Respond in this exact format: [Company Name, long Usage Description, Product Name]."
    except Exception as e:
        logger.error(f"Error fetching image analysis system message: {str(e)}")
        system_content = "You are a product identification AI. Analyze the image and identify the product and its company. Describe what this product is used for. If no product is visible, answer 'None'. Respond in this exact format: [Company Name, long Usage Description, Product Name]."
    
    message = [
        {
            "role": "system",
            "content": system_content
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": image_url
                    }
                }
            ]
        }
    ]
    return await analyze(message)

async def analyze(message: list) -> str:
    global key
    if 'key' not in globals() or key is None:
        key = await get_correct_api()
        if key is None:
            logger.error("No available API keys. Service stopped for maintenance.")
            return "SERVICE_STOPPED"

    while True:
        logger.info(f"Using API key: {key.api_key}")
        client, model = initialize_client(key)

        try:
            completion = await asyncio.to_thread(
                client.chat.completions.create,
                model=model,
                messages=message,
            )
            return completion.choices[0].message.content

        except (HfHubHTTPError, HTTPError) as e:
            status = getattr(e.response, "status_code", None)

            if status in [401, 403]:
                logger.warning("Token expired or invalid. Fetching new API key...")
                await rigister_key_sotp_datetime(key)
                key = await get_correct_api()
                if key is None:
                    raise Exception("All keys exhausted or invalid. Please try again later.")
                continue

            elif status == 429:
                logger.warning("Quota exceeded. Fetching new API key...")
                await rigister_key_sotp_datetime(key)
                key = await get_correct_api()
                if key is None:
                    raise Exception("All keys exhausted or invalid. Please try again later.")
                continue

            else:
                logger.error(f"HTTP error: {str(e)}")
                raise

        except RequestException as e:
            logger.error(f"Request error: {str(e)}")
            raise Exception("A network or connection error occurred.")

        except Exception as e:
            logger.error(f"API call failed: {str(e)}")
            raise Exception("API call failed. Please check your input or try again later.")
