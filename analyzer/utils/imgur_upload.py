import requests
import base64
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

def upload_image_to_imgur(image_data):
    """
    Upload image to Imgur and return the URL
    
    Args:
        image_data: Base64 encoded image data (without data:image prefix)
    
    Returns:
        str: Imgur URL or None if upload fails
    """
    try:
        # Imgur API endpoint
        url = "https://api.imgur.com/3/image"
        
        # Get client ID from settings or use a default one
        # You should add IMGUR_CLIENT_ID to your Django settings
        client_id = getattr(settings, 'IMGUR_CLIENT_ID', 'your_imgur_client_id_here')
        
        headers = {
            'Authorization': f'Client-ID {client_id}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'image': image_data,
            'type': 'base64',
            'title': 'Product Image'
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if data['success']:
                imgur_url = data['data']['link']
                logger.info(f"Successfully uploaded image to Imgur: {imgur_url}")
                return imgur_url
            else:
                logger.error(f"Imgur API error: {data}")
                return None
        else:
            logger.error(f"Imgur upload failed with status {response.status_code}: {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error uploading to Imgur: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error uploading to Imgur: {str(e)}")
        return None

