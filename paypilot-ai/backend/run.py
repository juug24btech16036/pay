import uvicorn
from app.config import get_settings

if __name__ == "__main__":
    settings = get_settings()
    print("=" * 60)
    print(">> Starting PayPilot AI Backend Server")
    print(f">> URL: http://localhost:{settings.PORT}")
    print(f">> Docs: http://localhost:{settings.PORT}/docs")
    paypal_status = "Configured" if settings.is_paypal_configured() else "Not Configured (Add credentials in backend/.env)"
    print(f">> PayPal Sandbox: {paypal_status}")
    gemini_status = "Configured" if settings.is_gemini_configured() else "Not Configured (Add GEMINI_API_KEY in backend/.env)"
    print(f">> Gemini AI Copilot: {gemini_status}")
    print("=" * 60)
    uvicorn.run("app.main:app", host="127.0.0.1", port=settings.PORT, reload=True)
