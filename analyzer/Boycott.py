import logging
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)

@database_sync_to_async
def check_company_and_get_cause(company: str):
    from analyzer.models import BoycottCompanies
    from analyzer.utils.fuzzy_match import find_best_company_match
    
    try:
        logger.info(f"Checking company: {company}")
        if not isinstance(company, str):
            logger.error(f"Company is not a string: {type(company)}")
            return None
        
        company = company.strip()
        
        # First try exact match (case-insensitive)
        exact_match = BoycottCompanies.objects.filter(company_name__icontains=company).first()
        if exact_match:
            logger.info(f"Found exact match: {exact_match.company_name} for input: {company}")
            return exact_match.cause
        
        # If no exact match, try fuzzy matching
        logger.info(f"No exact match found, trying fuzzy matching for: {company}")
        all_companies = BoycottCompanies.objects.all()
        
        best_match, similarity_score = find_best_company_match(company, all_companies, threshold=0.75)
        
        if best_match:
            logger.info(f"Found fuzzy match: {best_match.company_name} (similarity: {similarity_score:.2f}) for input: {company}")
            return best_match.cause
        else:
            logger.info(f"No fuzzy match found for company: {company}")
            return None
            
    except Exception as e:
        logger.error(f"Error checking company: {str(e)}")
        raise ValueError(f"Unsupported company: {company}, error: {str(e)}")

@database_sync_to_async
def save_product_as_alternative(company_name: str, product_type: str, image=None):
    """Save a product as an alternative when it's not found in boycott list"""
    from analyzer.models import AlternativeCompanies, AlternativeProducts, ProductType
    from analyzer.utils.imgur_upload import upload_image_to_imgur
    
    try:
        if not company_name or not product_type:
            raise ValueError("Company name and product type are required")
            
        logger.info(f"Saving alternative product: {company_name} - {product_type}")
        
        # Upload image to Imgur if image provided
        imgur_url = None
        if image:
            try:
                imgur_url = upload_image_to_imgur(image)
                if imgur_url:
                    logger.info(f"Image uploaded to Imgur: {imgur_url}")
                else:
                    logger.warning("Failed to upload image to Imgur")
            except Exception as imgur_error:
                logger.error(f"Error uploading to Imgur: {str(imgur_error)}")
        
        try:
            # Get or create the alternative company
            alt_company, created = AlternativeCompanies.objects.get_or_create(
                company_name=company_name,
                defaults={'description': f'Alternative company identified from image analysis'}
            )
            
            # Get or create the product type
            prod_type, created = ProductType.objects.get_or_create(
                product_type=product_type
            )
            
            # Create the alternative product with image URL
            # Use company_name for product_name since we don't have a separate product name
            alt_product, created = AlternativeProducts.objects.get_or_create(
                product_name=company_name,  # Using company_name as product_name
                company_name=alt_company,
                product_type=prod_type,
                defaults={'image_url': imgur_url}
            )
            
            # Update image_url if product already exists but doesn't have an image
            if not created and imgur_url and not alt_product.image_url:
                alt_product.image_url = imgur_url
                alt_product.save()
            
            logger.info(f"Successfully saved alternative product: {company_name} - {product_type}")
            return alt_product
            
        except Exception as db_error:
            logger.error(f"Database error saving alternative product: {str(db_error)}")
            raise
            
    except Exception as e:
        logger.error(f"Error in save_product_as_alternative: {str(e)}")
        return None

@database_sync_to_async
def get_alternatives_for_boycott_product(boycott_product_id):
    """Get alternative products for a specific boycott product"""
    from analyzer.models import AlternativeProducts
    
    try:
        alternatives = AlternativeProducts.objects.filter(
            alternative_to_id=boycott_product_id
        ).select_related('company_name', 'product_type')
        
        return [{
            'product_name': alt.product_name,
            'company_name': alt.company_name.company_name,
            'product_type': alt.product_type.product_type,
            'company_website': alt.company_name.website
        } for alt in alternatives]
        
    except Exception as e:
        logger.error(f"Error getting alternatives: {str(e)}")
        return []

def is_alternative_product_sync(company_name: str, product_type: str):
    """Synchronous version - Check if a product from a company is in the alternative products list"""
    from analyzer.models import AlternativeProducts
    from analyzer.utils.fuzzy_match import calculate_similarity
    
    try:
        company_name = company_name.strip()
        product_type = product_type.strip()
        
        logger.info(f"[SYNC] Checking alternative product for: '{company_name}' - '{product_type}'")
        
        # Get count of alternative products in database
        alt_count = AlternativeProducts.objects.count()
        logger.info(f"[SYNC] Total alternative products in database: {alt_count}")
        
        # If no alternative products exist, return False immediately
        if alt_count == 0:
            logger.info("[SYNC] No alternative products in database, returning False")
            return False
        
        # First try exact match (case-insensitive)
        exact_match = AlternativeProducts.objects.filter(
            company_name__company_name__icontains=company_name,
            product_type__product_type__icontains=product_type
        ).first()
        
        if exact_match:
            logger.info(f"[SYNC] Found exact alternative match: {exact_match.company_name.company_name} - {exact_match.product_type.product_type}")
            return True
        
        # If no exact match, try fuzzy matching
        logger.info(f"[SYNC] No exact alternative match, trying fuzzy matching for: {company_name} - {product_type}")
        
        # Get all alternative products and check similarity
        all_alt_products = AlternativeProducts.objects.select_related('company_name', 'product_type').all()
        
        found_match = False
        for alt_product in all_alt_products:
            company_similarity = calculate_similarity(company_name, alt_product.company_name.company_name)
            product_similarity = calculate_similarity(product_type, alt_product.product_type.product_type)
            
            logger.info(f"[SYNC] Comparing with DB entry: '{alt_product.company_name.company_name}' - '{alt_product.product_type.product_type}' (scores: {company_similarity:.2f}, {product_similarity:.2f})")
            
            # Both company and product type should have good similarity
            if company_similarity >= 0.75 and product_similarity >= 0.75:
                logger.info(f"[SYNC] Found fuzzy alternative match: {alt_product.company_name.company_name} - {alt_product.product_type.product_type} (scores: {company_similarity:.2f}, {product_similarity:.2f})")
                found_match = True
                break
        
        if not found_match:
            logger.info(f"[SYNC] No fuzzy alternative match found for: {company_name} - {product_type}")
        
        logger.info(f"[SYNC] Final result: {found_match}")
        return found_match
        
    except Exception as e:
        logger.error(f"[SYNC] Error checking alternative product: {str(e)}")
        return False

@database_sync_to_async
def is_alternative_product(company_name: str, product_type: str):
    """Async wrapper for is_alternative_product_sync"""
    logger.info(f"[ASYNC] is_alternative_product called with: '{company_name}' - '{product_type}'")
    result = is_alternative_product_sync(company_name, product_type)
    logger.info(f"[ASYNC] is_alternative_product returning: {result}")
    return result
    