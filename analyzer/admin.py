from django.contrib import admin
from .models import *
# Register your models here.
admin.site.register(ProviderCompany)
admin.site.register(ApiKeys)
admin.site.register(BoycottCompanies)
admin.site.register(BoycottProducts)
admin.site.register(AlternativeCompanies)
admin.site.register(AlternativeProducts)
admin.site.register(ProductType)
admin.site.register(SystemMessage)
