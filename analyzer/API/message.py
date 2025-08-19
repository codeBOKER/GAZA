import asyncio
import logging
import time
from huggingface_hub.utils import HfHubHTTPError
from requests.exceptions import HTTPError, RequestException, ConnectionError, Timeout
from .API_keys import get_correct_api, rigister_key_sotp_datetime, initialize_client
from channels.db import database_sync_to_async

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def analyze_company_name(company_name, language="English"):
    alternativ_messsage= f"""
        You are a company analysis AI. Your task is to analyze the provided company name and determine:

        Whether the company supports Israel DIRECTLY or INDIRECTLY (True if it has any form of support, False if it does not). Include companies with:
        - Direct support: donations, partnerships, investments in Israel
        - Indirect support: subsidiaries operating in Israel, supply chains supporting Israeli economy, parent companies with Israeli ties
        The brand/company name.
        The parent company name.
        The main product type/category the company is known for.
        The cause of boycott, stated in a critical and direct manner, without any justification, apology, or positive framing for the company.

        Respond only in this exact format:
        [True/False, Brand Name, Parent Company Name, Product Type, Cause]

        If no Parent Company, put: $

        Examples:
        [True, McDonald's, $, Fast Food, Provides free meals to Israeli military forces]
        [True, Starbucks, $, Coffee, Supports Israeli military through corporate partnerships]
        [False, Samsung, $, Electronics, No evidence of direct support for Israel]
        [True, HP, $, Technology, Provides technology infrastructure for Israeli settlements]
        [True, Coca-Cola, $, Soft Drinks, Sponsors Israeli military events and activities]

        CRITICAL: You MUST respond in {language} language only. All text in your response must be in {language}.
        
        Be accurate and consistent. Do not include any extra text, punctuation, or formatting other than the specified structure.
    """
    try:
        from analyzer.models import SystemMessage
        system_msg = await database_sync_to_async(lambda: SystemMessage.objects.filter(name="company_analysis", is_active=True).first())()
        system_content = (system_msg.message + f" CRITICAL: You MUST respond in {language} language only.") if system_msg else alternativ_messsage
    except Exception as e:
        logger.error(f"Error fetching analyze_company_name system message: {str(e)}")
        system_content = alternativ_messsage
    
    message = [
        {
            "role": "system",
            "content": system_content
        },
        {
            "role": "user",
            "content": f"Analyze this company: {company_name}. IMPORTANT: Respond in {language} language."
        }
    ]
    return await analyze(message)

async def analyze_img(image_url, language="English"):
    alternativ_messsage= f"""
        You are a product identification AI. Your task is to analyze the provided image and determine:

        Whether the identified company/brand supports Israel DIRECTLY or INDIRECTLY (True if it has any form of support, False if it does not). Include companies with:
        - Direct support: donations, partnerships, investments in Israel
        - Indirect support: subsidiaries operating in Israel, supply chains supporting Israeli economy, parent companies with Israeli ties

        The brand/company name.

        The parent company name.

        The product type/category (not the specific product name or flavor).

        The cause of boycott, stated in a critical and direct manner, without any justification, apology, or positive framing for the company.

        Respond only in this exact format:
        [True/False, Brand Name, Parent Company Name, Product Type, Cause]

        If no Parent Company, put: $

        Correct Examples:
        [True, 7 Up, PepsiCo, Soft Drink, Funds Israeli military through partnerships and donations]
        [True, Miranda, PepsiCo, Soft Drink, Profits used to support Israeli settlement expansion]
        [False, Apple, $, Smartphone, No evidence of direct support for Israel]
        [True, Cadbury, Mondelez, Dairy Milk Chocolate, Parent company invests in Israeli companies aiding occupation]

        Do NOT return specific product names or flavors:
        [False, Apple, $, iPhone 14 Pro, No evidence of direct support for Israel] (Incorrect – too specific)

        If no product is clearly visible in the image, respond exactly with: #

        CRITICAL: You MUST respond in {language} language only. All text in your response must be in {language}.
        
        Be concise and consistent. Do not include any extra text, punctuation, or formatting other than the specified structure. 
        """
    try:
        from analyzer.models import SystemMessage
        system_msg = await database_sync_to_async(lambda: SystemMessage.objects.filter(name="image_analysis", is_active=True).first())() 
        system_content = (system_msg.message + f" CRITICAL: You MUST respond in {language} language only.") if system_msg else alternativ_messsage
    except Exception as e:
        logger.error(f"Error fetching image analysis system message: {str(e)}")
        system_content = alternativ_messsage
    
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
                temperature=0,
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

        except (ConnectionError, Timeout) as e:
            logger.warning("Connection/timeout error. Fetching new API key...")
            await rigister_key_sotp_datetime(key)
            key = await get_correct_api()
            if key is None:
                raise Exception("All keys exhausted or invalid. Please try again later.")
            continue

        except RequestException as e:
            logger.error(f"Request error: {str(e)}")
            raise Exception("A network or connection error occurred.")

        except Exception as e:
            logger.error(f"API call failed: {str(e)}")
            raise Exception("API call failed. Please check your input or try again later.")
