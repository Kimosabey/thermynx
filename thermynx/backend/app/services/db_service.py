from app.db.session import get_db_pool
import aiomysql

class DBService:
    @staticmethod
    async def get_table_schema(table_name: str) -> str:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                # Basic protection against SQL injection for table name
                if not table_name.isidentifier():
                    raise ValueError("Invalid table name")
                
                await cur.execute(f"SHOW CREATE TABLE `{table_name}`")
                result = await cur.fetchone()
                if result and len(result) >= 2:
                    return result[1]
                return "Schema not found"

    @staticmethod
    async def get_sample_data(table_name: str, limit: int = 5) -> list[dict]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                if not table_name.isidentifier():
                    raise ValueError("Invalid table name")
                
                # Enforce max limit to avoid huge payloads
                safe_limit = min(max(1, limit), 50)
                await cur.execute(f"SELECT * FROM `{table_name}` LIMIT {safe_limit}")
                rows = await cur.fetchall()
                
                # Convert non-serializable items like datetime/decimal to strings
                formatted_rows = []
                for row in rows:
                    formatted_row = {k: str(v) if v is not None else None for k, v in row.items()}
                    formatted_rows.append(formatted_row)
                    
                return formatted_rows
