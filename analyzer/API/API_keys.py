from datetime import datetime, timedelta
from groq import Groq
from huggingface_hub import InferenceClient
from channels.db import database_sync_to_async

@database_sync_to_async
def get_correct_api():
    
    from analyzer.models import ApiKeys

    keys = ApiKeys.objects.all()
    for key in keys:
        company = key.provider_company.company_name.lower()

        # Skip if stop_date is None (key is available)
        if key.stop_date is None:
            return key
       
        if company == "groq" and (key.stop_date - datetime.now()) < timedelta(hours=24):
            continue

       
        elif company == "hf" and (key.stop_date.date() - datetime.now().date()).days < 30:
            continue

      
        else:
            return key

    return None


@database_sync_to_async
def rigister_key_sotp_datetime(key):
    
    from analyzer.models import ApiKeys

    db_key = ApiKeys.objects.get(api_key=key.api_key)
    db_key.stop_date = datetime.now()
    db_key.save()


def initialize_client(key) -> tuple:
    
    company = key.provider_company.company_name.lower()

    if company == "groq":
        return Groq(api_key=key.api_key), key.provider_company.model_name
    elif company == "hf":
        return InferenceClient(api_key=key.api_key, provider="featherless-ai"), key.provider_company.model_name
    else:
        raise ValueError(f"Unsupported company: {company}")
