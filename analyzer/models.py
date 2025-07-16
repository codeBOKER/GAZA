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

class BoycottPruducts(models.Model):
    product_name = models.CharField(max_length=255)
    product_type = models.ForeignKey(ProductType, on_delete=models.CASCADE, related_name='boycott_products')
    company_name= models.ForeignKey(BoycottCompanies, on_delete=models.CASCADE, related_name='boycott_products')

    class Meta:
        verbose_name = 'Boycott Product'
        verbose_name_plural = 'Boycott Products'

    def __str__(self):
        return self.product_name


class GenrateText(models.Model):
    text_field = models.TextField()
    check= models.BooleanField(default=False)
    
    def __str__(self):
        return self.text_field[:50]


class GenrateImg(models.Model):
    text_field = models.TextField()
    check= models.BooleanField(default=False)

    def __str__(self):
        return self.text_field[:50]
