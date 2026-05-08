from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.db_service import DBService
from app.prompts.hvac_prompts import build_hvac_analyzer_prompt
from app.llm.ollama_client import OllamaClient
from app.utils.logger import setup_logger

logger = setup_logger("API_Analyzer")

router = APIRouter()

class AnalyzeRequest(BaseModel):
    question: str
    table_name: str
    row_limit: int = 5
    model: Optional[str] = None

class AnalyzeResponse(BaseModel):
    analysis: str
    table_used: str
    rows_fetched: int

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_hvac_data(req: AnalyzeRequest):
    logger.info(f"Received analysis request for table: {req.table_name}")
    
    allowed_tables = ["chiller_1_normalized", "plant_normalized", "gl_alarm"]
    if req.table_name not in allowed_tables:
        logger.warning(f"Rejected request: Table '{req.table_name}' is not allowed.")
        raise HTTPException(status_code=400, detail=f"Table {req.table_name} not allowed for MVP.")

    try:
        logger.info(f"Fetching schema for '{req.table_name}'...")
        # 1. Fetch Schema
        schema = await DBService.get_table_schema(req.table_name)
        
        # 2. Fetch Sample Data
        logger.info(f"Fetching up to {req.row_limit} sample rows...")
        sample_data = await DBService.get_sample_data(req.table_name, limit=req.row_limit)
        
        # 3. Build Prompt
        logger.info("Building HVAC prompt with context...")
        prompt = build_hvac_analyzer_prompt(
            question=req.question,
            table_name=req.table_name,
            schema=schema,
            sample_data=sample_data
        )
        
        # 4. Query Ollama
        logger.info("Sending prompt to Ollama LLM...")
        analysis_result = await OllamaClient.generate_completion(prompt, model=req.model)
        
        logger.info("Successfully generated analysis response.")
        return AnalyzeResponse(
            analysis=analysis_result,
            table_used=req.table_name,
            rows_fetched=len(sample_data)
        )

    except Exception as e:
        logger.error(f"Error during analysis: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
