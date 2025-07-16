import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import analyzer.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'image_analyzer.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(
            analyzer.routing.websocket_urlpatterns
        )
    ),
})
