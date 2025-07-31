from django.db import models


class ProviderCompany(models.Model):
    company_name = models.CharField(max_length=255)
    model_name = models.CharField(max_length=255)

    class Meta:
        verbose_name = 'provider company'
        verbose_name_plural = 'provider companies'
    
    def __str__(self):
        return self.company_name


class ApiKeys(models.Model):
    api_key = models.CharField(max_length=255)
    stop_date = models.DateTimeField(null=True, blank=True)
    email = models.EmailField(blank=True)
    provider_company = models.ForeignKey(ProviderCompany, on_delete=models.CASCADE, related_name='api_keys')

    def __str__(self):
        return self.api_key

class BoycottCompanies(models.Model):
    company_name = models.CharField(max_length=255)
    cause= models.TextField(null=True, blank=True)

    class Meta:
        verbose_name = 'Boycott companies'
        verbose_name_plural = 'Boycott companies'

    def __str__(self):
        return self.company_name

class ProductType(models.Model):
    product_type = models.CharField(max_length=255)

    class Meta:
        verbose_name = 'type'
        verbose_name_plural = 'types'

    def __str__(self):
        return self.product_type

class BoycottProducts(models.Model):
    product_name = models.CharField(max_length=255)
    product_type = models.ForeignKey(ProductType, on_delete=models.CASCADE, related_name='boycott_products')
    company_name= models.ForeignKey(BoycottCompanies, on_delete=models.CASCADE, related_name='boycott_products')

    class Meta:
        verbose_name = 'Boycott Product'
        verbose_name_plural = 'Boycott Products'

    def __str__(self):
        return self.product_name


class SystemMessage(models.Model):
    name = models.CharField(max_length=100)
    message = models.TextField()
    is_active = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = 'System Message'
        verbose_name_plural = 'System Messages'
    
    def __str__(self):
        return self.name



class AlternativeCompanies(models.Model):
    company_name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    website = models.URLField(null=True, blank=True)

    class Meta:
        verbose_name = 'Alternative Company'
        verbose_name_plural = 'Alternative Companies'

    def __str__(self):
        return self.company_name


class Country(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=3, null=True, blank=True)

    class Meta:
        verbose_name = 'Country'
        verbose_name_plural = 'Countries'

    def __str__(self):
        return self.name


class AlternativeProducts(models.Model):
    product_name = models.CharField(max_length=255)
    product_type = models.ForeignKey(ProductType, on_delete=models.CASCADE, related_name='alternatives')
    company_name = models.ForeignKey(AlternativeCompanies, on_delete=models.CASCADE, related_name='products')
    image_url = models.URLField(null=True, blank=True)
    countries = models.ManyToManyField(Country, blank=True, related_name='alternative_products')
    alternative_to = models.ForeignKey(BoycottProducts, on_delete=models.CASCADE, related_name='alternatives', null=True, blank=True)

    class Meta:
        verbose_name = 'Alternative Product'
        verbose_name_plural = 'Alternative Products'

    def __str__(self):
        return self.product_name
