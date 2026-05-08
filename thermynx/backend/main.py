from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import analyzer

app = FastAPI(
    title="THERMYNX AI Operations Intelligence",
    description="HVAC AI Platform Backend",
    version="1.0.0"
)

# Enable CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the exact domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyzer.router, prefix="/api")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "platform": "THERMYNX"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
