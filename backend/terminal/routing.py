from django.urls import re_path
from .consumers import TerminalConsumer

websocket_urlpatterns = [
    re_path(r'ws/terminal/(?P<project_id>[^/]+)/$', TerminalConsumer.as_asgi()),
]