
from channels.db import database_sync_to_async
from analyzer.API.message import genrate_text_cause

@database_sync_to_async
def check_company_and_get_cause(company: str):
    from analyzer.models import BoycottCompanies
    try:
        check_company = BoycottCompanies.objects.filter(company_name__icontains=company.strip()).first()
        if check_company:
            return genrate_text_cause(check_company.cause)
        else:
            return None
    except:
        raise ValueError(f"Unsupported company: {company}")