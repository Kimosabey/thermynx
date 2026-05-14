import asyncio
import aiomysql
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def check_db():
    url = "mysql+aiomysql://root:root123@localhost:3307/unicharm"
    engine = create_async_engine(url)
    try:
        async with engine.connect() as conn:
            # List tables
            result = await conn.execute(text("SHOW TABLES"))
            tables = [row[0] for row in result.fetchall()]
            print(f"Tables in unicharm: {tables}")
            
            for table in tables:
                if "normalized" in table:
                    res = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    count = res.scalar()
                    print(f"Table {table}: {count} rows")
    except Exception as e:
        print(f"Error connecting to DB: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_db())
