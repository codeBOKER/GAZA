import logging
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)

@database_sync_to_async
def check_company_and_get_cause(company: str):
    from analyzer.models import BoycottCompanies
    try:
        logger.info(f"Checking company: {company}")
        if not isinstance(company, str):
            logger.error(f"Company is not a string: {type(company)}")
            return None
            
        check_company = BoycottCompanies.objects.filter(company_name__icontains=company.strip()).first()
        if check_company:
            logger.info(f"Found company: {check_company.company_name}, returning cause")
            # Return the cause text directly
            return check_company.cause
        else:
            logger.info(f"Company not found: {company}")
            return None
    except Exception as e:
        logger.error(f"Error checking company: {str(e)}")
        raise ValueError(f"Unsupported company: {company}, error: {str(e)}")