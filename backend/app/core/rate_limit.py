
try:
    from slowapi import Limiter  # type: ignore[reportMissingImports]
    from slowapi.util import get_remote_address  # type: ignore[reportMissingImports]
except ImportError:  # pragma: no cover - fallback for environments without slowapi
    class Limiter:
        def __init__(self, *args, **kwargs):
            pass

        def limit(self, *args, **kwargs):
            def decorator(func):
                return func

            return decorator

    def get_remote_address(request):
        return request.client.host if request and request.client else "127.0.0.1"


# ============================================================
# RAGENTIS RATE LIMITER
# ============================================================

limiter = Limiter(
    key_func=get_remote_address
)
