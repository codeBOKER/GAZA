import logging
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)

@database_sync_to_async
def check_company_and_get_cause(company: str, company_parent_name=None):
    from analyzer.models import BoycottCompanies
    from analyzer.utils.fuzzy_match import find_best_company_match
    from django.db.models import Q

    try:
        logger.info(f"Checking company: {company} and parent company: {company_parent_name}")

        # Validate and clean input
        names_to_check = []
        if isinstance(company, str) and company.strip():
            names_to_check.append(company.strip())
        if company_parent_name != None:
            names_to_check.append(company_parent_name.strip())

        if not names_to_check:
            logger.error("Both company and parent name are empty or invalid.")
            return None

        # 1. Try exact match (case-insensitive) on any input
        exact_match = BoycottCompanies.objects.filter(
            Q(company_name__iexact=names_to_check[0]) |
            Q(company_name__iexact=names_to_check[1]) if len(names_to_check) > 1 else Q()
        ).first()

        if exact_match:
            logger.info(f"Exact match found: {exact_match.company_name}")
            return exact_match.cause

        # 2. Try partial match
        partial_query = Q(company_name__icontains=names_to_check[0])
        if len(names_to_check) > 1:
            partial_query |= Q(company_name__icontains=names_to_check[1])

        partial_match = BoycottCompanies.objects.filter(partial_query).first()
        if partial_match:
            logger.info(f"Partial match found: {partial_match.company_name}")
            return partial_match.cause

        # 3. Fuzzy match with both names
        all_companies = BoycottCompanies.objects.all()
        candidates = [(obj, obj.company_name) for obj in all_companies]

        best_match = None
        best_score = 0

        for name in names_to_check:
            match, score = find_best_company_match(name, candidates, threshold=0.75)
            if match and score > best_score:
                best_match = match
                best_score = score

        if best_match:
            logger.info(f"Fuzzy match found: {best_match.company_name} (similarity: {best_score:.2f})")
            return best_match.cause

        logger.info(f"No match found for: {company} or {company_parent_name}")
        return None

    except Exception as e:
        logger.error(f"Error checking company: {str(e)}")
        raise ValueError(f"Unsupported company: {company}, error: {str(e)}")


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
def get_alternatives_for_boycott_product(product_type=None):
    """
    Get alternative products for a specific boycott product.
    
    Args:
        boycott_product_id: ID of the boycott product to find alternatives for
        product_type: Optional product type to filter alternatives by
        use_fuzzy_matching: If True, uses fuzzy matching for product types
        
    Returns:
        List of alternative products with their details
    """
    from analyzer.models import AlternativeProducts
    from analyzer.utils.fuzzy_match import is_similar_product_type
    
    try:
        # Get all alternatives for this boycott product
        alternatives = AlternativeProducts.objects.all()
    
        # Filter by product type with optional fuzzy matching
        result = []
        for alt in alternatives:
            alt_product_type = alt.product_type.product_type
            
            if is_similar_product_type(product_type, alt_product_type):
                result.append({
                    'product_name': alt.product_name,
                    'company_name': alt.company_name.company_name,
                    'product_type': alt_product_type,
                    'company_website': alt.company_name.website,
                    'image_url': alt.image_url,
                    'is_exact_match': (alt_product_type.lower() == product_type.lower())
                })
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting alternatives: {str(e)}", exc_info=True)
        return []

def is_alternative_product_sync(company_name: str, product_type: str):
    """Synchronous version - Check if a product from a company is in the alternative products list"""
    from analyzer.models import AlternativeProducts
    from analyzer.utils.fuzzy_match import calculate_similarity, is_similar_product_type
    
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
            company_name__company_name__iexact=company_name,
            product_type__product_type__iexact=product_type
        ).first()
        
        if exact_match:
            logger.info(f"[SYNC] Found exact alternative match: {exact_match.company_name.company_name} - {exact_match.product_type.product_type}")
            return True
            
        # Try case-insensitive match for company with fuzzy product type match
        similar_products = AlternativeProducts.objects.filter(
            company_name__company_name__iexact=company_name
        ).select_related('product_type')
        
        for product in similar_products:
            if is_similar_product_type(product_type, product.product_type.product_type):
                logger.info(f"[SYNC] Found alternative with similar product type: "
                          f"{product.company_name.company_name} - {product.product_type.product_type} "
                          f"(input type: {product_type})")
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
            
            # Check if company is similar and product types match (either exactly or through fuzzy matching)
            if company_similarity >= 0.75:
                # Use the new fuzzy product type matching
                if is_similar_product_type(product_type, alt_product.product_type.product_type):
                    logger.info(f"[SYNC] Found fuzzy alternative match: {alt_product.company_name.company_name} - {alt_product.product_type.product_type} "
                              f"(company score: {company_similarity:.2f}, product types: '{product_type}' ~ '{alt_product.product_type.product_type}')")
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