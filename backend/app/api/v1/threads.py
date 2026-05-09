import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Message, Thread
from app.db.session import get_pg
from app.log import get_logger

router = APIRouter()
log = get_logger("api.threads")


class ThreadCreate(BaseModel):
    title: str | None = Field(default=None, max_length=512)


class ThreadOut(BaseModel):
    id: str
    title: str | None
    created_at: datetime | None
    updated_at: datetime | None


class MessageOut(BaseModel):
    id: str
    thread_id: str
    role: str
    content: str
    created_at: datetime | None


@router.post("/threads")
async def create_thread(body: ThreadCreate | None = None, pg: AsyncSession = Depends(get_pg)):
    tid = str(uuid.uuid4())
    title = (body.title if body else None) or "Conversation"
    row = Thread(id=tid, title=title)
    pg.add(row)
    await pg.commit()
    await pg.refresh(row)
    log.info("thread_created id=%s title=%s", row.id, row.title)
    return ThreadOut(id=row.id, title=row.title, created_at=row.created_at, updated_at=row.updated_at)


@router.get("/threads")
async def list_threads(limit: int = 50, pg: AsyncSession = Depends(get_pg)):
    limit = min(max(limit, 1), 100)
    res = await pg.execute(select(Thread).order_by(Thread.updated_at.desc()).limit(limit))
    rows = res.scalars().all()
    return {
        "threads": [
            ThreadOut(id=t.id, title=t.title, created_at=t.created_at, updated_at=t.updated_at)
            for t in rows
        ]
    }


@router.get("/threads/{thread_id}/messages")
async def list_messages(thread_id: str, pg: AsyncSession = Depends(get_pg)):
    t = await pg.get(Thread, thread_id)
    if not t:
        raise HTTPException(status_code=404, detail="Thread not found")
    res = await pg.execute(
        select(Message).where(Message.thread_id == thread_id).order_by(Message.created_at.asc())
    )
    msgs = res.scalars().all()
    return {
        "thread_id": thread_id,
        "messages": [
            MessageOut(id=m.id, thread_id=m.thread_id, role=m.role, content=m.content, created_at=m.created_at)
            for m in msgs
        ],
    }


@router.delete("/threads/{thread_id}")
async def delete_thread(thread_id: str, pg: AsyncSession = Depends(get_pg)):
    t = await pg.get(Thread, thread_id)
    if not t:
        raise HTTPException(status_code=404, detail="Thread not found")
    await pg.execute(delete(Message).where(Message.thread_id == thread_id))
    await pg.execute(delete(Thread).where(Thread.id == thread_id))
    await pg.commit()
    log.info("thread_deleted id=%s", thread_id)
    return {"deleted": thread_id}
