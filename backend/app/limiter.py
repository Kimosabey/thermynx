from slowapi import Limiter
from slowapi.util import get_remote_address

# Single shared limiter — imported by routers that need per-route limits.
# Wired to app.state.limiter in main.py.
limiter = Limiter(key_func=get_remote_address)
