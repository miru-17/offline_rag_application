"""
Admin insights: usage, answer quality and knowledge gaps.

Knowledge gaps show questions the system could not answer, grouped, so the
admin knows which documents are missing. Who asked is NOT shown.
"""

import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.license import require_feature_read
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.services.retrieval_service import RetrievalService

router = APIRouter(prefix="/insights", tags=["Insights"])

_STOP = RetrievalService.STOP_WORDS | {"there", "any", "list", "all", "explain", "much", "many", "get"}


def _normalise(question: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", question.lower())).strip()


def _keywords(question: str) -> list[str]:
    return [w for w in _normalise(question).split() if len(w) > 2 and w not in _STOP]


@router.get("/overview")
def overview(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(require_feature_read("insights", "ADMIN")),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    base = (
        select(Message)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(Conversation.tenant_id == current_user.tenant_id, Message.created_at >= since)
    )

    assistant = base.where(Message.role == "assistant").subquery()
    status_counts = dict(
        db.execute(select(assistant.c.answer_status, func.count()).group_by(assistant.c.answer_status)).all()
    )
    feedback_counts = dict(
        db.execute(
            select(assistant.c.feedback_rating, func.count())
            .where(assistant.c.feedback_rating.is_not(None))
            .group_by(assistant.c.feedback_rating)
        ).all()
    )

    users_sub = base.where(Message.role == "user").subquery()
    day = func.date_trunc("day", users_sub.c.created_at)
    per_day = db.execute(select(day, func.count()).group_by(day).order_by(day)).all()

    active_users = db.scalar(
        select(func.count(func.distinct(Conversation.user_id)))
        .join(Message, Message.conversation_id == Conversation.id)
        .where(Conversation.tenant_id == current_user.tenant_id, Message.created_at >= since)
    )

    total_answers = sum(status_counts.values())
    answered = status_counts.get("answered", 0)

    return {
        "days": days,
        "questions": sum(count for _, count in per_day),
        "active_users": active_users,
        "answers": {
            "total": total_answers,
            "answered": answered,
            "not_found": status_counts.get("not_found", 0),
            "stopped": status_counts.get("stopped", 0),
            "error": status_counts.get("error", 0),
            "answer_rate": round(answered / total_answers, 3) if total_answers else None,
        },
        "feedback": {"up": feedback_counts.get("up", 0), "down": feedback_counts.get("down", 0)},
        "questions_per_day": [{"date": d.date().isoformat(), "count": c} for d, c in per_day],
    }


@router.get("/knowledge-gaps")
def knowledge_gaps(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(25, ge=1, le=100),
    current_user: User = Depends(require_feature_read("insights", "ADMIN")),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)

    # Each unanswered assistant message, paired with the question just before it.
    rows = db.execute(
        select(Message.conversation_id, Message.created_at, Message.role, Message.content, Message.answer_status,
               Message.feedback_rating)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(Conversation.tenant_id == current_user.tenant_id, Message.created_at >= since)
        .order_by(Message.conversation_id, Message.created_at)
    ).all()

    last_question: dict = {}
    gaps: list[str] = []
    disliked: list[str] = []
    for conversation_id, _, role, content, answer_status, rating in rows:
        if role == "user":
            last_question[conversation_id] = content
            continue
        question = last_question.get(conversation_id)
        if not question:
            continue
        if answer_status == "not_found":
            gaps.append(question)
        elif rating == "down":
            disliked.append(question)

    grouped: dict[str, dict] = {}
    for question in gaps:
        key = _normalise(question)
        entry = grouped.setdefault(key, {"question": question.strip()[:300], "count": 0})
        entry["count"] += 1

    topic_counter = Counter(word for q in gaps for word in set(_keywords(q)))

    disliked_grouped: dict[str, int] = defaultdict(int)
    for question in disliked:
        disliked_grouped[question.strip()[:300]] += 1

    return {
        "days": days,
        "unanswered_total": len(gaps),
        "questions": sorted(grouped.values(), key=lambda e: -e["count"])[:limit],
        "missing_topics": [{"topic": t, "count": c} for t, c in topic_counter.most_common(15)],
        "disliked_answers": [
            {"question": q, "count": c} for q, c in sorted(disliked_grouped.items(), key=lambda kv: -kv[1])[:limit]
        ],
    }
